'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/agents/listings', label: 'Agents', icon: AgentsIcon },
  { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { href: '/watchlist', label: 'Watchlist', icon: WatchlistIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-card)]"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="flex items-center gap-2 px-5 h-14 border-b border-[var(--border-subtle)]">
        <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--color-accent)] flex items-center justify-center text-[var(--bg-primary)] font-bold text-sm">
          A
        </div>
        <span className="font-semibold text-[var(--text-primary)] text-sm tracking-tight">
          Airbitrage
        </span>
      </div>

      <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors',
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]',
              )}
            >
              <item.icon active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
            B
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Ben Wallace</div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V13a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 14V9h4v5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AgentsIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.5" />
      <path d="M2 14c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="3" height="6" rx="0.5" stroke={color} strokeWidth="1.5" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.5" stroke={color} strokeWidth="1.5" />
      <rect x="12" y="2" width="3" height="12" rx="0.5" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function WatchlistIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2C4.5 2 2 5 2 8s2.5 6 6 6 6-3 6-6-2.5-6-6-6z" stroke={color} strokeWidth="1.5" />
      <path d="M8 5v3l2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.5" />
      <path d="M8 1v2m0 10v2M1 8h2m10 0h2m-1.5-5l-1.4 1.4M4.9 11.1l-1.4 1.4m0-9l1.4 1.4m6.2 6.2l1.4 1.4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
