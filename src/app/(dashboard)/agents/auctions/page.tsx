import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function AuctionsPage() {
  const agent = mockAgents.find(a => a.type === 'auctions');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'auctions');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="auctions" agent={agent} opportunities={opportunities} runs={runs} />;
}
