import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'accent' | 'profit' | 'warning' | 'danger';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  accent: 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] border-[var(--color-accent)]',
  profit: 'bg-[var(--color-profit-dim)] text-[var(--color-profit)] border-[var(--color-profit)]',
  warning: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-[var(--color-danger)]',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-full)] border px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
