import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/shared/status-dot';
import { timeAgo } from '@/lib/utils';
import { Agent, AGENT_TYPES } from '@/types';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const info = AGENT_TYPES[agent.type];

  return (
    <Card hover className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm"
            style={{ background: info.color + '18' }}
          >
            {info.icon}
          </span>
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">{info.name}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <StatusDot status={agent.status} />
              <span className="capitalize">{agent.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[var(--text-tertiary)]">Opportunities</div>
          <div className="font-mono-numbers font-medium text-[var(--text-primary)]">{agent.totalOpportunities}</div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)]">Total runs</div>
          <div className="font-mono-numbers font-medium text-[var(--text-primary)]">{agent.totalRuns}</div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)]">Last run</div>
          <div className="text-[var(--text-primary)]">
            {agent.lastRunAt ? timeAgo(agent.lastRunAt) : 'Never'}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-tertiary)]">Cost/run</div>
          <div className="font-mono-numbers text-[var(--text-primary)]">
            ${agent.lastRunCost?.toFixed(2) ?? '—'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link href={`/agents/${agent.type}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            View
          </Button>
        </Link>
        <Button
          variant={agent.status === 'running' ? 'ghost' : 'primary'}
          size="sm"
          disabled={agent.status === 'running'}
          className="flex-1"
        >
          {agent.status === 'running' ? 'Running…' : 'Run Now'}
        </Button>
      </div>
    </Card>
  );
}
