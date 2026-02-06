import { formatCents } from '@/lib/utils';

interface PriceDisplayProps {
  buyPrice: number;
  sellPrice: number;
  buySource: string;
  sellSource: string;
}

export function PriceDisplay({ buyPrice, sellPrice, buySource, sellSource }: PriceDisplayProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="font-mono-numbers text-sm font-semibold text-[var(--text-primary)]">
          {formatCents(buyPrice)}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">{buySource}</div>
      </div>
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
        <path d="M0 6h16m0 0l-4-4m4 4l-4 4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-center">
        <div className="font-mono-numbers text-sm font-semibold text-[var(--color-profit)]">
          {formatCents(sellPrice)}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">{sellSource}</div>
      </div>
    </div>
  );
}
