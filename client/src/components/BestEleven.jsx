import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamCrest } from '@/components/ui/misc';

const SLOT_TONE = {
  Batter: 'text-primary',
  'All-rounder': 'text-accent',
  Wicketkeeper: 'text-[hsl(var(--warning))]',
  Bowler: 'text-[hsl(var(--success))]',
  GK: 'text-[hsl(var(--warning))]',
  DEF: 'text-[hsl(var(--success))]',
  MID: 'text-primary',
  FWD: 'text-accent',
};

/**
 * "Team of the Tournament" — an auto-picked best XI. `xi` is the output of
 * `bestEleven(sport, players)`. Players link through to their profile.
 */
export default function BestEleven({ tournamentId, xi }) {
  if (!xi?.players?.length) return null;

  return (
    <Card className="overflow-hidden border-amber-400/30">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
            <Star className="h-5 w-5 text-amber-400" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl leading-none tracking-wide">Team of the Tournament</h2>
            <p className="text-xs text-muted-foreground">Auto-picked best XI from recorded stats</p>
          </div>
          <Badge variant="secondary">{xi.formation}</Badge>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {xi.players.map((p) => (
            <li
              key={p._id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
            >
              <span className={`w-12 shrink-0 text-[10px] font-bold uppercase tracking-wider ${SLOT_TONE[p.slot] ?? 'text-muted-foreground'}`}>
                {p.slot}
              </span>
              <TeamCrest team={p.team} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/t/${tournamentId}/players/${p._id}`}
                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {p.name}
                </Link>
                {p.team && <p className="truncate text-xs text-muted-foreground">{p.team.shortCode}</p>}
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{p.reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
