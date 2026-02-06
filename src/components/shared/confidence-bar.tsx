import { confidenceColor } from '@/lib/utils';

interface ConfidenceBarProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ConfidenceBar({ value, showLabel = true, size = 'sm' }: ConfidenceBarProps) {
  const color = confidenceColor(value);
  const height = size === 'sm' ? '4px' : '6px';

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height, background: 'var(--bg-surface)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span
          className="font-mono-numbers text-xs font-medium"
          style={{ color }}
        >
          {value}%
        </span>
      )}
    </div>
  );
}
