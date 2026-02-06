import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function CollectiblesPage() {
  const agent = mockAgents.find(a => a.type === 'collectibles');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'collectibles');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="collectibles" agent={agent} opportunities={opportunities} runs={runs} />;
}
