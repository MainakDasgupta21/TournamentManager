import { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Strip a lineup selection down to what's worth persisting: `{ teamA, teamB }`
 * of player ids, or `undefined` when nothing is selected (so the result simply
 * has no `lineups` and the server falls back to its appearance heuristic).
 */
export function cleanLineups(value) {
  const a = [...new Set((value?.teamA ?? []).filter(Boolean))];
  const b = [...new Set((value?.teamB ?? []).filter(Boolean))];
  if (!a.length && !b.length) return undefined;
  return { teamA: a, teamB: b };
}

/** Seed picker state from an existing fixture result's stored lineups. */
export function lineupsFromResult(result) {
  return {
    teamA: (result?.lineups?.teamA ?? []).map(String),
    teamB: (result?.lineups?.teamB ?? []).map(String),
  };
}

function SideColumn({ team, players, selected, onToggle }) {
  const sel = new Set(selected);
  return (
    <div className="space-y-1.5">
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {team?.name ?? 'Team'} · {sel.size}
      </p>
      {players.length === 0 ? (
        <p className="text-xs text-muted-foreground">No roster players.</p>
      ) : (
        <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
          {players.map((p) => (
            <label
              key={p._id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-secondary/50',
                sel.has(p._id) && 'bg-secondary/60'
              )}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={sel.has(p._id)}
                onChange={() => onToggle(p._id)}
              />
              <span className="truncate">
                {p.jerseyNumber != null ? `${p.jerseyNumber}. ` : ''}{p.name}
              </span>
              {p.role && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{p.role}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Optional Playing XI selector, collapsed by default so it never slows a quick
 * result. `value` is `{ teamA: string[], teamB: string[] }`; `onChange` receives
 * the next value. Naming the XI makes appearances and clean sheets exact.
 */
export default function LineupPicker({ teamA, teamB, rosterByTeam, value, onChange, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = (value?.teamA?.length || 0) + (value?.teamB?.length || 0);

  const toggle = (slot, pid) => {
    const cur = new Set(value?.[slot] ?? []);
    if (cur.has(pid)) cur.delete(pid);
    else cur.add(pid);
    onChange({ ...value, [slot]: [...cur] });
  };

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        Playing XI <span className="font-normal text-muted-foreground">(optional)</span>
        {count > 0 && <span className="ml-auto text-xs text-muted-foreground">{count} selected</span>}
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border/60 p-3 sm:grid-cols-2">
          <SideColumn
            team={teamA}
            players={rosterByTeam?.[teamA?._id] ?? []}
            selected={value?.teamA ?? []}
            onToggle={(pid) => toggle('teamA', pid)}
          />
          <SideColumn
            team={teamB}
            players={rosterByTeam?.[teamB?._id] ?? []}
            selected={value?.teamB ?? []}
            onToggle={(pid) => toggle('teamB', pid)}
          />
        </div>
      )}
    </div>
  );
}
