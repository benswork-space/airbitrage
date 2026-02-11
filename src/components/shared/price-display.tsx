import { formatCents } from '@/lib/utils';
import type { SellPriceType, AgentType } from '@/types';

interface PriceDisplayProps {
  buyPrice: number;
  sellPrice: number;
  buySource: string;
  sellSource: string;
  sellPriceType?: SellPriceType;
  agentType?: AgentType;
}

export function PriceDisplay({ buyPrice, sellPrice, buySource, sellSource, sellPriceType, agentType }: PriceDisplayProps) {
  const isBuyerIntent = agentType === 'buyer-intent';

  // Color and prefix based on sell price reliability
  const sellColor = sellPriceType === 'verified'
    ? 'text-[var(--color-profit)]'
    : sellPriceType === 'research_needed'
      ? 'text-[var(--text-tertiary)]'
      : 'text-[var(--color-warning)]'; // estimated

  const sellPrefix = sellPriceType === 'estimated' ? '~' : '';

  const sellLabel = sellPriceType === 'verified'
    ? sellSource
    : sellPriceType === 'research_needed'
      ? `${sellSource} (unverified)`
      : `${sellSource} (est.)`;

  // Buy-intent: "Source → Buyer" (you buy from source, sell to buyer)
  const leftLabel = isBuyerIntent ? 'Source' : buySource;
  const rightLabel = isBuyerIntent ? 'Buyer' : undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="font-mono-numbers text-sm font-semibold text-[var(--text-primary)]">
          {formatCents(buyPrice)}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          {leftLabel}
          {isBuyerIntent && <span className="block text-[9px] opacity-70">{buySource}</span>}
        </div>
      </div>
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
        <path d="M0 6h16m0 0l-4-4m4 4l-4 4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-center">
        <div className={`font-mono-numbers text-sm font-semibold ${sellColor}`}>
          {sellPrefix}{formatCents(sellPrice)}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          {rightLabel || sellLabel}
          {isBuyerIntent && <span className="block text-[9px] opacity-70">{sellSource}</span>}
        </div>
      </div>
    </div>
  );
}
