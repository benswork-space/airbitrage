/**
 * Buy-Intent Pipeline Runner — BRUTE FORCE MODE
 *
 * Orchestrates the 3-phase pipeline:
 * 1. HARVEST — fetch buy-intent posts from Reddit swap subs (free)
 * 2. SOURCE — find cheaper listings via Tavily (up to 50 searches, ~$0.05)
 * 3. VERIFY — Claude confirms product match + fees (only if matches found)
 *
 * Timeout: 4 minutes (harvest ~6s, source ~30-60s, verify ~5s)
 */

import { callClaude, ClaudeResponse } from '@/lib/claude';
import { checkBudget, recordUsage, estimateCost, loadBudgetConfig } from '@/lib/budget';
import type { AgentProgressEvent, ParsedOpportunity } from '@/agents/base-agent';
import { harvestBuyIntents } from './harvester';
import { findSourcesForIntents, MatchedOpportunity } from './sourcer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BuyerIntentConfig {
  agentType: 'buyer-intent';
  apiKey: string;
  tavilyApiKey: string;
}

export interface BuyerIntentResult {
  success: boolean;
  opportunities: ParsedOpportunity[];
  reasoning: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolCalls: number;
  estimatedCost: number;
  error?: string;
  abortReason?: string;
  scoutStats?: {
    intentsFound: number;
    intentsSearched: number;
    matchesFound: number;
    tavilySearches: number;
    sourcesChecked: string[];
    diagnostics: Array<{ source: string; status: string; itemCount: number }>;
  };
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

export async function runBuyerIntentPipeline(
  config: BuyerIntentConfig,
  _userConfig: Record<string, unknown>,
  onProgress?: (event: AgentProgressEvent) => void,
): Promise<BuyerIntentResult> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 4-minute timeout
  const runTimeout = setTimeout(() => {
    onProgress?.({ type: 'error', message: 'Agent run timed out after 4 minutes.' });
  }, 240000);

  try {
    // ── Phase 1: HARVEST (free — Reddit swap subs) ──────────────────

    onProgress?.({
      type: 'scouting',
      message: 'Harvesting buy-intent posts from 14 Reddit swap subs (100 posts each)...',
    });

    const harvest = await harvestBuyIntents();

    const pricedCount = harvest.intents.filter(i => i.hasStatedPrice).length;
    const pricelessCount = harvest.intents.length - pricedCount;

    // Build source breakdown
    const sourceCounts = new Map<string, number>();
    for (const intent of harvest.intents) {
      sourceCounts.set(intent.source, (sourceCounts.get(intent.source) || 0) + 1);
    }
    const sourceBreakdown = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([src, cnt]) => `${cnt} from ${src}`)
      .join(', ');

    onProgress?.({
      type: 'scouting',
      message: `Found ${harvest.intents.length} buy-intent posts (${pricedCount} with price, ${pricelessCount} without). ${sourceBreakdown}.`,
      data: { intents: harvest.intents.length, priced: pricedCount, priceless: pricelessCount },
    });

    if (harvest.intents.length === 0) {
      clearTimeout(runTimeout);
      onProgress?.({ type: 'completed', message: 'No buy-intent posts found. Try again later.' });

      return {
        success: true,
        opportunities: [],
        reasoning: 'No buy-intent posts found in any subreddit within the 72h window.',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolCalls: 0,
        estimatedCost: 0,
        scoutStats: {
          intentsFound: 0,
          intentsSearched: 0,
          matchesFound: 0,
          tavilySearches: 0,
          sourcesChecked: harvest.diagnostics.map(d => d.source),
          diagnostics: harvest.diagnostics,
        },
      };
    }

    // ── Phase 2: SOURCE (Tavily — up to 50 searches) ──────────────────

    const searchCount = Math.min(harvest.intents.length, 50);

    onProgress?.({
      type: 'scouting',
      message: `Searching for source listings across ${searchCount} buy intents (~$${(searchCount * 0.001).toFixed(2)} Tavily cost)...`,
    });

    const sourceResult = await findSourcesForIntents(
      harvest.intents,
      config.tavilyApiKey,
      (msg) => onProgress?.({ type: 'scouting', message: msg }),
    );

    onProgress?.({
      type: 'scouting',
      message: `Found ${sourceResult.matched.length} profitable matches from ${searchCount} searches (${sourceResult.tavilyCallCount} Tavily calls).`,
      data: { matches: sourceResult.matched.length, tavilyCalls: sourceResult.tavilyCallCount },
    });

    if (sourceResult.matched.length === 0) {
      clearTimeout(runTimeout);
      onProgress?.({
        type: 'completed',
        message: `Searched ${searchCount} buy intents (${sourceResult.tavilyCallCount} Tavily calls) — no profitable matches found.`,
      });

      return {
        success: true,
        opportunities: [],
        reasoning: `Searched ${searchCount} buy intents — source prices were at or above buyer prices after fees.`,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolCalls: 0,
        estimatedCost: sourceResult.tavilyCallCount * 0.001,
        scoutStats: {
          intentsFound: harvest.intents.length,
          intentsSearched: searchCount,
          matchesFound: 0,
          tavilySearches: sourceResult.tavilyCallCount,
          sourcesChecked: [...harvest.diagnostics, ...sourceResult.diagnostics].map(d => d.source),
          diagnostics: [...harvest.diagnostics, ...sourceResult.diagnostics],
        },
      };
    }

    // ── Phase 3: VERIFY (Claude — only if matches found) ──────────────

    const budgetConfig = await loadBudgetConfig();
    const budget = await checkBudget(budgetConfig);
    if (!budget.allowed) {
      clearTimeout(runTimeout);
      return {
        success: false,
        opportunities: [],
        reasoning: '',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolCalls: 0,
        estimatedCost: sourceResult.tavilyCallCount * 0.001,
        abortReason: `Daily token budget exceeded (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()})`,
      };
    }

    onProgress?.({
      type: 'calling_claude',
      message: `Sending ${sourceResult.matched.length} matches to Claude for verification...`,
    });

    const verifyPrompt = buildVerificationPrompt(sourceResult.matched);

    const response = await callClaude(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: VERIFY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: verifyPrompt }],
      },
      config.apiKey,
    );

    totalInputTokens = response.usage.input_tokens;
    totalOutputTokens = response.usage.output_tokens;
    await recordUsage('buyer-intent', totalInputTokens, totalOutputTokens, 0);

    const opportunities = parseOpportunities(response);
    const claudeCost = estimateCost(totalInputTokens, totalOutputTokens);
    const totalCost = claudeCost + (sourceResult.tavilyCallCount * 0.001);

    clearTimeout(runTimeout);

    onProgress?.({
      type: 'completed',
      message: `Verified ${opportunities.length} opportunities from ${sourceResult.matched.length} matches. ${sourceResult.tavilyCallCount} Tavily searches + ${totalInputTokens + totalOutputTokens} tokens = $${totalCost.toFixed(4)}.`,
      data: { opportunities: opportunities.length, tokens: totalInputTokens + totalOutputTokens, cost: totalCost },
    });

    return {
      success: true,
      opportunities,
      reasoning: extractReasoning(response),
      totalInputTokens,
      totalOutputTokens,
      totalToolCalls: 1,
      estimatedCost: totalCost,
      scoutStats: {
        intentsFound: harvest.intents.length,
        intentsSearched: searchCount,
        matchesFound: sourceResult.matched.length,
        tavilySearches: sourceResult.tavilyCallCount,
        sourcesChecked: [...harvest.diagnostics, ...sourceResult.diagnostics].map(d => d.source),
        diagnostics: [...harvest.diagnostics, ...sourceResult.diagnostics],
      },
    };

  } catch (err) {
    clearTimeout(runTimeout);
    const error = err instanceof Error ? err.message : String(err);
    onProgress?.({ type: 'error', message: error });

    return {
      success: false,
      opportunities: [],
      reasoning: '',
      totalInputTokens,
      totalOutputTokens,
      totalToolCalls: 0,
      estimatedCost: estimateCost(totalInputTokens, totalOutputTokens),
      error,
    };
  }
}

// ─── Claude Verification ─────────────────────────────────────────────────────

const VERIFY_SYSTEM_PROMPT = `You are verifying arbitrage opportunities from Reddit buy-intent posts.

Each match pairs a REAL BUYER (someone on Reddit who posted wanting to buy a specific item) with a SOURCE LISTING (the same item available on a marketplace for a lower price).

Your job is to verify each match and output structured opportunities.

For each match, check:
1. PRODUCT MATCH — Is the source listing the same product the buyer wants? Same brand, model, specs.
2. CONDITION — Note any condition mismatches in riskNotes.
3. FEES — PayPal G&S (3.49% + $0.49) + shipping. Adjust if our estimates seem wrong.
4. CONFIDENCE — Score 0-100.

Be GENEROUS — include matches where the product is reasonably identifiable. The user makes the final decision. Include anything that looks like it could be profitable, even if uncertain.`;

function buildVerificationPrompt(matches: MatchedOpportunity[]): string {
  // Cap at 20 matches to keep prompt size reasonable
  const topMatches = matches.slice(0, 20);

  const matchSummaries = topMatches.map((m, i) => {
    const priceType = m.estimatedMarketPrice
      ? `(est. market price: $${(m.estimatedMarketPrice / 100).toFixed(2)})`
      : `(buyer stated: $${(m.buyIntent.maxPrice / 100).toFixed(2)})`;

    return `[Match ${i + 1}]
BUYER: wants "${m.buyIntent.itemWanted}" ${priceType}
  - Source: ${m.buyIntent.source} (u/${m.buyIntent.buyerUsername}, ${m.buyIntent.buyerTradeCount} trades)
  - Post: ${m.buyIntent.postUrl}
  - Age: ${m.buyIntent.postAge}h, Location: ${m.buyIntent.location}
SOURCE: "${m.sourceListing.title}" for $${(m.sourceListing.price / 100).toFixed(2)} on ${m.sourceListing.marketplace}
  - URL: ${m.sourceListing.url}
FEES: PayPal $${(m.fees.paypalFee / 100).toFixed(2)} + Ship $${(m.fees.shippingCost / 100).toFixed(2)} = $${(m.fees.total / 100).toFixed(2)}
EST. PROFIT: $${(m.estimatedProfit / 100).toFixed(2)}`;
  }).join('\n\n');

  return `Verify these ${topMatches.length} buy-intent matches and output structured opportunities.

${matchSummaries}

Return verified opportunities as a JSON array wrapped in <opportunities> tags:
<opportunities>
[
  {
    "title": "Short descriptive title of what you're flipping",
    "description": "Buyer on r/hardwareswap wants X. Available on eBay for $Z.",
    "buyPrice": 65000,
    "buySource": "eBay",
    "buyUrl": "https://...",
    "sellPrice": 80000,
    "sellSource": "r/hardwareswap",
    "sellUrl": "https://reddit.com/...",
    "sellPriceType": "verified",
    "estimatedProfit": 10000,
    "fees": {
      "paymentProcessing": 2843,
      "shippingCost": 1500,
      "total": 4343
    },
    "confidence": 75,
    "riskNotes": ["Buyer may have already purchased", "Condition not specified"],
    "reasoning": "Why this is a real opportunity...",
    "buyerUsername": "techbuyer123",
    "buyerTradeCount": 25,
    "postAge": 3
  }
]
</opportunities>

IMPORTANT:
- All prices in CENTS.
- buyPrice = what you PAY to the source (the lower price)
- sellPrice = what the BUYER will pay you (the higher price)
- sellPriceType: "verified" if buyer stated their price, "estimated" if we estimated market price
- buySource = marketplace where you buy (eBay, Amazon, etc.)
- sellSource = subreddit where the buyer is
- PREFER to include matches rather than exclude them — let the user decide
- If a match looks like it could be a different product, include it but lower confidence and add a riskNote`;
}

// ─── Response Parsing ────────────────────────────────────────────────────────

function parseOpportunities(response: ClaudeResponse): ParsedOpportunity[] {
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n');

  const match = text.match(/<opportunities>\s*([\s\S]*?)\s*<\/opportunities>/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (o: Record<string, unknown>) =>
          o.title &&
          typeof o.buyPrice === 'number' &&
          typeof o.sellPrice === 'number' &&
          o.buySource &&
          o.sellSource,
      )
      .map((o: Record<string, unknown>) => ({
        ...o,
        sellPriceType: o.sellPriceType || 'verified',
        buyerUsername: o.buyerUsername || undefined,
        buyerTradeCount: typeof o.buyerTradeCount === 'number' ? o.buyerTradeCount : undefined,
        postAge: typeof o.postAge === 'number' ? o.postAge : undefined,
      })) as ParsedOpportunity[];
  } catch {
    return [];
  }
}

function extractReasoning(response: ClaudeResponse): string {
  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n');
}
