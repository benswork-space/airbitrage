'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AGENT_TYPES, AgentType } from '@/types';

const agentOrder: AgentType[] = ['listings', 'auctions', 'crypto', 'retail', 'tickets', 'collectibles', 'books'];

export function AgentTabBar() {
  const pathname = usePathname();
  const isAgentsSection = pathname.startsWith('/agents');

  if (!isAgentsSection) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <div className="flex gap-0 overflow-x-auto px-4" style={{ height: 'var(--tab-bar-height)' }}>
        {agentOrder.map((type) => {
          const info = AGENT_TYPES[type];
          const isActive = pathname === `/agents/${type}`;

          return (
            <Link
              key={type}
              href={`/agents/${type}`}
              className={cn(
                'relative flex items-center gap-2 px-4 text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
            >
              <span>{info.icon}</span>
              <span>{info.shortName}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                  style={{ background: info.color }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
