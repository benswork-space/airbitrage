import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function ListingsPage() {
  const agent = mockAgents.find(a => a.type === 'listings');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'listings');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="listings" agent={agent} opportunities={opportunities} runs={runs} />;
}
