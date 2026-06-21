import { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { SPORTS, footballPositionLabel, normalizeFootballPosition } from '@tms/shared/constants';
import { cn } from '@/lib/utils';
import FormationEditor from './FormationEditor';
import {
  formationFromResult as readFormationOverridesFromResult,
  cleanFormationOverrides as normalizeFormationOverrides,
} from '@/lib/formation';

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

export function formationOverridesFromResult(result) {
  return readFormationOverridesFromResult(result);
}

export function cleanFormationOverrides(value) {
  return normalizeFormationOverrides(value);
}

function SideColumn({ team, players, selected, onToggle, sport }) {
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
                <span className="ml-auto text-[10px] tracking-wide text-muted-foreground">
                  {sport === SPORTS.FOOTBALL
                    ? `${normalizeFootballPosition(p.role)} - ${footballPositionLabel(p.role)}`
                    : p.role}
                </span>
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
 * the next value. For football, optional per-side formation overrides can also
 * be edited here without replacing team defaults.
 */
export default function LineupPicker({
  teamA,
  teamB,
  sport = null,
  rosterByTeam,
  value,
  onChange,
  defaultOpen = false,
  showFormationOverrides = false,
  formationOverrides = { teamA: null, teamB: null },
  onFormationOverridesChange,
  defaultFormations = { teamA: null, teamB: null },
}) {
  const [open, setOpen] = useState(defaultOpen);
  const count = (value?.teamA?.length || 0) + (value?.teamB?.length || 0);
  const canEditOverrides = typeof onFormationOverridesChange === 'function';

  const toggle = (slot, pid) => {
    const cur = new Set(value?.[slot] ?? []);
    if (cur.has(pid)) cur.delete(pid);
    else cur.add(pid);
    onChange({ ...value, [slot]: [...cur] });
  };

  const setFormationOverride = (side, formation) => {
    if (!canEditOverrides) return;
    onFormationOverridesChange({
      ...(formationOverrides ?? {}),
      [side]: formation,
    });
  };

  const clearFormationOverride = (side) => {
    if (!canEditOverrides) return;
    const next = { ...(formationOverrides ?? {}) };
    delete next[side];
    onFormationOverridesChange(next);
  };

  const hasOverrides = Boolean(formationOverrides?.teamA || formationOverrides?.teamB);

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
        <div className="space-y-3 border-t border-border/60 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SideColumn
              team={teamA}
              sport={sport}
              players={rosterByTeam?.[teamA?._id] ?? []}
              selected={value?.teamA ?? []}
              onToggle={(pid) => toggle('teamA', pid)}
            />
            <SideColumn
              team={teamB}
              sport={sport}
              players={rosterByTeam?.[teamB?._id] ?? []}
              selected={value?.teamB ?? []}
              onToggle={(pid) => toggle('teamB', pid)}
            />
          </div>

          {showFormationOverrides && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-secondary/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Match tactical override (football)
                </p>
                {hasOverrides ? (
                  <span className="text-xs text-muted-foreground">Custom match shape active</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Using saved team defaults</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Override only this fixture. Use assign mode for player swaps and edit mode to drag
                tactical cards freely on the pitch.
              </p>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-border/70 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {teamA?.name ?? 'Team A'}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={() => clearFormationOverride('teamA')}
                      disabled={!formationOverrides?.teamA || !canEditOverrides}
                    >
                      Use default
                    </button>
                  </div>
                  <FormationEditor
                    compact
                    roster={rosterByTeam?.[teamA?._id] ?? []}
                    value={formationOverrides?.teamA ?? defaultFormations?.teamA ?? null}
                    onChange={(next) => setFormationOverride('teamA', next)}
                    disabled={!canEditOverrides}
                    title="Team A shape"
                    description={
                      formationOverrides?.teamA
                        ? 'Override active for this fixture.'
                        : defaultFormations?.teamA
                          ? 'Start editing to create a fixture-only override.'
                          : 'No team default found. Build a fixture-only shape.'
                    }
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {teamB?.name ?? 'Team B'}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={() => clearFormationOverride('teamB')}
                      disabled={!formationOverrides?.teamB || !canEditOverrides}
                    >
                      Use default
                    </button>
                  </div>
                  <FormationEditor
                    compact
                    roster={rosterByTeam?.[teamB?._id] ?? []}
                    value={formationOverrides?.teamB ?? defaultFormations?.teamB ?? null}
                    onChange={(next) => setFormationOverride('teamB', next)}
                    disabled={!canEditOverrides}
                    title="Team B shape"
                    description={
                      formationOverrides?.teamB
                        ? 'Override active for this fixture.'
                        : defaultFormations?.teamB
                          ? 'Start editing to create a fixture-only override.'
                          : 'No team default found. Build a fixture-only shape.'
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
