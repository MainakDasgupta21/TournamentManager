import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Radio, Undo2, Save } from 'lucide-react';
import { useFixtureMutations } from '@/hooks/queries';
import { useSubmitResult } from '@/hooks/useSubmitResult';
import LineupPicker, { cleanLineups, lineupsFromResult } from './LineupPicker';
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
import {
  CRICKET_WICKET_TYPES, CRICKET_EXTRA_TYPES,
} from '@tms/shared/constants';
import {
  inningsSummary, buildOvers, flattenOvers, isOverComplete, ballLabel, isLegalBall,
} from '@/lib/cricket';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** A roster <Select>; `optional` allows clearing back to "unassigned". */
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

export default function CricketConsole({ tournament, tournamentId, fixture, rosterByTeam, teamsById, onClose }) {
  const { liveUpdate } = useFixtureMutations(tournamentId);
  const { submit, isPending: submitting } = useSubmitResult(tournamentId);
  const teamAId = fixture.teamA._id;
  const teamBId = fixture.teamB._id;

  // ---- initial innings (resume from live state / result, else fresh) ----
  const initialInnings = useMemo(() => {
    const src = fixture.liveState?.innings || fixture.result?.innings;
    if (Array.isArray(src) && src.length) {
      return src.map((inn) => ({
        battingTeam: String(inn.battingTeam),
        bowlingTeam: String(inn.bowlingTeam || (String(inn.battingTeam) === teamAId ? teamBId : teamAId)),
        balls: flattenOvers(inn.oversDetail || []),
      }));
    }
    return [{ battingTeam: teamAId, bowlingTeam: teamBId, balls: [] }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [innings, setInnings] = useState(initialInnings);
  // Clamp to a real innings: a stale liveState pointing past the innings we have
  // would otherwise make `cur` undefined and crash on the next property access.
  const [idx, setIdx] = useState(() =>
    Math.min(Math.max(0, fixture.liveState?.currentInnings ?? 0), initialInnings.length - 1)
  );
  const [striker, setStriker] = useState('');
  const [nonStriker, setNonStriker] = useState('');
  const [bowler, setBowler] = useState('');
  const [history, setHistory] = useState([]);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wkt, setWkt] = useState({ type: 'bowled', playerOut: '', fielder: '' });
  const [needBatsman, setNeedBatsman] = useState(false);
  const [finalize, setFinalize] = useState(null); // { winner, marginType, marginValue, motm }
  const [lineups, setLineups] = useState(() => lineupsFromResult(fixture.result));

  const cur = innings[idx];
  const bowlingTeam = cur.battingTeam === teamAId ? teamBId : teamAId;
  const battingRoster = rosterByTeam[cur.battingTeam] || [];
  const bowlingRoster = rosterByTeam[bowlingTeam] || [];
  const summary = inningsSummary(cur.balls);
  const teamName = (id) => teamsById[id]?.name || teamsById[id]?.shortCode || 'Team';

  const buildPayloadInnings = (list) =>
    list.map((inn) => ({
      battingTeam: inn.battingTeam,
      bowlingTeam: inn.bowlingTeam,
      oversDetail: buildOvers(inn.balls),
    }));

  const pushLive = (list, activeIdx) => {
    liveUpdate.mutate(
      { fixtureId: fixture._id, body: { cricket: { innings: buildPayloadInnings(list), currentInnings: activeIdx } } },
      { onError: (e) => toast.error(apiError(e)) }
    );
  };

  /** Apply a new innings list + batting positions and broadcast it live. */
  const apply = (nextList, s = striker, n = nonStriker, b = bowler) => {
    setHistory((h) => [...h, { innings: clone(innings), striker, nonStriker, bowler, idx, needBatsman }]);
    setInnings(nextList);
    setStriker(s); setNonStriker(n); setBowler(b);
    pushLive(nextList, idx);
  };

  const pushBall = (ball, { swap = false } = {}) => {
    const next = innings.map((inn, i) => (i === idx ? { ...inn, balls: [...inn.balls, ball] } : inn));
    const legal = next[idx].balls.filter(isLegalBall).length;
    const overEnded = isLegalBall(ball) && isOverComplete(legal);
    const toggles = (swap ? 1 : 0) + (overEnded ? 1 : 0);
    if (toggles % 2 === 1) apply(next, nonStriker, striker, bowler);
    else apply(next);
  };

  const needCore = () => {
    if (!bowler) { toast.error('Select the bowler'); return false; }
    if (needBatsman || !striker) { toast.error('Select the batsman on strike'); return false; }
    return true;
  };

  const onRuns = (n) => {
    if (!needCore()) return;
    pushBall(
      { batsman: striker, nonStriker, bowler, runsScored: n, extras: null, isWicket: false },
      { swap: n % 2 === 1 }
    );
  };

  const onExtra = (type) => {
    if (!bowler) { toast.error('Select the bowler'); return; }
    const illegal = type === 'wide' || type === 'noball';
    if (!illegal && (needBatsman || !striker)) { toast.error('Select the batsman on strike'); return; }
    pushBall(
      { batsman: striker || null, nonStriker, bowler, runsScored: 0, extras: { type, runs: illegal ? 0 : 1 }, isWicket: false },
      { swap: !illegal } // a single bye/leg-bye is 1 run -> rotate
    );
  };

  const confirmWicket = () => {
    if (!bowler) { toast.error('Select the bowler'); return; }
    const playerOut = wkt.playerOut || striker;
    const bowlerCredited = !['runout'].includes(wkt.type);
    const next = innings.map((inn, i) =>
      i === idx
        ? { ...inn, balls: [...inn.balls, {
            batsman: striker || null, nonStriker, bowler, runsScored: 0, extras: null,
            isWicket: true, wicket: { type: wkt.type, playerOut, fielder: wkt.fielder || null, bowlerCredited },
          }] }
        : inn
    );
    // The dismissed batsman vacates; a new batsman must be chosen.
    const outWasStriker = !playerOut || playerOut === striker;
    setHistory((h) => [...h, { innings: clone(innings), striker, nonStriker, bowler, idx, needBatsman }]);
    setInnings(next);
    if (outWasStriker) setStriker('');
    else setNonStriker('');
    setNeedBatsman(true);
    setWicketOpen(false);
    setWkt({ type: 'bowled', playerOut: '', fielder: '' });
    pushLive(next, idx);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setInnings(prev.innings);
      setStriker(prev.striker); setNonStriker(prev.nonStriker); setBowler(prev.bowler);
      setIdx(prev.idx); setNeedBatsman(prev.needBatsman);
      pushLive(prev.innings, prev.idx);
      return h.slice(0, -1);
    });
  };

  const startSecondInnings = () => {
    if (innings.length > 1) { setIdx(1); resetPositions(); return; }
    const next = [...innings, { battingTeam: bowlingTeam, bowlingTeam: cur.battingTeam, balls: [] }];
    setInnings(next);
    setIdx(1);
    resetPositions();
    pushLive(next, 1);
  };

  const resetPositions = () => { setStriker(''); setNonStriker(''); setBowler(''); setNeedBatsman(false); };

  const openFinalize = () => {
    const tot = innings.map((inn) => inningsSummary(inn.balls));
    let winner = '';
    let marginType = 'runs';
    let marginValue = 0;
    if (innings.length >= 2) {
      const r0 = tot[0].runs; const r1 = tot[1].runs;
      if (r0 > r1) { winner = innings[0].battingTeam; marginType = 'runs'; marginValue = r0 - r1; }
      else if (r1 > r0) { winner = innings[1].battingTeam; marginType = 'wickets'; marginValue = 10 - tot[1].wickets; }
      else { winner = 'tie'; }
    }
    setFinalize({ winner, marginType, marginValue, motm: '', superOver: { aRuns: 0, aWkts: 0, bRuns: 0, bWkts: 0 } });
  };

  const saveResult = () => {
    const f = finalize;
    const isTie = f.winner === 'tie';
    const isKnockout = fixture.stage === 'knockout';
    const cricket = { innings: buildPayloadInnings(innings), result: {} };

    if (isTie && isKnockout) {
      const so = f.superOver;
      const aRuns = Number(so.aRuns);
      const bRuns = Number(so.bRuns);
      if (aRuns === bRuns) {
        toast.error('Super Over is tied — enter a decisive score to find a winner');
        return;
      }
      const winnerId = aRuns > bRuns ? teamAId : teamBId;
      cricket.superOver = {
        teamA: { runs: aRuns, wickets: Number(so.aWkts) },
        teamB: { runs: bRuns, wickets: Number(so.bWkts) },
      };
      cricket.result = { winner: winnerId, margin: 'superOver' };
    } else {
      cricket.result = {
        winner: isTie ? null : f.winner,
        margin: isTie ? 'tie' : { type: f.marginType, value: Number(f.marginValue) },
      };
    }
    if (f.motm) cricket.manOfTheMatch = f.motm;
    const ln = cleanLineups(lineups);
    if (ln) cricket.lineups = ln;
    submit({ fixtureId: fixture._id, body: { cricket }, onDone: onClose });
  };

  const setSO = (patch) => setFinalize((prev) => ({ ...prev, superOver: { ...prev.superOver, ...patch } }));

  const allRoster = [...battingRoster, ...bowlingRoster];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-destructive" /> Live scoring · {tournament.name}
        </DialogTitle>
        <DialogDescription>
          {teamName(teamAId)} vs {teamName(teamBId)} — every ball broadcasts instantly
        </DialogDescription>
      </DialogHeader>

      {/* Scoreboard */}
      <div className="surface-elevated rounded-2xl border border-border/75 p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{teamName(cur.battingTeam)} batting</p>
            <p className="font-display text-3xl tabular-nums sm:text-4xl">
              {summary.runs}<span className="text-xl text-muted-foreground sm:text-2xl">/{summary.wickets}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Overs</p>
            <p className="font-display text-2xl tabular-nums sm:text-3xl">{summary.overs}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {cur.balls.slice(-12).map((b, i) => (
            <span key={i} className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold ${
              b.isWicket ? 'bg-destructive/20 text-destructive'
              : !isLegalBall(b) ? 'bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning))]'
              : 'bg-secondary text-secondary-foreground'}`}>
              {ballLabel(b)}
            </span>
          ))}
        </div>
      </div>

      {/* Innings switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {innings.map((inn, i) => (
          <Button key={i} size="sm" variant={i === idx ? 'secondary' : 'ghost'} onClick={() => { setIdx(i); resetPositions(); }}>
            Inns {i + 1}: {teamsById[inn.battingTeam]?.shortCode}
          </Button>
        ))}
        {innings.length < 2 && (
          <Button size="sm" variant="outline" onClick={startSecondInnings}>+ 2nd innings</Button>
        )}
      </div>

      {/* Batsmen + bowler */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Striker</Label>
          <PlayerSelect value={striker} onChange={(v) => { setStriker(v); if (v) setNeedBatsman(false); }} players={battingRoster} placeholder="On strike" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Non-striker</Label>
          <PlayerSelect value={nonStriker} onChange={setNonStriker} players={battingRoster} placeholder="Non-striker" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bowler</Label>
          <PlayerSelect value={bowler} onChange={setBowler} players={bowlingRoster} placeholder="Bowling" />
        </div>
      </div>
      {needBatsman && <p className="text-xs text-[hsl(var(--warning))]">Wicket fell — select the new batsman on strike.</p>}

      {/* Scoring pad */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[0, 1, 2, 3, 4, 6].map((n) => (
          <Button key={n} variant={n === 4 || n === 6 ? 'accent' : 'secondary'} className="h-12 text-base" onClick={() => onRuns(n)}>
            {n}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Button variant="outline" className="h-10" onClick={() => onExtra('wide')}>Wide</Button>
        <Button variant="outline" className="h-10" onClick={() => onExtra('noball')}>No ball</Button>
        <Button variant="outline" className="h-10" onClick={() => onExtra('bye')}>Bye</Button>
        <Button variant="outline" className="h-10" onClick={() => onExtra('legbye')}>Leg bye</Button>
        <Button variant="destructive" className="col-span-2 h-10 sm:col-span-1" onClick={() => { setWkt({ type: 'bowled', playerOut: striker, fielder: '' }); setWicketOpen(true); }}>
          Wicket
        </Button>
      </div>

      {/* Wicket panel */}
      {wicketOpen && (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">Record wicket</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">How out</Label>
              <Select value={wkt.type} onValueChange={(v) => setWkt({ ...wkt, type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRICKET_WICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Player out</Label>
              <PlayerSelect value={wkt.playerOut} onChange={(v) => setWkt({ ...wkt, playerOut: v })} players={battingRoster} placeholder="Batsman" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fielder (opt)</Label>
              <PlayerSelect value={wkt.fielder} onChange={(v) => setWkt({ ...wkt, fielder: v })} players={bowlingRoster} placeholder="Fielder" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setWicketOpen(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={confirmWicket}>Confirm wicket</Button>
          </div>
        </div>
      )}

      {/* Finalize panel */}
      {finalize && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-semibold">Finalise result</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Winner</Label>
              <Select value={finalize.winner} onValueChange={(v) => setFinalize({ ...finalize, winner: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={teamAId}>{teamName(teamAId)}</SelectItem>
                  <SelectItem value={teamBId}>{teamName(teamBId)}</SelectItem>
                  <SelectItem value="tie">{fixture.stage === 'knockout' ? 'Tie → Super Over' : 'Tie'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {finalize.winner && finalize.winner !== 'tie' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">By</Label>
                  <Select value={finalize.marginType} onValueChange={(v) => setFinalize({ ...finalize, marginType: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="runs">Runs</SelectItem>
                      <SelectItem value="wickets">Wickets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input type="number" min="0" value={finalize.marginValue} onChange={(e) => setFinalize({ ...finalize, marginValue: e.target.value })} className="h-9" />
                </div>
              </div>
            )}
          </div>

          {/* Super Over: only a tied knockout needs one (group ties stand). */}
          {finalize.winner === 'tie' && fixture.stage === 'knockout' && (
            <div className="space-y-2 rounded-lg border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-3">
              <p className="text-sm font-semibold text-[hsl(var(--warning))]">Super Over — match tied</p>
              <p className="text-xs text-muted-foreground">Enter each side&apos;s one-over total. The higher score advances.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { id: teamAId, runsKey: 'aRuns', wktsKey: 'aWkts' },
                  { id: teamBId, runsKey: 'bRuns', wktsKey: 'bWkts' },
                ].map((side) => (
                  <div key={side.id} className="space-y-1 rounded-md border border-border/60 p-2">
                    <p className="truncate text-xs font-semibold">{teamName(side.id)}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min="0" className="h-9 w-16" aria-label="Super over runs"
                        value={finalize.superOver[side.runsKey]}
                        onChange={(e) => setSO({ [side.runsKey]: e.target.value })}
                      />
                      <span className="text-sm text-muted-foreground">/</span>
                      <Input
                        type="number" min="0" max="2" className="h-9 w-14" aria-label="Super over wickets"
                        value={finalize.superOver[side.wktsKey]}
                        onChange={(e) => setSO({ [side.wktsKey]: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <LineupPicker
            teamA={fixture.teamA}
            teamB={fixture.teamB}
            rosterByTeam={rosterByTeam}
            value={lineups}
            onChange={setLineups}
          />
          <div className="space-y-1">
            <Label className="text-xs">Player of the match (optional)</Label>
            <PlayerSelect value={finalize.motm} onChange={(v) => setFinalize({ ...finalize, motm: v })} players={allRoster} placeholder="Select" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFinalize(null)}>Back</Button>
            <Button size="sm" onClick={saveResult} disabled={submitting}>
              <Save /> {submitting ? 'Saving…' : 'Save final result'}
            </Button>
          </div>
        </div>
      )}

      <DialogFooter className="!flex !flex-row !flex-wrap items-center !justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}><Undo2 /> Undo</Button>
          {liveUpdate.isPending && <Badge variant="live" className="gap-1"><span className="live-dot h-1.5 w-1.5 rounded-full bg-destructive" /> Syncing</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
          {!finalize && <Button size="sm" onClick={openFinalize}>Finalise…</Button>}
        </div>
      </DialogFooter>
    </>
  );
}
