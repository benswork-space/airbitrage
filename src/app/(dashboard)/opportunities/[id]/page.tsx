import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBar } from '@/components/shared/confidence-bar';
import { formatCents } from '@/lib/utils';
import { mockOpportunities } from '@/lib/mock-data';
import { AGENT_TYPES } from '@/types';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = mockOpportunities.find(o => o.id === id);

  if (!opp) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[var(--text-tertiary)]">Opportunity not found.</p>
      </div>
    );
  }

  const agentInfo = AGENT_TYPES[opp.agentType];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)]"
            style={{ background: agentInfo.color + '18', color: agentInfo.color }}
          >
            {agentInfo.icon} {agentInfo.shortName}
          </span>
          <Badge variant={opp.status === 'new' ? 'accent' : 'default'}>{opp.status}</Badge>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{opp.title}</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{opp.description}</p>
      </div>

      {/* Price Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center space-y-1">
          <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Buy</div>
          <div className="font-mono-numbers text-2xl font-bold text-[var(--text-primary)]">
            {formatCents(opp.buyPrice)}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">{opp.buySource}</div>
          <a href={opp.buyUrl} className="inline-block mt-2">
            <Button variant="secondary" size="sm">Open Listing</Button>
          </a>
        </Card>
        <Card className="text-center space-y-1">
          <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Sell</div>
          <div className="font-mono-numbers text-2xl font-bold text-[var(--color-profit)]">
            {formatCents(opp.sellPrice)}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">{opp.sellSource}</div>
          <a href={opp.sellUrl} className="inline-block mt-2">
            <Button variant="secondary" size="sm">Sell Template</Button>
          </a>
        </Card>
      </div>

      {/* Profit Breakdown */}
      <Card className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Profit Breakdown</h2>
        <div className="space-y-2 text-sm">
          <BreakdownRow label="Sell price" value={formatCents(opp.sellPrice)} />
          <BreakdownRow label="Buy price" value={`-${formatCents(opp.buyPrice)}`} negative />
          {opp.fees.platformFee && <BreakdownRow label="Platform fees" value={`-${formatCents(opp.fees.platformFee)}`} negative />}
          {opp.fees.shippingCost && <BreakdownRow label="Shipping est." value={`-${formatCents(opp.fees.shippingCost)}`} negative />}
          {opp.fees.paymentProcessing && <BreakdownRow label="Payment processing" value={`-${formatCents(opp.fees.paymentProcessing)}`} negative />}
          {opp.fees.other && <BreakdownRow label="Other fees" value={`-${formatCents(opp.fees.other)}`} negative />}
          <div className="border-t border-[var(--border-subtle)] pt-2">
            <BreakdownRow label="Net profit" value={`+${formatCents(opp.estimatedProfit)}`} bold profit />
          </div>
        </div>
      </Card>

      {/* Confidence */}
      <Card className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Confidence</h2>
        <ConfidenceBar value={opp.confidence} size="md" />
      </Card>

      {/* Reasoning */}
      <Card className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Agent Reasoning</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic">
          &ldquo;{opp.reasoning}&rdquo;
        </p>
      </Card>

      {/* Risks */}
      {opp.riskNotes.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-warning)]">Risks</h2>
          <ul className="space-y-1.5">
            {opp.riskNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--color-warning)] mt-0.5">&#9888;</span>
                {note}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pb-8">
        <Button variant="primary" size="lg">Save to Watchlist</Button>
        <Button variant="secondary" size="lg">Dismiss</Button>
        <Button variant="ghost" size="lg" className="text-[var(--color-accent)]">I Acted on This</Button>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, negative, bold, profit }: {
  label: string;
  value: string;
  negative?: boolean;
  bold?: boolean;
  profit?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
      <span className={`font-mono-numbers ${bold ? 'font-bold text-base' : ''} ${profit ? 'text-[var(--color-profit)]' : negative ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </span>
    </div>
  );
}
