import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { TeamCrest, EmptyState } from '@/components/ui/misc';
import { celebrate } from '@/lib/celebrate';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function Slot({ team, label, isWinner, dimmed }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 transition-colors',
        isWinner && 'bg-[hsl(var(--success)/0.12)]',
        dimmed && 'opacity-45'
      )}
    >
      {team ? (
        <TeamCrest team={team} size="sm" />
      ) : (
        <div className="h-6 w-6 rounded-md border border-dashed border-border" />
      )}
      <span className={cn('flex-1 truncate text-sm', isWinner && 'font-semibold')}>
        {team?.name || label || 'TBD'}
      </span>
      {isWinner && <Trophy className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
    </div>
  );
}

function MatchupCard({ matchup, roundName, onPick }) {
  const fx = matchup.fixtureId;
  const winnerId = fx?.winner ? String(fx.winner) : null;
  const slotAId = matchup.slotA?._id || matchup.slotA;
  const slotBId = matchup.slotB?._id || matchup.slotB;
  const completed = fx?.status === 'completed';
  const live = fx?.status === 'live';
  // Only show a per-matchup caption when it adds info beyond the column header.
  const caption = matchup.matchupName && matchup.matchupName !== roundName ? matchup.matchupName : null;
  const aName = matchup.slotA?.name || matchup.slotALabel || 'TBD';
  const bName = matchup.slotB?.name || matchup.slotBLabel || 'TBD';

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileHover={onPick ? { y: -2 } : undefined}
      onClick={() => onPick?.(matchup, roundName)}
      tabIndex={onPick ? undefined : -1}
      aria-label={onPick ? `View match details: ${aName} versus ${bName}` : undefined}
      className={cn(
        'surface-elevated surface-interactive block w-full max-w-[min(18rem,88vw)] overflow-hidden rounded-2xl border bg-card/80 text-left transition-colors lg:w-60 lg:max-w-none',
        live ? 'border-destructive/50' : 'border-border/80',
        onPick && 'cursor-pointer hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        !onPick && 'cursor-default'
      )}
    >
      {caption && (
        <p className="border-b border-border/60 bg-secondary/45 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {caption}
        </p>
      )}
      <div className="divide-y divide-border/60">
      <Slot
        team={matchup.slotA}
        label={matchup.slotALabel}
        isWinner={completed && winnerId && String(slotAId) === winnerId}
        dimmed={completed && winnerId && String(slotAId) !== winnerId}
      />
      <Slot
        team={matchup.slotB}
        label={matchup.slotBLabel}
        isWinner={completed && winnerId && String(slotBId) === winnerId}
        dimmed={completed && winnerId && String(slotBId) !== winnerId}
      />
      </div>
    </motion.button>
  );
}

function RoundColumn({ round, roundIndex, totalRounds, onPickMatchup, className, showConnectors = false }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <h4 className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {round.roundName}
      </h4>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {round.matchups.map((m, mi) => (
          <div key={mi} className="relative flex justify-center lg:block">
            {showConnectors && roundIndex > 0 && (
              <span className="pointer-events-none absolute right-full top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-l from-border to-transparent lg:block" />
            )}
            {showConnectors && roundIndex < totalRounds - 1 && (
              <span className="pointer-events-none absolute left-full top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-r from-border to-transparent lg:block" />
            )}
            <MatchupCard matchup={m} roundName={round.roundName} onPick={onPickMatchup} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChampionBanner({ champion }) {
  const fired = useRef(false);
  useEffect(() => {
    if (champion && !fired.current) {
      fired.current = true;
      celebrate();
    }
  }, [champion]);

  if (!champion) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="surface-elevated-strong relative overflow-hidden rounded-3xl border border-[hsl(var(--warning)/0.4)] bg-gradient-to-br from-[hsl(var(--warning)/0.2)] via-card to-card p-6"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-aurora rounded-full bg-[hsl(var(--warning)/0.3)] blur-3xl" />
      <div className="relative flex items-center gap-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--warning)/0.2)]">
          <Trophy className="h-8 w-8 text-[hsl(var(--warning))]" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warning))]">Champions</p>
          <div className="mt-1 flex items-center gap-3">
            <TeamCrest team={champion} size="md" />
            <h3 className="truncate font-display text-3xl tracking-[-0.02em] sm:text-4xl">{champion.name}</h3>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Full bracket: one column per round, third-place playoff shown separately. */
export default function Bracket({ bracket, onPickMatchup }) {
  if (!bracket?.rounds?.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="No knockout bracket yet"
        description="The bracket appears here once the admin generates it from the group standings."
      />
    );
  }

  const mainRounds = bracket.rounds.filter((r) => r.roundName !== 'Third-place playoff');
  const thirdPlace = bracket.rounds.find((r) => r.roundName === 'Third-place playoff');
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

  useEffect(() => {
    if (!mainRounds.length) return;
    if (activeRoundIdx >= mainRounds.length) setActiveRoundIdx(mainRounds.length - 1);
  }, [activeRoundIdx, mainRounds.length]);

  const finalRound = mainRounds.find((r) => r.roundName === 'Final') ?? mainRounds[mainRounds.length - 1];
  const finalMatch = finalRound?.matchups?.[0];
  const finalWinnerId = finalMatch?.fixtureId?.winner ? String(finalMatch.fixtureId.winner) : null;
  const champion = finalWinnerId
    ? [finalMatch.slotA, finalMatch.slotB].find((t) => t && String(t._id) === finalWinnerId)
    : null;

  return (
    <div className="space-y-6">
      <ChampionBanner champion={champion} />

      {mainRounds.length > 1 && (
        <div className="lg:hidden">
          <Select value={String(activeRoundIdx)} onValueChange={(value) => setActiveRoundIdx(Number(value))}>
            <SelectTrigger aria-label="Select bracket round" className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mainRounds.map((round, idx) => (
                <SelectItem key={`${round.roundName}-${idx}`} value={String(idx)}>
                  {round.roundName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="lg:hidden">
        {mainRounds[activeRoundIdx] && (
          <RoundColumn
            round={mainRounds[activeRoundIdx]}
            roundIndex={activeRoundIdx}
            totalRounds={mainRounds.length}
            onPickMatchup={onPickMatchup}
            className="mx-auto w-full max-w-[min(18rem,88vw)]"
          />
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border/65 bg-card/35 p-4 pb-4 scrollbar-thin lg:block">
        <div className="flex min-w-min gap-8">
          {mainRounds.map((round, ri) => (
            <RoundColumn
              key={`${round.roundName}-${ri}`}
              round={round}
              roundIndex={ri}
              totalRounds={mainRounds.length}
              onPickMatchup={onPickMatchup}
              showConnectors
              className="min-w-60"
            />
          ))}
        </div>
      </div>

      {thirdPlace?.matchups?.[0] && (
        <div className="mx-auto w-full max-w-[min(18rem,88vw)] lg:mx-0 lg:max-w-60">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[hsl(var(--warning))]">
            Third-place playoff
          </h4>
          <MatchupCard matchup={thirdPlace.matchups[0]} roundName={thirdPlace.roundName} onPick={onPickMatchup} />
        </div>
      )}
    </div>
  );
}
