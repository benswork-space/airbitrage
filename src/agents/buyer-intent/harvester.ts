/**
 * Buy-Intent Harvester — finds buy-intent posts from Reddit swap subs via Tavily.
 *
 * Reddit blocks direct API requests from cloud providers (Vercel/AWS get 403).
 * So we use Tavily's search API to find recent buy posts on swap subreddits.
 *
 * Strategy: Run targeted Tavily searches for "[H] PayPal [W]" and "[WTB]" posts
 * across swap subs, then parse the results into BuyIntent objects.
 *
 * Cost: ~6 Tavily calls = ~$0.006 per harvest.
 */

import { extractPrice } from '@/agents/scout/sources';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BuyIntent {
  title: string;
  itemWanted: string;
  maxPrice: number;       // cents — 0 means "no price stated, needs market lookup"
  hasStatedPrice: boolean;
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
  tavilyCallCount: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

/** Tavily search queries — each targets a group of swap subs for buy posts */
const HARVEST_QUERIES = [
  // High-volume [H]/[W] subs
  {
    query: 'site:reddit.com/r/hardwareswap "[H] PayPal" OR "[H] Cash" OR "[H] Paypal, Local"',
    label: 'hardwareswap',
  },
  {
    query: 'site:reddit.com/r/mechmarket "[H] PayPal" OR "[H] Cash"',
    label: 'mechmarket',
  },
  {
    query: 'site:reddit.com/r/appleswap OR site:reddit.com/r/photomarket "[H] PayPal" OR "[H] Cash"',
    label: 'appleswap+photomarket',
  },
  {
    query: 'site:reddit.com/r/AVexchange OR site:reddit.com/r/gamesale "[H] PayPal" OR "[H] Cash"',
    label: 'AVexchange+gamesale',
  },
  {
    query: 'site:reddit.com/r/Pen_Swap OR site:reddit.com/r/comicswap OR site:reddit.com/r/Knife_Swap "[H] PayPal" OR "[H] Cash"',
    label: 'Pen_Swap+comicswap+Knife_Swap',
  },
  // [WTB] subs + remaining
  {
    query: 'site:reddit.com/r/watchexchange "[WTB]" OR site:reddit.com/r/vinylcollectors "[WTB]" OR site:reddit.com/r/homelabsales "[H] PayPal"',
    label: 'watchexchange+vinylcollectors+homelabsales',
  },
];

const MIN_PRICE_CENTS = 2500;   // $25 minimum (only for posts that have a price)
const TAVILY_DELAY_MS = 250;

/**
 * Reddit post IDs are sequential base-36 numbers. Newer posts have higher IDs.
 * Tavily doesn't reliably return published dates for Reddit, so we use relative
 * ID distance from the newest post to estimate freshness.
 *
 * Reddit generates ~300K–700K post IDs per hour (varies by time of day).
 * Using a generous 100M ID window covers roughly 1–2 weeks of posts.
 * This filters out months-old stale results while keeping anything recent.
 */
const MAX_ID_DISTANCE = 100_000_000; // ~1-2 weeks of Reddit posts

// ─── Main Harvester ──────────────────────────────────────────────────────────

export async function harvestBuyIntents(tavilyApiKey: string): Promise<HarvestResult> {
  const allIntents: BuyIntent[] = [];
  const diagnostics: SourceDiagnostic[] = [];
  let tavilyCallCount = 0;
  const seenUrls = new Set<string>();

  for (let i = 0; i < HARVEST_QUERIES.length; i++) {
    const { query, label } = HARVEST_QUERIES[i];
    const start = Date.now();

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          max_results: 20,
          search_depth: 'basic',
          include_answer: false,
          topic: 'general',
        }),
      });

      tavilyCallCount++;

      if (!response.ok) {
        throw new Error(`Tavily returned ${response.status}`);
      }

      const data = await response.json();
      const results = (data.results || []) as Array<{
        url: string;
        title?: string;
        content?: string;
        published_date?: string;
      }>;

      let intentCount = 0;

      for (const result of results) {
        // Only accept Reddit URLs
        if (!result.url.includes('reddit.com')) continue;
        // Dedup
        if (seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);

        const intent = parseTavilyResult(result);
        if (!intent) continue;

        // If they stated a price, enforce minimum
        if (intent.hasStatedPrice && intent.maxPrice < MIN_PRICE_CENTS) continue;

        allIntents.push(intent);
        intentCount++;
      }

      diagnostics.push({
        source: label,
        status: intentCount > 0 ? 'success' : 'empty',
        itemCount: intentCount,
        durationMs: Date.now() - start,
      });

    } catch (err) {
      diagnostics.push({
        source: label,
        status: 'error',
        itemCount: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Delay between Tavily calls
    if (i < HARVEST_QUERIES.length - 1) {
      await new Promise(r => setTimeout(r, TAVILY_DELAY_MS));
    }
  }

  // ── Filter stale posts using Reddit post IDs ────────────────────
  // Reddit post IDs are sequential — newer posts have higher numeric IDs.
  // Since Tavily doesn't give us dates, we compare each post's ID against
  // the highest ID we found. Anything too far below is months old.
  const freshIntents = filterByRedditId(allIntents);

  // Sort: priced posts first (by price desc), then priceless posts
  freshIntents.sort((a, b) => {
    if (a.hasStatedPrice && !b.hasStatedPrice) return -1;
    if (!a.hasStatedPrice && b.hasStatedPrice) return 1;
    return b.maxPrice - a.maxPrice;
  });

  return { intents: freshIntents, diagnostics, tavilyCallCount };
}

// ─── Freshness Filter ───────────────────────────────────────────────────────

/** Extract numeric Reddit post ID from a reddit.com URL */
function redditPostNumericId(url: string): number {
  const match = url.match(/\/comments\/(\w+)/);
  if (!match) return 0;
  return parseInt(match[1], 36);
}

/**
 * Filter intents to only recent posts based on Reddit post IDs.
 * Takes the max ID seen and keeps only posts within MAX_ID_DISTANCE of it.
 */
function filterByRedditId(intents: BuyIntent[]): BuyIntent[] {
  if (intents.length === 0) return intents;

  // Find the max post ID (most recent post)
  let maxId = 0;
  for (const intent of intents) {
    const id = redditPostNumericId(intent.postUrl);
    if (id > maxId) maxId = id;
  }

  if (maxId === 0) return intents; // couldn't parse any IDs

  // Keep only posts within the ID distance threshold
  return intents.filter(intent => {
    const id = redditPostNumericId(intent.postUrl);
    if (id === 0) return false; // couldn't parse ID, skip
    return (maxId - id) <= MAX_ID_DISTANCE;
  });
}

// ─── Tavily Result Parsing ──────────────────────────────────────────────────

function parseTavilyResult(result: {
  url: string;
  title?: string;
  content?: string;
  published_date?: string;
}): BuyIntent | null {
  const title = result.title || '';
  const content = result.content || '';
  const url = result.url;

  // Extract subreddit from URL
  const subMatch = url.match(/reddit\.com\/r\/(\w+)/);
  if (!subMatch) return null;
  const subreddit = subMatch[1];

  // ── Buy signal detection ───────────────────────────────────────────
  const hwResult = parseHWFormat(title);
  const isHWBuyPost = hwResult !== null;
  const isWTBPost = /\[WTB\]/i.test(title);

  if (!isHWBuyPost && !isWTBPost) return null;

  // ── Extract item wanted ────────────────────────────────────────────
  let itemWanted: string;

  if (isHWBuyPost && hwResult) {
    itemWanted = hwResult.itemWanted;
  } else {
    itemWanted = title
      .replace(/\[.*?\]/g, '')
      .replace(/\$[\d,.]+/g, '')
      .replace(/paypal|cash|venmo|zelle|local\s*cash/gi, '')
      .trim();
  }

  if (itemWanted.length < 3) return null;

  // ── Extract price ─────────────────────────────────────────────────
  let maxPrice: number | null = null;

  if (hwResult?.maxPrice) {
    maxPrice = hwResult.maxPrice;
  }
  if (!maxPrice) {
    maxPrice = extractPrice(title);
  }
  if (!maxPrice && content.length > 0) {
    maxPrice = extractBestPriceFromBody(content);
  }

  const hasStatedPrice = maxPrice !== null && maxPrice > 0;

  // ── Post age ──────────────────────────────────────────────────────
  let postAge = 24; // default if unknown
  let created = Math.floor(Date.now() / 1000) - (postAge * 3600);

  if (result.published_date) {
    const pubDate = new Date(result.published_date);
    if (!isNaN(pubDate.getTime())) {
      const ageMs = Date.now() - pubDate.getTime();
      postAge = Math.max(0, Math.round(ageMs / (1000 * 3600)));
      created = Math.floor(pubDate.getTime() / 1000);
    }
  }

  // ── Extract username from URL ─────────────────────────────────────
  // Tavily doesn't give us the author, so default to 'unknown'
  const buyerUsername = 'unknown';

  return {
    title,
    itemWanted: itemWanted.slice(0, 150),
    maxPrice: maxPrice || 0,
    hasStatedPrice,
    location: extractLocation(title),
    buyerUsername,
    buyerTradeCount: 0,
    source: `r/${subreddit}`,
    postUrl: url,
    postAge,
    created,
  };
}

// ─── Title Parsing ───────────────────────────────────────────────────────────

interface ParsedHW {
  location: string;
  itemWanted: string;
  maxPrice: number | null;
}

function parseHWFormat(title: string): ParsedHW | null {
  const hwMatch = title.match(/\[H\]\s*(.*?)\s*\[W\]\s*(.*)/i);
  if (!hwMatch) return null;

  const haveSection = hwMatch[1].trim();
  const wantSection = hwMatch[2].trim();

  // [H] must contain payment indicator (PayPal, Cash, $, etc.)
  const havePayment = /paypal|cash|venmo|zelle|money|\$/i.test(haveSection);
  if (!havePayment) return null;

  // CRITICAL: [W] must NOT be primarily payment words — that means it's a SELL post
  // e.g. "[H] RTX 3080, PayPal [W] Local Cash" is a SELL, not a BUY
  const wantPayment = /paypal|cash|venmo|zelle|money|\$/i.test(wantSection);
  const wantClean = wantSection
    .replace(/\[.*?\]/g, '')
    .replace(/paypal|cash|venmo|zelle|money|local|g&s|goods\s*(?:&|and)\s*services|\$[\d,.]+/gi, '')
    .replace(/,/g, '')
    .trim();

  // If [W] is ONLY payment words (nothing left after stripping), it's a SELL post
  if (wantPayment && wantClean.length < 3) return null;

  const price = extractPrice(haveSection);

  const itemWanted = wantSection
    .replace(/\[.*?\]/g, '')
    .replace(/,?\s*local.*$/i, '')
    .trim();

  if (itemWanted.length < 3) return null;

  return {
    location: extractLocation(title),
    itemWanted: itemWanted.slice(0, 150),
    maxPrice: price,
  };
}

function extractBestPriceFromBody(selftext: string): number | null {
  const text = selftext.slice(0, 2000);

  const pricePattern = /\$\s?([\d,]+(?:\.\d{2})?)/g;
  const prices: number[] = [];
  let match;

  while ((match = pricePattern.exec(text)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    if (num >= 15 && num < 50000) {
      prices.push(Math.round(num * 100));
    }
  }

  if (prices.length === 0) return null;
  return Math.max(...prices);
}

function extractLocation(title: string): string {
  const locMatch = title.match(/\[([A-Z]{2,3}-[A-Z]{2})\]/i);
  if (locMatch) return locMatch[1].toUpperCase();

  const countryMatch = title.match(/\[(USA?|CAN|UK|EU)\]/i);
  if (countryMatch) return countryMatch[1].toUpperCase();

  return 'unknown';
}
