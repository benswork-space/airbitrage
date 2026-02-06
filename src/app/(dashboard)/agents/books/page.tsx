import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function BooksPage() {
  const agent = mockAgents.find(a => a.type === 'books');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'books');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="books" agent={agent} opportunities={opportunities} runs={runs} />;
}
