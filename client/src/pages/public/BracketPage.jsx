import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useKnockout } from '@/hooks/queries';
import Bracket from '@/components/Bracket';
import MatchDetail from '@/components/MatchDetail';
import { Skeleton, ErrorState } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';

function BracketSkeleton() {
  return (
    <div className="surface-elevated flex gap-8 overflow-hidden rounded-2xl border border-border/70 p-5">
      {[4, 2, 1].map((count, col) => (
        <div key={col} className="flex flex-1 flex-col justify-around gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-60" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BracketPage() {
  const { tournament, tournamentId, liveStates } = useOutletContext();
  const { data: bracket, isLoading, isError, refetch } = useKnockout(tournamentId);
  const [selected, setSelected] = useState(null);

  // The bracket carries teams as slotA/slotB; synthesise a fixture-shaped object
  // so the shared MatchDetail drawer can render its scorecard. Crucially we keep
  // `_id` as the *real* fixture id (or undefined for an unplayed placeholder) so
  // the drawer only links to Match Center when an actual fixture exists.
  const onPick = (matchup, roundName) => {
    const fx = matchup.fixtureId || {};
    setSelected({
      ...fx,
      _id: fx._id,
      teamA: matchup.slotA || fx.teamA || null,
      teamB: matchup.slotB || fx.teamB || null,
      placeholderA: matchup.slotALabel || fx.placeholderA,
      placeholderB: matchup.slotBLabel || fx.placeholderB,
      roundName: fx.roundName || roundName,
      status: fx.status || 'scheduled',
    });
  };

  return (
    <div>
      <PageHeader
        title="Knockout bracket"
        description="Track every path to the trophy with animated, interactive match cards."
        className="mb-6"
      />
      {isLoading ? (
        <BracketSkeleton />
      ) : isError ? (
        <ErrorState
          title="Couldn't load the bracket"
          description="There was a problem reaching the server. Please try again."
          onRetry={refetch}
        />
      ) : (
        <Bracket bracket={bracket} onPickMatchup={onPick} />
      )}

      <MatchDetail
        fixture={selected}
        sport={tournament.sportType}
        live={selected ? liveStates?.[selected._id] : undefined}
        tournamentId={tournamentId}
        onOpenChange={() => setSelected(null)}
      />
    </div>
  );
}
