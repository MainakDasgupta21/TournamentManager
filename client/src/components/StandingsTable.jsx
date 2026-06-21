import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TeamCrest } from '@/components/ui/misc';
import { FormPills } from '@/components/FormPills';
import { cn } from '@/lib/utils';

/** Full names for the abbreviated stat columns (native `<abbr>` tooltips + a11y). */
const COL_TITLES = {
  P: 'Played',
  W: 'Won',
  D: 'Drawn',
  T: 'Tied',
  L: 'Lost',
  NR: 'No result',
  NRR: 'Net run rate',
  GF: 'Goals for',
  GA: 'Goals against',
  GD: 'Goal difference',
  Pts: 'Points',
};

/**
 * Auto-updating group standings. Columns adapt to the sport, and rows animate
 * (Framer Motion `layout`) when ranks change after a result comes in. Pass
 * `formByTeam` ({ [teamId]: [{result}] }) to show a last-5 form column.
 */
export default function StandingsTable({
  tournamentId,
  sport,
  rows = [],
  qualifiers = 0,
  formByTeam,
  compact = false,
  caption,
}) {
  const isCricket = sport === 'cricket';

  const allCols = isCricket
    ? [
        ['P', 'played'],
        ['W', 'won'],
        ['T', 'drawn'],
        ['L', 'lost'],
        ['NR', 'noResult'],
        ['NRR', 'netRunRate'],
        ['Pts', 'points'],
      ]
    : [
        ['P', 'played'],
        ['W', 'won'],
        ['D', 'drawn'],
        ['L', 'lost'],
        ['GF', 'goalsFor'],
        ['GA', 'goalsAgainst'],
        ['GD', 'goalDifference'],
        ['Pts', 'points'],
      ];

  // The summary view keeps only the columns people scan first; the full
  // breakdown shows every stat.
  const compactKeys = isCricket
    ? ['played', 'won', 'netRunRate', 'points'] // P, W, NRR, Pts
    : ['played', 'won', 'goalDifference', 'points']; // P, W, GD, Pts
  const cols = compact ? allCols.filter(([, key]) => compactKeys.includes(key)) : allCols;

  const columnVisibility = (key) => {
    if (compact) return '';
    if (['drawn', 'lost'].includes(key)) return 'hidden sm:table-cell';
    if (isCricket && key === 'noResult') return 'hidden md:table-cell';
    if (!isCricket && ['goalsFor', 'goalsAgainst'].includes(key)) return 'hidden md:table-cell';
    return '';
  };

  // In compact mode the reduced set fits without horizontal scrolling, so the
  // #/Team columns don't need to be frozen (dropping the opaque bg also removes
  // the seam against the panel's elevated surface).
  const frozenRank = compact ? '' : 'sticky left-0 z-10 bg-card';
  const frozenTeam = compact ? '' : 'sticky left-10 z-10 bg-card';
  const cellY = compact ? 'py-2' : 'py-2.5';
  const showCutline = !compact && qualifiers > 0 && qualifiers < rows.length;

  const fmt = (key, val) => {
    if (key === 'netRunRate') return (val > 0 ? '+' : '') + Number(val).toFixed(3);
    if (key === 'goalDifference') return (val > 0 ? '+' : '') + val;
    return val;
  };

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
            <th scope="col" className={cn('w-10 px-2 py-3 text-left font-semibold', frozenRank)}>#</th>
            <th scope="col" className={cn('border-r border-border/40 px-2 py-3 text-left font-semibold', frozenTeam)}>Team</th>
            {cols.map(([label, key]) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-2 py-3 text-center font-semibold',
                  columnVisibility(key),
                  label === 'Pts' && 'bg-primary/[0.06] text-foreground'
                )}
              >
                <abbr title={COL_TITLES[label] ?? label} className="cursor-help no-underline">
                  {label}
                </abbr>
              </th>
            ))}
            {formByTeam && (
              <th scope="col" className="hidden px-2 py-3 text-center font-semibold sm:table-cell">Form</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const team = row.teamId;
            const qualified = qualifiers > 0 && i < qualifiers;
            const isCut = showCutline && i === qualifiers - 1;
            const teamForm = formByTeam ? formByTeam[String(team?._id)] ?? [] : [];
            return (
              <motion.tr
                layout
                key={team?._id || row._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'group border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/45',
                  qualified && !compact && 'bg-[hsl(var(--success)/0.045)]',
                  isCut && 'border-b-2 border-b-[hsl(var(--success)/0.45)]'
                )}
              >
                <td
                  className={cn(
                    'px-2',
                    cellY,
                    frozenRank,
                    qualified && 'border-l-2 border-l-[hsl(var(--success))]'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md font-display text-xs font-bold tabular-nums',
                      qualified
                        ? 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]'
                        : 'text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </div>
                </td>
                <td className={cn('border-r border-border/40 px-2', cellY, frozenTeam)}>
                  <Link
                    to={`/t/${tournamentId}/teams/${team?._id}`}
                    className="flex items-center gap-2.5 rounded-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <TeamCrest team={team} size="sm" />
                    <span className="max-w-[40vw] truncate sm:max-w-none">{team?.name}</span>
                  </Link>
                  {teamForm.length > 0 && (
                    <div className="mt-1.5 sm:hidden">
                      <FormPills form={teamForm} size="xs" />
                    </div>
                  )}
                </td>
                {cols.map(([label, key]) => (
                  <td
                    key={label}
                    className={cn(
                      'px-2 text-center tabular-nums',
                      cellY,
                      columnVisibility(key),
                      key === 'points' && 'bg-primary/[0.06] font-bold text-foreground',
                      key !== 'points' && 'text-muted-foreground'
                    )}
                  >
                    {fmt(key, row[key] ?? 0)}
                  </td>
                ))}
                {formByTeam && (
                  <td className={cn('hidden px-2 text-center sm:table-cell', cellY)}>
                    <FormPills form={teamForm} className="justify-center" />
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {qualifiers > 0 && !compact && (
        <p className="mt-3 flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[hsl(var(--success)/0.5)]" />
          Top {qualifiers} advance to the knockout stage
        </p>
      )}
    </div>
  );
}
