import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { mockOpportunities, mockAgents, mockRuns } from '@/lib/mock-data';
import { formatCents } from '@/lib/utils';
import { AGENT_TYPES, AgentType } from '@/types';

export default function AnalyticsPage() {
  const totalProfit = mockOpportunities.reduce((sum, o) => sum + o.estimatedProfit, 0);
  const totalRuns = mockRuns.length;
  const totalTokens = mockRuns.reduce((sum, r) => sum + r.tokensUsed, 0);
  const avgConfidence = Math.round(
    mockOpportunities.reduce((sum, o) => sum + o.confidence, 0) / mockOpportunities.length
  );

  // Group opportunities by agent type
  const byAgent = (Object.keys(AGENT_TYPES) as AgentType[]).map((type) => {
    const opps = mockOpportunities.filter(o => o.agentType === type);
    const profit = opps.reduce((sum, o) => sum + o.estimatedProfit, 0);
    return { type, info: AGENT_TYPES[type], count: opps.length, profit };
  }).filter(a => a.count > 0).sort((a, b) => b.profit - a.profit);

  const maxProfit = Math.max(...byAgent.map(a => a.profit));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Analytics</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Performance across all agents</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Est. Profit" value={formatCents(totalProfit)} accentColor="var(--color-profit)" />
        <StatCard label="Opportunities" value={mockOpportunities.length.toString()} accentColor="var(--color-accent)" />
        <StatCard label="Total Runs" value={totalRuns.toString()} />
        <StatCard label="Avg Confidence" value={`${avgConfidence}%`} />
      </div>

      {/* Profit by Agent */}
      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Profit by Agent</h2>
        <div className="space-y-3">
          {byAgent.map((a) => (
            <div key={a.type} className="flex items-center gap-3">
              <span className="text-sm w-6 text-center">{a.info.icon}</span>
              <span className="text-xs text-[var(--text-secondary)] w-24">{a.info.shortName}</span>
              <div className="flex-1 h-6 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-surface)]">
                <div
                  className="h-full rounded-[var(--radius-sm)] transition-all duration-500"
                  style={{
                    width: `${(a.profit / maxProfit) * 100}%`,
                    background: a.info.color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className="font-mono-numbers text-xs text-[var(--text-primary)] w-20 text-right">
                {formatCents(a.profit)}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] w-12 text-right">
                {a.count} opps
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Token Usage */}
      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Agent Costs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockAgents.map((agent) => {
            const info = AGENT_TYPES[agent.type];
            const agentRuns = mockRuns.filter(r => r.agentId === agent.id);
            const agentTokens = agentRuns.reduce((sum, r) => sum + r.tokensUsed, 0);
            const estimatedCost = (agentTokens / 1000000) * 3; // rough estimate

            return (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)]">
                <span className="text-lg">{info.icon}</span>
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-primary)]">{info.shortName}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {agentTokens.toLocaleString()} tokens · ${estimatedCost.toFixed(3)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-numbers text-xs text-[var(--text-primary)]">{agentRuns.length} runs</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
