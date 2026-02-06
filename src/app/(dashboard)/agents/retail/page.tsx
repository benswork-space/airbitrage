import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function RetailPage() {
  const agent = mockAgents.find(a => a.type === 'retail');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'retail');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="retail" agent={agent} opportunities={opportunities} runs={runs} />;
}
