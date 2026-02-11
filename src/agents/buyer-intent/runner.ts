/**
 * Buy-Intent Pipeline Runner
 *
 * Orchestrates the 3-phase pipeline:
 * 1. HARVEST — fetch buy-intent posts from Reddit + Craigslist (free)
 * 2. SOURCE — find cheaper listings on eBay/Amazon/Mercari (Tavily cost)
 * 3. VERIFY — Claude confirms product match + fees (Claude cost, only if matches found)
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

  // 2-minute timeout
  const runTimeout = setTimeout(() => {
    onProgress?.({ type: 'error', message: 'Agent run timed out after 2 minutes.' });
  }, 120000);

  try {
    // ── Phase 1: HARVEST (free — Reddit swap subs) ──────────────────

    onProgress?.({
      type: 'scouting',
      message: 'Harvesting buy-intent posts from Reddit swap subs...',
    });

    const harvest = await harvestBuyIntents();

    // Build source breakdown for progress message
    const sourceCounts = new Map<string, number>();
    for (const intent of harvest.intents) {
      sourceCounts.set(intent.source, (sourceCounts.get(intent.source) || 0) + 1);
    }
    const sourceBreakdown = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([src, cnt]) => `${cnt} from ${src}`)
      .join(', ');

    onProgress?.({
      type: 'scouting',
      message: `Found ${harvest.intents.length} buy-intent posts${sourceBreakdown ? ` (${sourceBreakdown})` : ''}. Top price: ${harvest.intents[0] ? `$${(harvest.intents[0].maxPrice / 100).toFixed(0)}` : 'N/A'}.`,
      data: { intents: harvest.intents.length, sources: Object.fromEntries(sourceCounts) },
    });

    if (harvest.intents.length === 0) {
      clearTimeout(runTimeout);
      onProgress?.({
        type: 'completed',
        message: 'No buy-intent posts found with prices. Try again later — Reddit posts refresh continuously.',
      });

      return {
        success: true,
        opportunities: [],
        reasoning: 'No buy-intent posts found matching criteria (price >= $50, age <= 48h, price stated in title or body).',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolCalls: 0,
        estimatedCost: 0,
        scoutStats: {
          intentsFound: 0,
          intentsSearched: 0,
          matchesFound: 0,
          sourcesChecked: harvest.diagnostics.map(d => d.source),
          diagnostics: harvest.diagnostics,
        },
      };
    }

    // ── Phase 2: SOURCE (Tavily cost) ──────────────────────────────────

    onProgress?.({
      type: 'scouting',
      message: `Searching for source listings for top ${Math.min(harvest.intents.length, 15)} buy intents...`,
    });

    const sourceResult = await findSourcesForIntents(
      harvest.intents,
      config.tavilyApiKey,
      (msg) => onProgress?.({ type: 'scouting', message: msg }),
    );

    onProgress?.({
      type: 'scouting',
      message: `Found ${sourceResult.matched.length} profitable matches from ${harvest.intents.length} buy-intent posts.`,
      data: { matches: sourceResult.matched.length },
    });

    if (sourceResult.matched.length === 0) {
      clearTimeout(runTimeout);
      onProgress?.({
        type: 'completed',
        message: `Searched ${Math.min(harvest.intents.length, 15)} buy intents — no profitable source listings found. The buyers may be offering fair market prices.`,
      });

      return {
        success: true,
        opportunities: [],
        reasoning: 'No profitable matches found — source prices were at or above buyer prices after fees.',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolCalls: 0,
        estimatedCost: 0,
        scoutStats: {
          intentsFound: harvest.intents.length,
          intentsSearched: Math.min(harvest.intents.length, 15),
          matchesFound: 0,
          sourcesChecked: [...harvest.diagnostics, ...sourceResult.diagnostics].map(d => d.source),
          diagnostics: [...harvest.diagnostics, ...sourceResult.diagnostics],
        },
      };
    }

    // ── Phase 3: VERIFY (Claude cost — only if matches found) ──────────

    // Budget check before calling Claude
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
        estimatedCost: 0,
        abortReason: `Daily token budget exceeded (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()})`,
      };
    }

    onProgress?.({
      type: 'calling_claude',
      message: `Sending ${sourceResult.matched.length} matched opportunities to Claude for verification...`,
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
    const cost = estimateCost(totalInputTokens, totalOutputTokens);

    clearTimeout(runTimeout);

    onProgress?.({
      type: 'completed',
      message: `Verified ${opportunities.length} opportunities from ${sourceResult.matched.length} matches. ${totalInputTokens + totalOutputTokens} tokens ($${cost.toFixed(4)}).`,
      data: { opportunities: opportunities.length, tokens: totalInputTokens + totalOutputTokens, cost },
    });

    return {
      success: true,
      opportunities,
      reasoning: extractReasoning(response),
      totalInputTokens,
      totalOutputTokens,
      totalToolCalls: 1,
      estimatedCost: cost,
      scoutStats: {
        intentsFound: harvest.intents.length,
        intentsSearched: Math.min(harvest.intents.length, 15),
        matchesFound: sourceResult.matched.length,
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

const VERIFY_SYSTEM_PROMPT = `You are verifying arbitrage opportunities from Reddit and Craigslist buy-intent posts.

Each match pairs a REAL BUYER (someone on Reddit/Craigslist who posted wanting to buy a specific item at a stated price) with a SOURCE LISTING (the same item available on a marketplace for a lower price).

Your job is to verify each match and output structured opportunities.

For each match, check:
1. PRODUCT MATCH — Is the source listing the same product the buyer wants? Same brand, model, specs. If the source listing is clearly a different product, skip it.
2. CONDITION — If the buyer wants "new" but the source is "used" (or vice versa), note it in riskNotes.
3. FEES — PayPal G&S (3.49% + $0.49) + shipping. Our estimates may be rough — adjust if clearly wrong.
4. CONFIDENCE — Score 0-100 based on: product match certainty, buyer reputation, profit margin, listing freshness.

Be generous — include matches where the product is reasonably identifiable. The user will make the final decision.`;

function buildVerificationPrompt(matches: MatchedOpportunity[]): string {
  const matchSummaries = matches.map((m, i) => {
    return `[Match ${i + 1}]
BUYER: "${m.buyIntent.itemWanted}" for $${(m.buyIntent.maxPrice / 100).toFixed(2)}
  - Source: ${m.buyIntent.source} (u/${m.buyIntent.buyerUsername}, ${m.buyIntent.buyerTradeCount} trades)
  - Post: ${m.buyIntent.postUrl}
  - Age: ${m.buyIntent.postAge}h, Location: ${m.buyIntent.location}
SOURCE: "${m.sourceListing.title}" for $${(m.sourceListing.price / 100).toFixed(2)} on ${m.sourceListing.marketplace}
  - URL: ${m.sourceListing.url}
FEES: PayPal $${(m.fees.paypalFee / 100).toFixed(2)} + Shipping $${(m.fees.shippingCost / 100).toFixed(2)} = $${(m.fees.total / 100).toFixed(2)}
EST. PROFIT: $${(m.estimatedProfit / 100).toFixed(2)}`;
  }).join('\n\n');

  return `Verify these ${matches.length} buy-intent matches and output structured opportunities.

${matchSummaries}

Return verified opportunities as a JSON array wrapped in <opportunities> tags:
<opportunities>
[
  {
    "title": "Short descriptive title of what you're flipping",
    "description": "Buyer on r/hardwareswap wants X for $Y. Available on eBay for $Z.",
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
- buyPrice = what you PAY to the source marketplace (the lower price)
- sellPrice = what the BUYER on Reddit/Craigslist will pay you (the higher price)
- sellPriceType is always "verified" (the buyer stated their price)
- buySource = marketplace where you buy (eBay, Amazon, etc.)
- sellSource = where the buyer is (r/hardwareswap, craigslist-sfbay, etc.)
- Include buyerUsername, buyerTradeCount, and postAge from the match data
- If the product match is uncertain, reduce confidence and note it in riskNotes
- PREFER to include matches rather than exclude them. Let the user decide.`;
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
