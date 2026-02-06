'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusDot } from '@/components/shared/status-dot';
import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCents, timeAgo } from '@/lib/utils';
import { Agent, Opportunity, AgentRun, AGENT_TYPES, AgentType } from '@/types';

interface AgentTabViewProps {
  agentType: AgentType;
  agent: Agent | undefined;
  opportunities: Opportunity[];
  runs: AgentRun[];
}

type SubTab = 'feed' | 'controls' | 'history';

export function AgentTabView({ agentType, agent, opportunities, runs }: AgentTabViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('feed');
  const info = AGENT_TYPES[agentType];

  const totalProfit = opportunities.reduce((sum, o) => sum + o.estimatedProfit, 0);
  const newOpps = opportunities.filter(o => o.status === 'new');
  const avgConfidence = opportunities.length > 0
    ? Math.round(opportunities.reduce((sum, o) => sum + o.confidence, 0) / opportunities.length)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-lg"
            style={{ background: info.color + '18' }}
          >
            {info.icon}
          </span>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">{info.name}</h1>
            <p className="text-xs text-[var(--text-tertiary)]">{info.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {agent && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <StatusDot status={agent.status} />
              <span className="capitalize">{agent.status}</span>
              {agent.lastRunAt && <span className="text-[var(--text-tertiary)]">· {timeAgo(agent.lastRunAt)}</span>}
            </div>
          )}
          <Button size="md" disabled={agent?.status === 'running'}>
            {agent?.status === 'running' ? 'Running…' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Opportunities" value={newOpps.length.toString()} detail={`${opportunities.length} total`} accentColor="var(--color-accent)" />
        <StatCard label="Est. Profit" value={formatCents(totalProfit)} accentColor="var(--color-profit)" />
        <StatCard label="Avg Confidence" value={`${avgConfidence}%`} />
        <StatCard label="Runs" value={(agent?.totalRuns ?? 0).toString()} detail={`$${(agent?.lastRunCost ?? 0).toFixed(2)} last cost`} />
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {(['feed', 'controls', 'history'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm capitalize transition-colors relative cursor-pointer ${
              activeTab === tab
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab === 'feed' ? `Feed (${newOpps.length})` : tab}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                style={{ background: info.color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'feed' && (
        <div>
          {opportunities.length === 0 ? (
            <EmptyState
              icon={info.icon}
              title="No opportunities yet"
              description={`Run the ${info.name} to start finding arbitrage opportunities.`}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {opportunities
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} showAgentType={false} />
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Agent Configuration</h3>
            {agent?.config && (
              <div className="space-y-3">
                <ConfigRow label="Categories" value={agent.config.categories.join(', ')} />
                <ConfigRow label="Min Profit" value={formatCents(agent.config.minProfit)} />
                {agent.config.region && <ConfigRow label="Region" value={agent.config.region as string} />}
                <ConfigRow label="Risk Tolerance" value={agent.config.riskTolerance} />
              </div>
            )}
            <Button variant="secondary" size="sm">Edit Configuration</Button>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Schedule</h3>
            {agent?.schedule ? (
              <div className="space-y-3">
                <ConfigRow label="Status" value={agent.schedule.enabled ? 'Active' : 'Paused'} />
                <ConfigRow label="Frequency" value={agent.schedule.interval} />
                {agent.schedule.time && <ConfigRow label="Time" value={agent.schedule.time} />}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">No schedule configured.</p>
            )}
            <Button variant="secondary" size="sm">Edit Schedule</Button>
          </Card>

          <Card className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Sources</h3>
            <div className="flex flex-wrap gap-2">
              {info.sources.map((source) => (
                <Badge key={source} variant="default">{source}</Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {runs.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No runs yet"
              description="Run the agent to see execution history here."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-left font-medium px-4 py-3">Started</th>
                    <th className="text-right font-medium px-4 py-3">Tokens</th>
                    <th className="text-right font-medium px-4 py-3">Tool Calls</th>
                    <th className="text-right font-medium px-4 py-3">Opps Found</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-3">
                        <Badge variant={run.status === 'completed' ? 'profit' : run.status === 'running' ? 'accent' : 'danger'}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{timeAgo(run.startedAt)}</td>
                      <td className="px-4 py-3 text-right font-mono-numbers text-[var(--text-primary)]">{run.tokensUsed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono-numbers text-[var(--text-primary)]">{run.toolCalls}</td>
                      <td className="px-4 py-3 text-right font-mono-numbers text-[var(--text-primary)]">{run.opportunitiesFound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-primary)] capitalize">{value}</span>
    </div>
  );
}
