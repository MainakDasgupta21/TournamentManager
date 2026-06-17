import { useState } from 'react';
import { SPORTS } from '@tms/shared/constants';
import { useSubmitResult } from '@/hooks/useSubmitResult';
import { useTeam } from '@/hooks/queries';
import LineupPicker, { cleanLineups, lineupsFromResult } from './LineupPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

function Num({ label, value, onChange, step = '1' }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} min="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Derive quick-form initial values from an existing result (edit mode). */
function cricketInitial(fixture) {
  const teamA = fixture.teamA;
  const r = fixture.result;
  const i0 = r?.innings?.[0];
  const i1 = r?.innings?.[1];
  const battingFirst = i0?.battingTeam ? String(i0.battingTeam) : teamA._id;
  const margin = r?.result?.margin;
  let outcome = teamA._id;
  if (r) {
    if (margin === 'tie') outcome = 'tie';
    else if (margin === 'noResult') outcome = 'noResult';
    else if (r.result?.winner) outcome = String(r.result.winner);
  }
  const so = r?.superOver;
  return {
    battingFirst,
    inn1: { runs: i0?.runs ?? 0, wickets: i0?.wickets ?? 0, overs: i0?.overs ?? 0 },
    inn2: { runs: i1?.runs ?? 0, wickets: i1?.wickets ?? 0, overs: i1?.overs ?? 0 },
    outcome: margin === 'superOver' ? 'tie' : outcome,
    marginType: typeof margin === 'object' ? margin.type : 'runs',
    marginValue: typeof margin === 'object' ? margin.value : 0,
    superOver: {
      aRuns: so?.teamA?.runs ?? 0, aWkts: so?.teamA?.wickets ?? 0,
      bRuns: so?.teamB?.runs ?? 0, bWkts: so?.teamB?.wickets ?? 0,
    },
  };
}

/* ------------------------------ Cricket ------------------------------ */
function CricketForm({ fixture, tournament, onSubmit, submitting, rosterByTeam, lineups, setLineups }) {
  const teamA = fixture.teamA;
  const teamB = fixture.teamB;
  const bonusRule = tournament.pointsConfig?.bonusPointRule;
  const isKnockout = fixture.stage === 'knockout';

  const init = cricketInitial(fixture);
  const [battingFirst, setBattingFirst] = useState(init.battingFirst);
  const [inn1, setInn1] = useState(init.inn1);
  const [inn2, setInn2] = useState(init.inn2);
  const [outcome, setOutcome] = useState(init.outcome);
  const [marginType, setMarginType] = useState(init.marginType);
  const [marginValue, setMarginValue] = useState(init.marginValue);
  const [awardBonus, setAwardBonus] = useState(false);
  const [superOver, setSuperOver] = useState(init.superOver);

  const secondBatting = battingFirst === teamA._id ? teamB._id : teamA._id;
  const tiedKnockout = outcome === 'tie' && isKnockout;

  const submit = () => {
    const cricket = {
      innings: [
        { battingTeam: battingFirst, runs: Number(inn1.runs), wickets: Number(inn1.wickets), overs: Number(inn1.overs) },
        { battingTeam: secondBatting, runs: Number(inn2.runs), wickets: Number(inn2.wickets), overs: Number(inn2.overs) },
      ],
      result: {},
    };

    if (tiedKnockout) {
      // teamA/teamB of the Super Over map to the fixture's slots.
      const aRuns = Number(superOver.aRuns);
      const bRuns = Number(superOver.bRuns);
      if (aRuns === bRuns) return; // guarded by the disabled Save button
      const winner = aRuns > bRuns ? teamA._id : teamB._id;
      cricket.superOver = {
        teamA: { runs: aRuns, wickets: Number(superOver.aWkts) },
        teamB: { runs: bRuns, wickets: Number(superOver.bWkts) },
      };
      cricket.result = { winner, margin: 'superOver' };
      const lnSO = cleanLineups(lineups);
      if (lnSO) cricket.lineups = lnSO;
      onSubmit({ cricket });
      return;
    }

    const winner = outcome === 'tie' || outcome === 'noResult' ? null : outcome;
    const margin =
      outcome === 'tie' ? 'tie'
      : outcome === 'noResult' ? 'noResult'
      : { type: marginType, value: Number(marginValue) };
    cricket.result = { winner, margin };
    if (awardBonus && winner) {
      cricket.bonus = [{ team: winner, points: Number(bonusRule?.bonusPoints || 1) }];
    }
    const ln = cleanLineups(lineups);
    if (ln) cricket.lineups = ln;
    onSubmit({ cricket });
  };

  const soTied = tiedKnockout && Number(superOver.aRuns) === Number(superOver.bRuns);

  const teamName = (id) => (id === teamA._id ? teamA.name : teamB.name);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Batting first</Label>
        <Select value={battingFirst} onValueChange={setBattingFirst}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={teamA._id}>{teamA.name}</SelectItem>
            <SelectItem value={teamB._id}>{teamB.name}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-elevated rounded-2xl border border-border/75 p-3">
        <p className="mb-2 text-sm font-semibold">{teamName(battingFirst)} (1st innings)</p>
        <div className="grid grid-cols-3 gap-2">
          <Num label="Runs" value={inn1.runs} onChange={(v) => setInn1({ ...inn1, runs: v })} />
          <Num label="Wickets" value={inn1.wickets} onChange={(v) => setInn1({ ...inn1, wickets: v })} />
          <Num label="Overs" value={inn1.overs} step="0.1" onChange={(v) => setInn1({ ...inn1, overs: v })} />
        </div>
      </div>

      <div className="surface-elevated rounded-2xl border border-border/75 p-3">
        <p className="mb-2 text-sm font-semibold">{teamName(secondBatting)} (2nd innings)</p>
        <div className="grid grid-cols-3 gap-2">
          <Num label="Runs" value={inn2.runs} onChange={(v) => setInn2({ ...inn2, runs: v })} />
          <Num label="Wickets" value={inn2.wickets} onChange={(v) => setInn2({ ...inn2, wickets: v })} />
          <Num label="Overs" value={inn2.overs} step="0.1" onChange={(v) => setInn2({ ...inn2, overs: v })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={teamA._id}>{teamA.name} won</SelectItem>
              <SelectItem value={teamB._id}>{teamB.name} won</SelectItem>
              <SelectItem value="tie">Tie</SelectItem>
              {fixture.stage !== 'knockout' && <SelectItem value="noResult">No result</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        {outcome !== 'tie' && outcome !== 'noResult' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Margin by</Label>
              <Select value={marginType} onValueChange={setMarginType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runs">Runs</SelectItem>
                  <SelectItem value="wickets">Wickets</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Num label="Value" value={marginValue} onChange={setMarginValue} />
          </div>
        )}
      </div>

      {tiedKnockout && (
        <div className="surface-elevated rounded-2xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] p-3">
          <p className="mb-2 text-sm font-medium text-[hsl(var(--warning))]">Super Over (knockout tie)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Num label={`${teamA.name} runs`} value={superOver.aRuns} onChange={(v) => setSuperOver({ ...superOver, aRuns: v })} />
              <Num label="Wkts" value={superOver.aWkts} onChange={(v) => setSuperOver({ ...superOver, aWkts: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Num label={`${teamB.name} runs`} value={superOver.bRuns} onChange={(v) => setSuperOver({ ...superOver, bRuns: v })} />
              <Num label="Wkts" value={superOver.bWkts} onChange={(v) => setSuperOver({ ...superOver, bWkts: v })} />
            </div>
          </div>
          {soTied && <p role="alert" className="mt-2 text-xs text-destructive">Super Over is tied — enter a decisive score.</p>}
        </div>
      )}

      {bonusRule?.enabled && outcome !== 'tie' && outcome !== 'noResult' && (
        <label className="surface-elevated flex items-center justify-between rounded-2xl border border-border/75 p-3 text-sm">
          <span>Award bonus ({bonusRule.bonusPoints} pt) — {bonusRule.description || 'bonus'}</span>
          <Switch checked={awardBonus} onCheckedChange={setAwardBonus} />
        </label>
      )}

      <LineupPicker
        teamA={teamA}
        teamB={teamB}
        rosterByTeam={rosterByTeam}
        value={lineups}
        onChange={setLineups}
      />

      <DialogFooter>
        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
        <Button onClick={submit} disabled={submitting || soTied}>{submitting ? 'Saving…' : 'Save result'}</Button>
      </DialogFooter>
    </div>
  );
}

/** Scoreboard-aware goal counts (own goals credit the opponent) for prefill. */
function footballInitial(fixture) {
  const teamA = fixture.teamA;
  const teamB = fixture.teamB;
  const r = fixture.result;
  let a = 0;
  let b = 0;
  for (const g of r?.goals ?? []) {
    const scoring = g.type === 'ownGoal'
      ? (String(g.team) === teamA._id ? teamB._id : teamA._id)
      : String(g.team);
    if (scoring === teamA._id) a += 1;
    else if (scoring === teamB._id) b += 1;
  }
  return { goalsA: a, goalsB: b, penA: r?.penalties?.teamA ?? 0, penB: r?.penalties?.teamB ?? 0 };
}

/* ------------------------------ Football ------------------------------ */
function FootballForm({ fixture, onSubmit, submitting, rosterByTeam, lineups, setLineups }) {
  const teamA = fixture.teamA;
  const teamB = fixture.teamB;
  const isKnockout = fixture.stage === 'knockout';

  const init = footballInitial(fixture);
  const [goalsA, setGoalsA] = useState(init.goalsA);
  const [goalsB, setGoalsB] = useState(init.goalsB);
  const [penA, setPenA] = useState(init.penA);
  const [penB, setPenB] = useState(init.penB);

  // Coerce free-text inputs to safe non-negative integers. `Array.from({ length })`
  // throws a RangeError for negative/NaN lengths, so never trust the raw value.
  const gA = Math.max(0, parseInt(goalsA, 10) || 0);
  const gB = Math.max(0, parseInt(goalsB, 10) || 0);
  const pA = Math.max(0, parseInt(penA, 10) || 0);
  const pB = Math.max(0, parseInt(penB, 10) || 0);
  const drawn = gA === gB;
  const penaltyTied = isKnockout && drawn && pA === pB;

  const submit = () => {
    const goals = [
      ...Array.from({ length: gA }, () => ({ team: teamA._id })),
      ...Array.from({ length: gB }, () => ({ team: teamB._id })),
    ];
    let winner = null;
    if (gA > gB) winner = teamA._id;
    else if (gB > gA) winner = teamB._id;

    const football = { goals, result: { winner } };
    if (isKnockout && drawn) {
      if (pA === pB) return; // guarded by the disabled Save button
      // Winner is derived server-side from the (decisive) penalty score.
      football.penalties = { teamA: pA, teamB: pB };
    }
    const ln = cleanLineups(lineups);
    if (ln) football.lineups = ln;
    onSubmit({ football });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Num label={`${teamA.name} goals`} value={goalsA} onChange={setGoalsA} />
        <Num label={`${teamB.name} goals`} value={goalsB} onChange={setGoalsB} />
      </div>

      {isKnockout && drawn && (
        <div className="surface-elevated rounded-2xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] p-3">
          <p className="mb-2 text-sm font-medium text-[hsl(var(--warning))]">Penalty shootout (knockout tie)</p>
          <div className="grid grid-cols-2 gap-3">
            <Num label={`${teamA.name} pens`} value={penA} onChange={setPenA} />
            <Num label={`${teamB.name} pens`} value={penB} onChange={setPenB} />
          </div>
          {penaltyTied && <p role="alert" className="mt-2 text-xs text-destructive">Penalties are level — enter a decisive score.</p>}
        </div>
      )}
      {!isKnockout && drawn && <p className="text-sm text-muted-foreground">Equal score → recorded as a draw.</p>}

      <LineupPicker
        teamA={teamA}
        teamB={teamB}
        rosterByTeam={rosterByTeam}
        value={lineups}
        onChange={setLineups}
      />

      <DialogFooter>
        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
        <Button onClick={submit} disabled={submitting || penaltyTied}>{submitting ? 'Saving…' : 'Save result'}</Button>
      </DialogFooter>
    </div>
  );
}

export default function ResultEntryDialog({ tournament, tournamentId, fixture, onClose }) {
  const { submit, isPending } = useSubmitResult(tournamentId);

  // Rosters power the optional Playing XI picker (appearances / clean sheets).
  const teamAId = fixture.teamA?._id;
  const teamBId = fixture.teamB?._id;
  const a = useTeam(tournamentId, teamAId);
  const b = useTeam(tournamentId, teamBId);
  const rosterByTeam = {
    [teamAId]: a.data?.players ?? [],
    [teamBId]: b.data?.players ?? [],
  };
  const [lineups, setLineups] = useState(() => lineupsFromResult(fixture.result));

  const handle = (body) => submit({ fixtureId: fixture._id, body, onDone: onClose });

  const formProps = { rosterByTeam, lineups, setLineups };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Enter result</DialogTitle>
        <DialogDescription>
          {fixture.teamA?.name} vs {fixture.teamB?.name}
          {fixture.roundName ? ` · ${fixture.roundName}` : ''}
        </DialogDescription>
      </DialogHeader>
      {tournament.sportType === SPORTS.CRICKET ? (
        <CricketForm fixture={fixture} tournament={tournament} onSubmit={handle} submitting={isPending} {...formProps} />
      ) : (
        <FootballForm fixture={fixture} onSubmit={handle} submitting={isPending} {...formProps} />
      )}
    </DialogContent>
  );
}
