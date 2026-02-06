import { StatCard } from '@/components/dashboard/stat-card';
import { AgentCard } from '@/components/agents/agent-card';
import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { mockAgents, mockOpportunities } from '@/lib/mock-data';
import { formatCents } from '@/lib/utils';

export default function DashboardHome() {
  const newOpps = mockOpportunities.filter(o => o.status === 'new');
  const totalProfit = mockOpportunities.reduce((sum, o) => sum + o.estimatedProfit, 0);
  const runningAgents = mockAgents.filter(a => a.status === 'running');
  const topOpp = mockOpportunities.reduce((best, o) =>
    o.estimatedProfit > best.estimatedProfit ? o : best
  , mockOpportunities[0]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Dashboard</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          {runningAgents.length} agent{runningAgents.length !== 1 ? 's' : ''} running · {newOpps.length} new opportunities
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New Opportunities"
          value={newOpps.length.toString()}
          accentColor="var(--color-accent)"
        />
        <StatCard
          label="Est. Total Profit"
          value={formatCents(totalProfit)}
          accentColor="var(--color-profit)"
        />
        <StatCard
          label="Agents Running"
          value={`${runningAgents.length} / ${mockAgents.length}`}
        />
        <StatCard
          label="Top Opportunity"
          value={formatCents(topOpp.estimatedProfit)}
          detail={topOpp.title}
          accentColor="var(--color-accent)"
        />
      </div>

      {/* Agent Grid */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Your Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mockAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Recent Opportunities */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Recent Opportunities</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mockOpportunities
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 6)
            .map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
        </div>
      </div>
    </div>
  );
}
