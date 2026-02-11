/**
 * Buy-Intent Harvester — fetches buy-intent posts from Reddit swap subs.
 *
 * Sources:
 * A) Reddit swap subreddits (JSON API, no auth needed)
 *    - [H]/[W] format subs: hardwareswap, mechmarket, photomarket, appleswap, etc.
 *    - [WTB] format subs: watchexchange, WantToBuy
 *
 * Key insight: Most buyers on swap subs DON'T put a $ amount in the title.
 * They write "[H] PayPal [W] RTX 4080" and the price is in the selftext body.
 * We extract prices from: title → selftext → skip if no price found.
 *
 * We also use link_flair_text (BUYING/SELLING) as a primary signal when available.
 */

import { extractPrice } from '@/agents/scout/sources';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BuyIntent {
  title: string;
  itemWanted: string;
  maxPrice: number;       // cents
  location: string;
  buyerUsername: string;
  buyerTradeCount: number;
  source: string;         // "r/hardwareswap", etc.
  postUrl: string;
  postAge: number;        // hours since posted
  created: number;        // unix timestamp
}

export interface SourceDiagnostic {
  source: string;
  status: 'success' | 'empty' | 'error';
  itemCount: number;
  durationMs: number;
  error?: string;
}

export interface HarvestResult {
  intents: BuyIntent[];
  diagnostics: SourceDiagnostic[];
}

// ─── Configuration ───────────────────────────────────────────────────────────

/** Reddit swap subs that use [H]/[W] format */
const HW_FORMAT_SUBS = [
  'hardwareswap',
  'mechmarket',
  'photomarket',
  'appleswap',
  'AVexchange',
  'gamesale',
  'homelabsales',
  'Knife_Swap',
  'Pen_Swap',
];

/** Reddit subs that use [WTB] format or general buy-intent */
const WTB_FORMAT_SUBS = [
  'watchexchange',
  'WantToBuy',
];

const MIN_PRICE_CENTS = 5000;   // $50 minimum (lowered to capture more posts)
const MAX_POST_AGE_HOURS = 48;  // 48h window (widened for more results)
const REDDIT_DELAY_MS = 500;    // be respectful to Reddit
const POSTS_PER_SUB = 50;       // fetch more posts per sub

// ─── Main Harvester ──────────────────────────────────────────────────────────

export async function harvestBuyIntents(): Promise<HarvestResult> {
  const allIntents: BuyIntent[] = [];
  const diagnostics: SourceDiagnostic[] = [];

  // Reddit swap subs (sequential with delay to stay under rate limit)
  const allSubs = [...HW_FORMAT_SUBS, ...WTB_FORMAT_SUBS];
  for (const sub of allSubs) {
    const start = Date.now();
    try {
      const intents = await fetchRedditSubreddit(sub);
      diagnostics.push({
        source: `r/${sub}`,
        status: intents.length > 0 ? 'success' : 'empty',
        itemCount: intents.length,
        durationMs: Date.now() - start,
      });
      allIntents.push(...intents);
    } catch (err) {
      diagnostics.push({
        source: `r/${sub}`,
        status: 'error',
        itemCount: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Rate limit between Reddit requests
    await new Promise(r => setTimeout(r, REDDIT_DELAY_MS));
  }

  // Sort by price (highest first — bigger spreads)
  allIntents.sort((a, b) => b.maxPrice - a.maxPrice);

  return { intents: allIntents, diagnostics };
}

// ─── Reddit Fetching ─────────────────────────────────────────────────────────

interface RedditPost {
  title: string;
  author: string;
  author_flair_text: string | null;
  permalink: string;
  created_utc: number;
  subreddit: string;
  link_flair_text: string | null;
  selftext: string;
}

async function fetchRedditSubreddit(subreddit: string): Promise<BuyIntent[]> {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${POSTS_PER_SUB}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Airbitrage/1.0)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit returned ${response.status}`);
  }

  const data = await response.json();
  const posts: RedditPost[] = (data?.data?.children || []).map(
    (child: { data: RedditPost }) => child.data,
  );

  const intents: BuyIntent[] = [];
  const nowSec = Date.now() / 1000;

  for (const post of posts) {
    // Skip old posts
    const ageHours = (nowSec - post.created_utc) / 3600;
    if (ageHours > MAX_POST_AGE_HOURS) continue;

    // Try to parse as buy-intent
    const intent = parseBuyIntentFromPost(post, subreddit, ageHours);
    if (intent && intent.maxPrice >= MIN_PRICE_CENTS) {
      intents.push(intent);
    }
  }

  return intents;
}

// ─── Post Classification ─────────────────────────────────────────────────────

/**
 * Determines if a post is a buy-intent post using multiple signals:
 * 1. link_flair_text = "BUYING" / "Buying" (most reliable)
 * 2. [H] contains payment words + [W] contains item (title format)
 * 3. [WTB] tag in title
 * 4. Flair-based fallback with "buy" keyword
 */
function parseBuyIntentFromPost(
  post: RedditPost,
  subreddit: string,
  ageHours: number,
): BuyIntent | null {
  const title = post.title;
  const selftext = post.selftext || '';

  // ── Signal 1: Flair says "BUYING" ──────────────────────────────────
  // This is the most reliable signal — subreddit mods enforce it.
  const flairIsBuying = post.link_flair_text
    && /^buy/i.test(post.link_flair_text.trim());

  // ── Signal 2: [H]/[W] format where [H] = money ────────────────────
  const hwResult = parseHWFormat(title);
  const isHWBuyPost = hwResult !== null;

  // ── Signal 3: [WTB] tag ────────────────────────────────────────────
  const isWTBPost = /\[WTB\]/i.test(title);

  // Must match at least one buy signal
  if (!flairIsBuying && !isHWBuyPost && !isWTBPost) return null;

  // ── Extract the item wanted ────────────────────────────────────────
  let itemWanted: string;

  if (isHWBuyPost && hwResult) {
    itemWanted = hwResult.itemWanted;
  } else {
    // Strip tags, price, payment words from title
    itemWanted = title
      .replace(/\[.*?\]/g, '')
      .replace(/\$[\d,.]+/g, '')
      .replace(/paypal|cash|venmo|zelle|local\s*cash/gi, '')
      .trim();
  }

  if (itemWanted.length < 3) return null;

  // ── Extract the price — THIS IS THE KEY FIX ───────────────────────
  // Most buyers don't put price in title. Check multiple sources:
  let maxPrice: number | null = null;

  // 1. Try [H] section of title (rare but best when present)
  if (hwResult?.maxPrice) {
    maxPrice = hwResult.maxPrice;
  }

  // 2. Try full title
  if (!maxPrice) {
    maxPrice = extractPrice(title);
  }

  // 3. Try selftext body (most common place for price)
  if (!maxPrice && selftext.length > 0) {
    maxPrice = extractBestPriceFromBody(selftext);
  }

  // No price found anywhere — skip this post
  if (!maxPrice) return null;

  return {
    title,
    itemWanted: itemWanted.slice(0, 120),
    maxPrice,
    location: extractLocation(title),
    buyerUsername: post.author,
    buyerTradeCount: parseTradeCount(post.author_flair_text),
    source: `r/${subreddit}`,
    postUrl: `https://www.reddit.com${post.permalink}`,
    postAge: Math.round(ageHours),
    created: post.created_utc,
  };
}

// ─── Title Parsing ───────────────────────────────────────────────────────────

interface ParsedHW {
  location: string;
  itemWanted: string;
  maxPrice: number | null; // cents — null if no price in [H] section
}

/**
 * Parse [H]/[W] format: "[USA-CA] [H] PayPal $800 [W] RTX 4080"
 * The buyer HAS money, WANTS an item.
 * Only match if [H] section contains payment words (PayPal, Cash, $, etc.)
 */
function parseHWFormat(title: string): ParsedHW | null {
  // Extract [H] and [W] sections
  const hwMatch = title.match(/\[H\]\s*(.*?)\s*\[W\]\s*(.*)/i);
  if (!hwMatch) return null;

  const haveSection = hwMatch[1].trim();
  const wantSection = hwMatch[2].trim();

  // [H] must contain payment indicator (PayPal, Cash, $, Venmo, etc.)
  const isPayment = /paypal|cash|venmo|zelle|money|\$/i.test(haveSection);
  if (!isPayment) return null;

  // Extract price from [H] section (may be null — that's OK)
  const price = extractPrice(haveSection);

  // Clean up item name from [W] section
  const itemWanted = wantSection
    .replace(/\[.*?\]/g, '')   // remove any brackets
    .replace(/,?\s*local.*$/i, '') // remove "local cash" at end
    .trim();

  if (itemWanted.length < 3) return null;

  return {
    location: extractLocation(title),
    itemWanted: itemWanted.slice(0, 120),
    maxPrice: price,
  };
}

/**
 * Extract the best (highest) price from post body text.
 * Reddit selftext often has multiple prices — we want the buyer's max offer.
 *
 * Handles formats like:
 * - "Budget: $800"
 * - "Willing to pay $500-700"
 * - "Looking to spend around $200"
 * - "$150 shipped"
 * - Price tables and lists
 */
function extractBestPriceFromBody(selftext: string): number | null {
  // Limit to first 1500 chars to avoid noise from long posts
  const text = selftext.slice(0, 1500);

  // Find all dollar amounts
  const pricePattern = /\$\s?([\d,]+(?:\.\d{2})?)/g;
  const prices: number[] = [];
  let match;

  while ((match = pricePattern.exec(text)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    if (num >= 20 && num < 50000) { // reasonable range
      prices.push(Math.round(num * 100)); // cents
    }
  }

  if (prices.length === 0) return null;

  // Return the highest price (buyer's max budget)
  return Math.max(...prices);
}

function extractLocation(title: string): string {
  // Match [USA-CA] or [US-TX] or [CAN-ON] etc.
  const locMatch = title.match(/\[([A-Z]{2,3}-[A-Z]{2})\]/i);
  if (locMatch) return locMatch[1].toUpperCase();

  // Match [USA] or [US] etc.
  const countryMatch = title.match(/\[(USA?|CAN|UK|EU)\]/i);
  if (countryMatch) return countryMatch[1].toUpperCase();

  return 'unknown';
}

function parseTradeCount(flair: string | null): number {
  if (!flair) return 0;

  // Match patterns like "50 Trades", "Trades: 50", "50 Confirmed", etc.
  const match = flair.match(/(\d+)\s*(?:trades?|confirmed|swaps?)/i)
    || flair.match(/(?:trades?|confirmed|swaps?)\s*:?\s*(\d+)/i);

  if (match) return parseInt(match[1], 10);

  // Some subs just show a number in the flair
  const numMatch = flair.match(/^\d+$/);
  if (numMatch) return parseInt(numMatch[0], 10);

  return 0;
}
