import { Goal, Square, ArrowLeftRight } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/**
 * Football match timeline (Module 8): a 0–90' axis with each goal / card / sub
 * pinned to its minute, Team A above the line and Team B below it.
 */
export default function MatchTimeline({ goals = [], cards = [], substitutions = [], teamA, teamB, teamsById = {} }) {
  const compact = useMediaQuery('(max-width: 639px)');
  const events = [
    ...goals.map((g, i) => {
      const isOG = g.type === 'ownGoal';
      // An own goal counts for the opponent on the scoreboard, so it must appear
      // on the opponent's row — consistent with the tally used everywhere else.
      const team = isOG
        ? (String(g.team) === String(teamA) ? String(teamB) : String(teamA))
        : String(g.team);
      return { key: `g${i}`, team, minute: g.minute, kind: isOG ? 'owngoal' : 'goal',
        label: `${g.scorer || 'Goal'}${isOG ? ' (OG)' : g.type === 'penalty' ? ' (pen)' : ''}` };
    }),
    ...cards.map((c, i) => ({ key: `c${i}`, team: String(c.team), minute: c.minute, kind: c.type === 'red' ? 'red' : 'yellow',
      label: `${c.player || 'Card'} · ${c.type}` })),
    ...substitutions.map((s, i) => ({ key: `s${i}`, team: String(s.team), minute: s.minute, kind: 'sub',
      label: `${s.playerIn || 'in'} ↔ ${s.playerOut || 'out'}` })),
  ].filter((e) => e.minute != null);

  if (!events.length) return null;

  const maxMin = Math.max(90, ...events.map((e) => Number(e.minute) || 0));
  const aId = String(teamA);
  const pct = (m) => `${Math.min(100, (Number(m) / maxMin) * 100)}%`;
  const markerSpread = compact ? 11 : 16;

  const Marker = ({ e }) => {
    const common = 'flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background';
    if (e.kind === 'goal') return <span className={`${common} bg-accent text-accent-foreground`}><Goal className="h-3 w-3" /></span>;
    if (e.kind === 'owngoal') return <span className={`${common} bg-destructive/70 text-white`}><Goal className="h-3 w-3" /></span>;
    if (e.kind === 'sub') return <span className={`${common} bg-secondary text-foreground`}><ArrowLeftRight className="h-2.5 w-2.5" /></span>;
    return <span className={`${common} ${e.kind === 'red' ? 'bg-destructive' : 'bg-[hsl(var(--warning))]'} text-white`}><Square className="h-2.5 w-2.5" /></span>;
  };

  const Row = ({ teamId, above }) => {
    const list = events.filter((e) => e.team === teamId);
    // Events on the same minute would stack on the exact same spot; fan them out
    // horizontally (centred on the minute) so each marker stays readable.
    const byMinute = new Map();
    for (const e of list) {
      const k = String(e.minute);
      if (!byMinute.has(k)) byMinute.set(k, []);
      byMinute.get(k).push(e);
    }
    return (
      <div className={cn('relative', compact ? 'h-10' : 'h-9')}>
        {list.map((e) => {
          const group = byMinute.get(String(e.minute));
          const idx = group.indexOf(e);
          const offset = (idx - (group.length - 1) / 2) * markerSpread;
          return (
            <div
              key={e.key}
              className="absolute -translate-x-1/2"
              style={{ left: pct(e.minute), marginLeft: `${offset}px`, zIndex: idx + 1, [above ? 'bottom' : 'top']: 0 }}
              title={`${e.minute}' — ${e.label}`}
            >
              <Marker e={e} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="surface-elevated w-full rounded-2xl border border-border/70 p-4">
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className={cn(compact && 'min-w-[30rem]')}>
          <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
            <span>{teamsById[aId]?.shortCode || 'A'}</span>
            <span>{teamsById[String(teamB)]?.shortCode || 'B'}</span>
          </div>
          <Row teamId={aId} above />
          <div className="relative h-px bg-border/85">
            {[0, 15, 30, 45, 60, 75, 90].filter((m) => m <= maxMin).map((m) => (
              <span
                key={m}
                className={cn(
                  'absolute -translate-x-1/2 -top-2 tabular-nums text-muted-foreground',
                  compact ? 'text-[11px]' : 'text-[10px]'
                )}
                style={{ left: pct(m) }}
              >
                {m}'
              </span>
            ))}
          </div>
          <Row teamId={String(teamB)} above={false} />
        </div>
      </div>
    </div>
  );
}
