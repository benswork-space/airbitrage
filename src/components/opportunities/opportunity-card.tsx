import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBar } from '@/components/shared/confidence-bar';
import { PriceDisplay } from '@/components/shared/price-display';
import { formatCents, timeAgo, timeUntil } from '@/lib/utils';
import { Opportunity, AGENT_TYPES } from '@/types';

interface OpportunityCardProps {
  opportunity: Opportunity;
  showAgentType?: boolean;
}

export function OpportunityCard({ opportunity, showAgentType = true }: OpportunityCardProps) {
  const agentInfo = AGENT_TYPES[opportunity.agentType];

  return (
    <Card hover className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {showAgentType && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)]"
                style={{ background: agentInfo.color + '18', color: agentInfo.color }}
              >
                {agentInfo.icon} {agentInfo.shortName}
              </span>
            )}
            {opportunity.status === 'new' && <Badge variant="accent">New</Badge>}
            {opportunity.status === 'saved' && <Badge variant="default">Saved</Badge>}
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {opportunity.title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono-numbers text-sm font-bold text-[var(--color-profit)]">
            +{formatCents(opportunity.estimatedProfit)}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)]">est. profit</div>
        </div>
      </div>

      <PriceDisplay
        buyPrice={opportunity.buyPrice}
        sellPrice={opportunity.sellPrice}
        buySource={opportunity.buySource}
        sellSource={opportunity.sellSource}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-[160px]">
          <ConfidenceBar value={opportunity.confidence} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
          <span>{timeAgo(opportunity.createdAt)}</span>
          {opportunity.expiresAt && (
            <>
              <span>·</span>
              <span className="text-[var(--color-warning)]">
                expires {timeUntil(opportunity.expiresAt)}
              </span>
            </>
          )}
        </div>
      </div>

      {opportunity.riskNotes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opportunity.riskNotes.slice(0, 2).map((note, i) => (
            <span key={i} className="text-[10px] text-[var(--color-warning)] bg-[var(--color-warning-dim)] px-1.5 py-0.5 rounded">
              ⚠ {note}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
