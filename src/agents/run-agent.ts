/**
 * Unified agent runner — dispatches to the appropriate pipeline.
 *
 * - buyer-intent: harvest Reddit/Craigslist buy posts → find source → verify
 * - all others: scout-then-snipe (legacy agents, currently disabled)
 */

import { AgentType } from '@/types';
import { AgentProgressEvent } from './base-agent';
import { runScoutThenSnipe, ScoutSnipeResult } from './scout/runner';
import { runBuyerIntentPipeline, BuyerIntentResult } from './buyer-intent/runner';

// Re-export for compatibility with existing stream API
export type { AgentProgressEvent };

export interface RunAgentParams {
  agentType: AgentType;
  apiKey: string;
  tavilyApiKey: string;
  config: {
    categories?: string[];
    minProfitCents?: number;
    region?: string;
    pairs?: string[];
    minSpreadPercent?: number;
    eventTypes?: string[];
  };
}

export async function dispatchAgentRun(
  params: RunAgentParams,
  onProgress?: (event: AgentProgressEvent) => void,
): Promise<ScoutSnipeResult | BuyerIntentResult> {
  const { agentType, apiKey, tavilyApiKey, config } = params;

  // Route buyer-intent to the new pipeline
  if (agentType === 'buyer-intent') {
    return runBuyerIntentPipeline(
      { agentType: 'buyer-intent', apiKey, tavilyApiKey },
      config,
      onProgress,
    );
  }

  // Legacy agents use scout-then-snipe
  return runScoutThenSnipe(
    { agentType, apiKey, tavilyApiKey },
    config,
    onProgress,
  );
}
