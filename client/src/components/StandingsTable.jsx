import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TeamCrest } from '@/components/ui/misc';
import { FormPills } from '@/components/FormPills';
import { cn } from '@/lib/utils';

/**
 * Auto-updating group standings. Columns adapt to the sport, and rows animate
 * (Framer Motion `layout`) when ranks change after a result comes in. Pass
 * `formByTeam` ({ [teamId]: [{result}] }) to show a last-5 form column.
 */
export default function StandingsTable({ tournamentId, sport, rows = [], qualifiers = 0, formByTeam }) {
  const isCricket = sport === 'cricket';

  const cols = isCricket
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

  const fmt = (key, val) => {
    if (key === 'netRunRate') return (val > 0 ? '+' : '') + Number(val).toFixed(3);
    if (key === 'goalDifference') return (val > 0 ? '+' : '') + val;
    return val;
  };

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 w-10 bg-card px-2 py-3 text-left font-semibold">#</th>
            <th className="sticky left-10 z-10 border-r border-border/40 bg-card px-2 py-3 text-left font-semibold">Team</th>
            {cols.map(([label]) => (
              <th
                key={label}
                className={cn(
                  'whitespace-nowrap px-2 py-3 text-center font-semibold',
                  label === 'Pts' && 'text-foreground'
                )}
              >
                {label}
              </th>
            ))}
            {formByTeam && (
              <th className="hidden px-2 py-3 text-center font-semibold sm:table-cell">Form</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const team = row.teamId;
            const qualified = qualifiers > 0 && i < qualifiers;
            return (
              <motion.tr
                layout
                key={team?._id || row._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="group border-b border-border/50 last:border-0"
              >
                <td className="sticky left-0 z-10 bg-card px-2 py-2.5">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded text-xs font-bold',
                      qualified ? 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]' : 'text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </div>
                </td>
                <td className="sticky left-10 z-10 border-r border-border/40 bg-card px-2 py-2.5">
                  <Link
                    to={`/t/${tournamentId}/teams/${team?._id}`}
                    className="flex items-center gap-2.5 font-medium hover:text-primary"
                  >
                    <TeamCrest team={team} size="sm" />
                    <span className="max-w-[40vw] truncate sm:max-w-none">{team?.name}</span>
                  </Link>
                </td>
                {cols.map(([label, key]) => (
                  <td
                    key={label}
                    className={cn(
                      'px-2 py-2.5 text-center tabular-nums',
                      key === 'points' && 'font-bold text-foreground',
                      key !== 'points' && 'text-muted-foreground'
                    )}
                  >
                    {fmt(key, row[key] ?? 0)}
                  </td>
                ))}
                {formByTeam && (
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <FormPills form={formByTeam[String(team?._id)] ?? []} className="justify-center" />
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {qualifiers > 0 && (
        <p className="mt-3 flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[hsl(var(--success)/0.4)]" />
          Top {qualifiers} qualify for the knockout stage
        </p>
      )}
    </div>
  );
}
