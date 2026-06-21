import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Radio, Save, Goal, Square, ArrowLeftRight, Trash2 } from 'lucide-react';
import { useFixtureMutations } from '@/hooks/queries';
import { useSubmitResult } from '@/hooks/useSubmitResult';
import LineupPicker, {
  cleanLineups,
  lineupsFromResult,
  cleanFormationOverrides,
  formationOverridesFromResult,
} from './LineupPicker';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FOOTBALL_GOAL_TYPES, CARD_TYPES } from '@tms/shared/constants';

const GOAL_TYPE_LABELS = { openPlay: 'Open play', penalty: 'Penalty', freeKick: 'Free kick', ownGoal: 'Own goal' };

function PlayerSelect({ value, onChange, players, placeholder }) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {players.length === 0 && <SelectItem value="none" disabled>No roster</SelectItem>}
        {players.map((p) => (
          <SelectItem key={p._id} value={p._id}>
            {p.jerseyNumber != null ? `${p.jerseyNumber}. ` : ''}{p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function FootballConsole({
  tournament,
  tournamentId,
  fixture,
  rosterByTeam,
  teamsById,
  defaultFormations,
  onClose,
}) {
  const { liveUpdate } = useFixtureMutations(tournamentId);
  const { submit, isPending: submitting } = useSubmitResult(tournamentId);
  const teamAId = fixture.teamA._id;
  const teamBId = fixture.teamB._id;
  const isKnockout = fixture.stage === 'knockout';

  const playersById = useMemo(() => {
    const m = {};
    for (const list of Object.values(rosterByTeam)) for (const p of list) m[p._id] = p;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = fixture.liveState || fixture.result || {};
  const [goals, setGoals] = useState(seed.goals || []);
  const [cards, setCards] = useState(seed.cards || []);
  const [subs, setSubs] = useState(seed.substitutions || []);
  const [minute, setMinute] = useState('');

  const [goalForm, setGoalForm] = useState({ team: teamAId, playerId: '', assistId: '', type: 'openPlay' });
  const [cardForm, setCardForm] = useState({ team: teamAId, playerId: '', type: 'yellow' });
  const [subForm, setSubForm] = useState({ team: teamAId, playerOutId: '', playerInId: '' });
  const [pens, setPens] = useState({ teamA: 0, teamB: 0 });
  const [motm, setMotm] = useState('');
  const [lineups, setLineups] = useState(() => lineupsFromResult(fixture.result));
  const [formationOverrides, setFormationOverrides] = useState(() =>
    fixture.liveState?.formation ?? formationOverridesFromResult(fixture.result)
  );

  const teamName = (id) => teamsById[id]?.name || teamsById[id]?.shortCode || 'Team';
  const pName = (id) => playersById[id]?.name || '';

  const score = useMemo(() => {
    let a = 0; let b = 0;
    for (const g of goals) {
      const scoring = g.type === 'ownGoal' ? (String(g.team) === teamAId ? teamBId : teamAId) : String(g.team);
      if (scoring === teamAId) a += 1; else if (scoring === teamBId) b += 1;
    }
    return { a, b };
  }, [goals, teamAId, teamBId]);

  const pushLive = (
    nextGoals = goals,
    nextCards = cards,
    nextSubs = subs,
    nextFormation = formationOverrides
  ) => {
    const formation = cleanFormationOverrides(nextFormation);
    liveUpdate.mutate(
      {
        fixtureId: fixture._id,
        body: {
          football: {
            goals: nextGoals,
            cards: nextCards,
            substitutions: nextSubs,
            ...(formation ? { formation } : {}),
            minute: minute ? Number(minute) : undefined,
          },
        },
      },
      { onError: (e) => toast.error(apiError(e)) }
    );
  };

  const addGoal = () => {
    const g = {
      team: goalForm.team,
      playerId: goalForm.playerId || null,
      scorer: pName(goalForm.playerId),
      assistId: goalForm.assistId || null,
      assist: pName(goalForm.assistId),
      type: goalForm.type,
      minute: minute ? Number(minute) : undefined,
    };
    const next = [...goals, g];
    setGoals(next);
    setGoalForm({ ...goalForm, playerId: '', assistId: '' });
    pushLive(next);
  };

  const addCard = () => {
    const c = { team: cardForm.team, playerId: cardForm.playerId || null, player: pName(cardForm.playerId), type: cardForm.type, minute: minute ? Number(minute) : undefined };
    const next = [...cards, c];
    setCards(next);
    setCardForm({ ...cardForm, playerId: '' });
    pushLive(goals, next);
  };

  const addSub = () => {
    if (!subForm.playerOutId && !subForm.playerInId) return;
    const s = { team: subForm.team, playerOutId: subForm.playerOutId || null, playerInId: subForm.playerInId || null, playerOut: pName(subForm.playerOutId), playerIn: pName(subForm.playerInId), minute: minute ? Number(minute) : undefined };
    const next = [...subs, s];
    setSubs(next);
    setSubForm({ ...subForm, playerOutId: '', playerInId: '' });
    pushLive(goals, cards, next);
  };

  const removeGoal = (i) => { const next = goals.filter((_, j) => j !== i); setGoals(next); pushLive(next); };
  const removeCard = (i) => { const next = cards.filter((_, j) => j !== i); setCards(next); pushLive(goals, next); };
  const removeSub = (i) => { const next = subs.filter((_, j) => j !== i); setSubs(next); pushLive(goals, cards, next); };

  const saveResult = () => {
    let winner = null;
    if (score.a > score.b) winner = teamAId;
    else if (score.b > score.a) winner = teamBId;
    const football = { goals, cards, substitutions: subs, result: { winner } };
    if (isKnockout && score.a === score.b) {
      const penA = Number(pens.teamA);
      const penB = Number(pens.teamB);
      if (!Number.isFinite(penA) || !Number.isFinite(penB) || penA < 0 || penB < 0) {
        toast.error('Penalty values must be valid non-negative numbers');
        return;
      }
      if (penA === penB) {
        toast.error('Knockout penalties must produce a winner');
        return;
      }
      football.penalties = { teamA: penA, teamB: penB };
      winner = penA > penB ? teamAId : teamBId;
      football.result = { winner };
    }
    if (motm) football.manOfTheMatch = motm;
    const formation = cleanFormationOverrides(formationOverrides);
    if (formation) football.formation = formation;
    const ln = cleanLineups(lineups);
    if (ln) football.lineups = ln;
    submit({ fixtureId: fixture._id, body: { football }, onDone: onClose });
  };

  const rosterFor = (id) => rosterByTeam[id] || [];
  const allRoster = [...rosterFor(teamAId), ...rosterFor(teamBId)];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Radio className="h-4 w-4 text-destructive" /> Live scoring · {tournament.name}</DialogTitle>
        <DialogDescription>{teamName(teamAId)} vs {teamName(teamBId)} — events broadcast instantly</DialogDescription>
      </DialogHeader>

      {/* Scoreboard */}
      <div className="surface-elevated flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/75 p-3 sm:gap-4 sm:p-4">
        <span className="flex-1 truncate text-right text-sm font-medium">{teamName(teamAId)}</span>
        <span className="font-display text-3xl tabular-nums tracking-[-0.02em] sm:text-4xl">{score.a} : {score.b}</span>
        <span className="flex-1 truncate text-sm font-medium">{teamName(teamBId)}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="w-full max-w-28 space-y-1">
          <Label className="text-xs">Minute</Label>
          <Input type="number" min="0" max="130" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="min" className="h-9" />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Set the match minute, then log events below.</p>
      </div>

      {/* Add goal */}
      <div className="surface-elevated space-y-2 rounded-2xl border border-border/75 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Goal className="h-4 w-4 text-accent" /> Goal</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={goalForm.team} onValueChange={(v) => setGoalForm({ ...goalForm, team: v, playerId: '', assistId: '' })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={teamAId}>{teamName(teamAId)}</SelectItem>
              <SelectItem value={teamBId}>{teamName(teamBId)}</SelectItem>
            </SelectContent>
          </Select>
          <PlayerSelect value={goalForm.playerId} onChange={(v) => setGoalForm({ ...goalForm, playerId: v })} players={rosterFor(goalForm.team)} placeholder="Scorer" />
          <PlayerSelect value={goalForm.assistId} onChange={(v) => setGoalForm({ ...goalForm, assistId: v })} players={rosterFor(goalForm.team)} placeholder="Assist (opt)" />
          <Select value={goalForm.type} onValueChange={(v) => setGoalForm({ ...goalForm, type: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FOOTBALL_GOAL_TYPES.map((t) => <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={addGoal} className="w-full">Add goal</Button>
      </div>

      {/* Add card + sub */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="surface-elevated space-y-2 rounded-2xl border border-border/75 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Square className="h-4 w-4 text-[hsl(var(--warning))]" /> Card</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select value={cardForm.team} onValueChange={(v) => setCardForm({ ...cardForm, team: v, playerId: '' })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={teamAId}>{teamsById[teamAId]?.shortCode}</SelectItem>
                <SelectItem value={teamBId}>{teamsById[teamBId]?.shortCode}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cardForm.type} onValueChange={(v) => setCardForm({ ...cardForm, type: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <PlayerSelect value={cardForm.playerId} onChange={(v) => setCardForm({ ...cardForm, playerId: v })} players={rosterFor(cardForm.team)} placeholder="Player" />
          <Button size="sm" variant="outline" onClick={addCard} className="w-full">Add card</Button>
        </div>

        <div className="surface-elevated space-y-2 rounded-2xl border border-border/75 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><ArrowLeftRight className="h-4 w-4" /> Substitution</p>
          <Select value={subForm.team} onValueChange={(v) => setSubForm({ ...subForm, team: v, playerOutId: '', playerInId: '' })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={teamAId}>{teamsById[teamAId]?.shortCode}</SelectItem>
              <SelectItem value={teamBId}>{teamsById[teamBId]?.shortCode}</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PlayerSelect value={subForm.playerOutId} onChange={(v) => setSubForm({ ...subForm, playerOutId: v })} players={rosterFor(subForm.team)} placeholder="Out" />
            <PlayerSelect value={subForm.playerInId} onChange={(v) => setSubForm({ ...subForm, playerInId: v })} players={rosterFor(subForm.team)} placeholder="In" />
          </div>
          <Button size="sm" variant="outline" onClick={addSub} className="w-full">Add sub</Button>
        </div>
      </div>

      {/* Timeline */}
      {(goals.length > 0 || cards.length > 0 || subs.length > 0) && (
        <div className="surface-elevated max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border/70 p-2 scrollbar-thin">
          {goals.map((g, i) => (
            <div key={`g${i}`} className="flex items-center gap-2 text-sm">
              <Goal className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">{g.minute != null ? `${g.minute}'` : ''}</span>
              <span className="truncate">{g.scorer || pName(g.playerId) || teamName(g.team)}{g.type === 'ownGoal' ? ' (OG)' : ''}{g.type === 'penalty' ? ' (pen)' : ''}</span>
              <Badge variant="outline" className="ml-auto">{teamsById[g.team]?.shortCode}</Badge>
              <button type="button" onClick={() => removeGoal(i)} aria-label="Remove goal" className="rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {cards.map((c, i) => (
            <div key={`c${i}`} className="flex items-center gap-2 text-sm">
              <Square className={`h-3.5 w-3.5 ${c.type === 'red' ? 'text-destructive' : 'text-[hsl(var(--warning))]'}`} />
              <span className="text-muted-foreground">{c.minute != null ? `${c.minute}'` : ''}</span>
              <span className="truncate">{c.player || pName(c.playerId) || teamName(c.team)} · {c.type}</span>
              <Badge variant="outline" className="ml-auto">{teamsById[c.team]?.shortCode}</Badge>
              <button type="button" onClick={() => removeCard(i)} aria-label="Remove card" className="rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {subs.map((s, i) => (
            <div key={`s${i}`} className="flex items-center gap-2 text-sm">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="text-muted-foreground">{s.minute != null ? `${s.minute}'` : ''}</span>
              <span className="truncate">{s.playerIn || pName(s.playerInId)} ↔ {s.playerOut || pName(s.playerOutId)}</span>
              <Badge variant="outline" className="ml-auto">{teamsById[s.team]?.shortCode}</Badge>
              <button type="button" onClick={() => removeSub(i)} aria-label="Remove substitution" className="rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Knockout penalties */}
      {isKnockout && score.a === score.b && (
        <div className="surface-elevated rounded-2xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] p-3">
          <p className="mb-2 text-sm font-medium text-[hsl(var(--warning))]">Penalty shootout (knockout tie)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">{teamsById[teamAId]?.shortCode} pens</Label><Input type="number" min="0" value={pens.teamA} onChange={(e) => setPens({ ...pens, teamA: e.target.value })} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{teamsById[teamBId]?.shortCode} pens</Label><Input type="number" min="0" value={pens.teamB} onChange={(e) => setPens({ ...pens, teamB: e.target.value })} className="h-9" /></div>
          </div>
        </div>
      )}

      <LineupPicker
        teamA={fixture.teamA}
        teamB={fixture.teamB}
        sport={tournament.sportType}
        rosterByTeam={rosterByTeam}
        value={lineups}
        onChange={setLineups}
        showFormationOverrides
        defaultFormations={defaultFormations}
        formationOverrides={formationOverrides}
        onFormationOverridesChange={(next) => {
          setFormationOverrides(next);
          pushLive(goals, cards, subs, next);
        }}
      />

      <div className="space-y-1">
        <Label className="text-xs">Player of the match (optional)</Label>
        <PlayerSelect value={motm} onChange={setMotm} players={allRoster} placeholder="Select" />
      </div>

      <DialogFooter className="!flex !flex-row !flex-wrap items-center !justify-between gap-2">
        {liveUpdate.isPending
          ? <Badge variant="live" className="gap-1"><span className="live-dot h-1.5 w-1.5 rounded-full bg-destructive" /> Syncing</Badge>
          : <span />}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
          <Button size="sm" onClick={saveResult} disabled={submitting}><Save /> {submitting ? 'Saving…' : 'Save final result'}</Button>
        </div>
      </DialogFooter>
    </>
  );
}
