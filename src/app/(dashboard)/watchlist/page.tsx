import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { EmptyState } from '@/components/shared/empty-state';
import { mockOpportunities } from '@/lib/mock-data';

export default function WatchlistPage() {
  const savedOpps = mockOpportunities.filter(o => o.status === 'saved');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Watchlist</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Opportunities you&apos;re tracking. Agents will re-check prices periodically.
        </p>
      </div>

      {savedOpps.length === 0 ? (
        <EmptyState
          icon="👁"
          title="Nothing on your watchlist"
          description="Save opportunities to track price changes and get alerts when spreads widen."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {savedOpps.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
