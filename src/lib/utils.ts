export function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCompactCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 10000) return '$' + (dollars / 1000).toFixed(1) + 'k';
  if (dollars >= 1000) return '$' + (dollars / 1000).toFixed(1) + 'k';
  return '$' + dollars.toFixed(0);
}

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function timeUntil(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((then - now) / 1000);

  if (seconds < 0) return 'expired';
  if (seconds < 60) return '< 1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 80) return 'var(--color-accent)';
  if (confidence >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
