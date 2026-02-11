/**
 * Source Finder — for each BuyIntent, searches for the item at a lower price on marketplaces.
 *
 * Uses Tavily to search eBay, Amazon, Mercari for listings.
 * Only accepts results from real listing URLs (isListingUrl).
 * Calculates fees (PayPal G&S + shipping) and filters for profitable matches.
 */

import { extractPrice, isListingUrl } from '@/agents/scout/sources';
import type { BuyIntent, SourceDiagnostic } from './harvester';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourceListing {
  title: string;
  price: number;        // cents
  url: string;
  marketplace: string;  // "eBay", "Amazon", "Mercari", etc.
}

export interface MatchedOpportunity {
  buyIntent: BuyIntent;
  sourceListing: SourceListing;
  estimatedProfit: number; // cents
  fees: {
    paypalFee: number;
    shippingCost: number;
    total: number;
  };
  confidence: number;
}

export interface SourceResult {
  matched: MatchedOpportunity[];
  diagnostics: SourceDiagnostic[];
}

// ─── Configuration ───────────────────────────────────────────────────────────

const MIN_PROFIT_CENTS = 2000; // $20 minimum profit
const MAX_INTENTS_TO_SEARCH = 15;
const TAVILY_DELAY_MS = 300;

/** Shipping estimate by source subreddit category */
const SHIPPING_ESTIMATES: Record<string, number> = {
  'r/hardwareswap': 1500,   // $15 — GPUs, components
  'r/mechmarket': 1000,     // $10 — keyboards
  'r/photomarket': 1500,    // $15 — cameras, lenses
  'r/watchexchange': 1200,  // $12 — watches (insured)
  'r/appleswap': 1500,      // $15 — Apple devices
  'r/AVexchange': 1500,     // $15 — audio gear
  'r/gamesale': 800,        // $8 — games, small items
  'r/homelabsales': 2000,   // $20 — servers, heavy gear
  'r/Knife_Swap': 800,      // $8 — knives
  'r/Pen_Swap': 600,        // $6 — pens
  'r/WantToBuy': 1500,      // $15 — general
};

// ─── Main Source Finder ──────────────────────────────────────────────────────

export async function findSourcesForIntents(
  intents: BuyIntent[],
  tavilyApiKey: string,
  onProgress?: (message: string) => void,
): Promise<SourceResult> {
  const matched: MatchedOpportunity[] = [];
  const diagnostics: SourceDiagnostic[] = [];

  // Take top N by price (higher value = bigger potential spreads)
  const topIntents = intents.slice(0, MAX_INTENTS_TO_SEARCH);

  for (let i = 0; i < topIntents.length; i++) {
    const intent = topIntents[i];
    const start = Date.now();

    onProgress?.(`Searching sources for "${intent.itemWanted.slice(0, 50)}" ($${(intent.maxPrice / 100).toFixed(0)})... [${i + 1}/${topIntents.length}]`);

    try {
      const listings = await searchForItem(intent.itemWanted, intent.maxPrice, tavilyApiKey);

      // Find profitable matches
      for (const listing of listings) {
        const fees = calculateFees(intent.maxPrice, listing.price, intent.source);
        const profit = intent.maxPrice - listing.price - fees.total;

        if (profit >= MIN_PROFIT_CENTS) {
          matched.push({
            buyIntent: intent,
            sourceListing: listing,
            estimatedProfit: profit,
            fees,
            confidence: calculateConfidence(intent, listing, profit),
          });
        }
      }

      diagnostics.push({
        source: `search:${intent.itemWanted.slice(0, 30)}`,
        status: listings.length > 0 ? 'success' : 'empty',
        itemCount: listings.length,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      diagnostics.push({
        source: `search:${intent.itemWanted.slice(0, 30)}`,
        status: 'error',
        itemCount: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Rate limit Tavily calls
    if (i < topIntents.length - 1) {
      await new Promise(r => setTimeout(r, TAVILY_DELAY_MS));
    }
  }

  // Sort by profit (highest first)
  matched.sort((a, b) => b.estimatedProfit - a.estimatedProfit);

  return { matched, diagnostics };
}

// ─── Tavily Search ───────────────────────────────────────────────────────────

async function searchForItem(
  itemName: string,
  maxPriceCents: number,
  tavilyApiKey: string,
): Promise<SourceListing[]> {
  // Build search query targeting marketplaces
  const query = `"${itemName}" buy price site:ebay.com OR site:amazon.com OR site:mercari.com OR site:swappa.com`;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query,
      max_results: 8,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily returned ${response.status}`);
  }

  const data = await response.json();
  const results = (data.results || []) as Array<{
    url: string;
    title?: string;
    content?: string;
  }>;

  const listings: SourceListing[] = [];

  for (const result of results) {
    // Only accept real listing URLs
    if (!isListingUrl(result.url)) continue;

    const text = `${result.title || ''} ${result.content || ''}`;
    const price = extractPrice(text);

    // Must have a price, and it must be lower than buyer's max
    if (!price || price <= 0) continue;
    if (price >= maxPriceCents) continue; // not profitable

    // Sanity: price should be in reasonable range (not $0.01 or $999,999)
    if (price < 500 || price > 10000000) continue;

    listings.push({
      title: (result.title || '').slice(0, 120),
      price,
      url: result.url,
      marketplace: detectMarketplace(result.url),
    });
  }

  // Deduplicate by URL domain + similar price
  return deduplicateListings(listings);
}

// ─── Fee Calculation ─────────────────────────────────────────────────────────

function calculateFees(
  buyerPrice: number,
  _sourcePrice: number,
  source: string,
): { paypalFee: number; shippingCost: number; total: number } {
  // PayPal Goods & Services: 3.49% + $0.49
  const paypalFee = Math.round(buyerPrice * 0.0349) + 49;

  // Shipping estimate based on category
  const shippingCost = SHIPPING_ESTIMATES[source] || 1500;

  return {
    paypalFee,
    shippingCost,
    total: paypalFee + shippingCost,
  };
}

// ─── Confidence Scoring ──────────────────────────────────────────────────────

function calculateConfidence(
  intent: BuyIntent,
  listing: SourceListing,
  profit: number,
): number {
  let confidence = 50; // base

  // Higher profit margin = higher confidence
  const profitPercent = (profit / intent.maxPrice) * 100;
  if (profitPercent > 30) confidence += 15;
  else if (profitPercent > 20) confidence += 10;
  else if (profitPercent > 10) confidence += 5;

  // Buyer reputation boost
  if (intent.buyerTradeCount >= 50) confidence += 10;
  else if (intent.buyerTradeCount >= 20) confidence += 7;
  else if (intent.buyerTradeCount >= 5) confidence += 3;

  // Fresher posts = higher confidence
  if (intent.postAge <= 2) confidence += 10;
  else if (intent.postAge <= 6) confidence += 5;

  // Known marketplace = higher confidence
  if (listing.marketplace !== 'Other') confidence += 5;

  // eBay/Amazon are most reliable
  if (listing.marketplace === 'eBay' || listing.marketplace === 'Amazon') confidence += 5;

  return Math.min(95, Math.max(20, confidence));
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function detectMarketplace(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('ebay.com')) return 'eBay';
  if (lower.includes('amazon.com')) return 'Amazon';
  if (lower.includes('mercari.com')) return 'Mercari';
  if (lower.includes('swappa.com')) return 'Swappa';
  if (lower.includes('walmart.com')) return 'Walmart';
  if (lower.includes('bestbuy.com')) return 'Best Buy';
  if (lower.includes('target.com')) return 'Target';
  if (lower.includes('newegg.com')) return 'Newegg';
  return 'Other';
}

function deduplicateListings(listings: SourceListing[]): SourceListing[] {
  const seen = new Map<string, SourceListing>();

  for (const listing of listings) {
    const key = `${listing.marketplace}:${Math.round(listing.price / 100)}`;
    if (!seen.has(key)) {
      seen.set(key, listing);
    }
  }

  return Array.from(seen.values());
}
