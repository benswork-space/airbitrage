/**
 * Source Finder — BRUTE FORCE MODE
 *
 * For each BuyIntent, searches for the item on marketplaces.
 * Two strategies depending on whether the buyer stated a price:
 *
 * A) PRICED posts: Search for the item cheaper than buyer's price → profit = buyer - source - fees
 * B) PRICELESS posts: Search for the item's market price on eBay sold listings.
 *    If cheap listings exist well below market, that's a potential flip to the buyer.
 *
 * Increased search cap to 50 intents. Multiple search strategies per item.
 */

import { extractPrice, isListingUrl } from '@/agents/scout/sources';
import type { BuyIntent, SourceDiagnostic } from './harvester';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourceListing {
  title: string;
  price: number;        // cents
  url: string;
  marketplace: string;
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
  /** For priceless intents: estimated market value used as sell price */
  estimatedMarketPrice?: number;
}

export interface SourceResult {
  matched: MatchedOpportunity[];
  diagnostics: SourceDiagnostic[];
  tavilyCallCount: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const MIN_PROFIT_CENTS = 1500;      // $15 minimum profit (lowered)
const MAX_INTENTS_TO_SEARCH = 50;   // search up to 50 intents
const TAVILY_DELAY_MS = 250;        // 250ms between calls

/** Shipping estimate by source subreddit category */
const SHIPPING_ESTIMATES: Record<string, number> = {
  'r/hardwareswap': 1500,
  'r/mechmarket': 1000,
  'r/photomarket': 1500,
  'r/watchexchange': 1200,
  'r/appleswap': 1500,
  'r/AVexchange': 1500,
  'r/gamesale': 800,
  'r/homelabsales': 2000,
  'r/Knife_Swap': 800,
  'r/Pen_Swap': 600,
  'r/GunAccessoriesForSale': 1200,
  'r/comicswap': 600,
  'r/funkoswap': 800,
  'r/vinylcollectors': 800,
};

// ─── Main Source Finder ──────────────────────────────────────────────────────

export async function findSourcesForIntents(
  intents: BuyIntent[],
  tavilyApiKey: string,
  onProgress?: (message: string) => void,
): Promise<SourceResult> {
  const matched: MatchedOpportunity[] = [];
  const diagnostics: SourceDiagnostic[] = [];
  let tavilyCallCount = 0;

  const topIntents = intents.slice(0, MAX_INTENTS_TO_SEARCH);

  for (let i = 0; i < topIntents.length; i++) {
    const intent = topIntents[i];
    const start = Date.now();

    const priceLabel = intent.hasStatedPrice
      ? `$${(intent.maxPrice / 100).toFixed(0)}`
      : 'no price';

    onProgress?.(`[${i + 1}/${topIntents.length}] Searching "${intent.itemWanted.slice(0, 40)}" (${priceLabel})...`);

    try {
      if (intent.hasStatedPrice) {
        // Strategy A: buyer has a price — find cheaper sources
        const listings = await searchForItem(intent.itemWanted, tavilyApiKey);
        tavilyCallCount++;

        for (const listing of listings) {
          if (listing.price >= intent.maxPrice) continue; // not cheaper

          const fees = calculateFees(intent.maxPrice, intent.source);
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
          source: `priced:${intent.itemWanted.slice(0, 30)}`,
          status: listings.length > 0 ? 'success' : 'empty',
          itemCount: listings.length,
          durationMs: Date.now() - start,
        });

      } else {
        // Strategy B: no price stated — find market price + cheap sources
        const listings = await searchForItem(intent.itemWanted, tavilyApiKey);
        tavilyCallCount++;

        if (listings.length < 2) {
          diagnostics.push({
            source: `market:${intent.itemWanted.slice(0, 30)}`,
            status: 'empty',
            itemCount: listings.length,
            durationMs: Date.now() - start,
          });
          if (i < topIntents.length - 1) await new Promise(r => setTimeout(r, TAVILY_DELAY_MS));
          continue;
        }

        // Estimate market price as median of found prices
        const prices = listings.map(l => l.price).sort((a, b) => a - b);
        const marketPrice = prices[Math.floor(prices.length / 2)];

        // Find listings significantly below market (>25% below)
        const cheapThreshold = Math.round(marketPrice * 0.75);
        const cheapListings = listings.filter(l => l.price <= cheapThreshold);

        for (const listing of cheapListings) {
          // Use market price as the estimated sell price
          const fees = calculateFees(marketPrice, intent.source);
          const profit = marketPrice - listing.price - fees.total;

          if (profit >= MIN_PROFIT_CENTS) {
            matched.push({
              buyIntent: { ...intent, maxPrice: marketPrice },
              sourceListing: listing,
              estimatedProfit: profit,
              fees,
              confidence: calculateConfidence(intent, listing, profit) - 10, // lower confidence for estimated price
              estimatedMarketPrice: marketPrice,
            });
          }
        }

        diagnostics.push({
          source: `market:${intent.itemWanted.slice(0, 30)}`,
          status: cheapListings.length > 0 ? 'success' : 'empty',
          itemCount: listings.length,
          durationMs: Date.now() - start,
        });
      }
    } catch (err) {
      diagnostics.push({
        source: `search:${intent.itemWanted.slice(0, 30)}`,
        status: 'error',
        itemCount: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (i < topIntents.length - 1) {
      await new Promise(r => setTimeout(r, TAVILY_DELAY_MS));
    }
  }

  matched.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  return { matched, diagnostics, tavilyCallCount };
}

// ─── Tavily Search ───────────────────────────────────────────────────────────

async function searchForItem(
  itemName: string,
  tavilyApiKey: string,
): Promise<SourceListing[]> {
  // Broader search — don't restrict to specific sites, let Tavily find deals
  const query = `buy "${itemName}" price`;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query,
      max_results: 10,
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
    const marketplace = detectMarketplace(result.url);

    // Accept listing URLs and also known marketplaces
    if (!isListingUrl(result.url) && marketplace === 'Other') continue;

    const text = `${result.title || ''} ${result.content || ''}`;
    const price = extractPrice(text);

    if (!price || price <= 0) continue;
    if (price < 500 || price > 10000000) continue;

    listings.push({
      title: (result.title || '').slice(0, 120),
      price,
      url: result.url,
      marketplace,
    });
  }

  return deduplicateListings(listings);
}

// ─── Fee Calculation ─────────────────────────────────────────────────────────

function calculateFees(
  sellPrice: number,
  source: string,
): { paypalFee: number; shippingCost: number; total: number } {
  // PayPal Goods & Services: 3.49% + $0.49
  const paypalFee = Math.round(sellPrice * 0.0349) + 49;
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
  let confidence = 45;

  // Profit margin
  const sellPrice = intent.maxPrice || profit + listing.price;
  const profitPercent = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
  if (profitPercent > 30) confidence += 15;
  else if (profitPercent > 20) confidence += 10;
  else if (profitPercent > 10) confidence += 5;

  // Buyer reputation
  if (intent.buyerTradeCount >= 50) confidence += 10;
  else if (intent.buyerTradeCount >= 20) confidence += 7;
  else if (intent.buyerTradeCount >= 5) confidence += 3;

  // Post freshness
  if (intent.postAge <= 4) confidence += 10;
  else if (intent.postAge <= 12) confidence += 5;
  else if (intent.postAge <= 24) confidence += 2;

  // Known marketplace
  if (listing.marketplace !== 'Other') confidence += 5;
  if (listing.marketplace === 'eBay' || listing.marketplace === 'Amazon') confidence += 5;

  // Stated price = higher confidence
  if (intent.hasStatedPrice) confidence += 10;

  return Math.min(95, Math.max(15, confidence));
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
  if (lower.includes('bhphotovideo.com')) return 'B&H';
  if (lower.includes('adorama.com')) return 'Adorama';
  if (lower.includes('reverb.com')) return 'Reverb';
  if (lower.includes('discogs.com')) return 'Discogs';
  if (lower.includes('stockx.com')) return 'StockX';
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
