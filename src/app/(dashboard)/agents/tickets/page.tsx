import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function TicketsPage() {
  const agent = mockAgents.find(a => a.type === 'tickets');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'tickets');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="tickets" agent={agent} opportunities={opportunities} runs={runs} />;
}
