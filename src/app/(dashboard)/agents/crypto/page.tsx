import { AgentTabView } from '@/components/agents/agent-tab-view';
import { mockAgents, mockOpportunities, mockRuns } from '@/lib/mock-data';

export default function CryptoPage() {
  const agent = mockAgents.find(a => a.type === 'crypto');
  const opportunities = mockOpportunities.filter(o => o.agentType === 'crypto');
  const runs = mockRuns.filter(r => r.agentId === agent?.id);

  return <AgentTabView agentType="crypto" agent={agent} opportunities={opportunities} runs={runs} />;
}
