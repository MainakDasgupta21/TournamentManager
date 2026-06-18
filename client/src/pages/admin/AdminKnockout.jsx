import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { GitBranch, Lock, Wand2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useTeams, useKnockout, useKnockoutMutations } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Bracket from '@/components/Bracket';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { PageHeader } from '@/components/ui/page-header';

function GenerateCard({ tournament, tournamentId, hasBracket, locked }) {
  const { generate } = useKnockoutMutations(tournamentId);
  const confirm = useConfirm();
  const [opts, setOpts] = useState({
    format: 'single-elimination',
    qualifiersPerGroup: tournament.groupSettings?.qualifiersPerGroup ?? 2,
    thirdPlacePlayoff: false,
    startDate: '',
    daysBetweenRounds: 3,
  });
  const isPlayoff = opts.format === 'playoff';

  const run = async () => {
    if (hasBracket) {
      const ok = await confirm({
        title: 'Regenerate the bracket?',
        description:
          'This rebuilds the knockout bracket from the current standings, discarding the existing bracket and any results in it.',
        confirmLabel: 'Regenerate',
      });
      if (!ok) return;
    }
    try {
      await generate.mutateAsync({
        format: opts.format,
        qualifiersPerGroup: isPlayoff ? 4 : Number(opts.qualifiersPerGroup),
        thirdPlacePlayoff: isPlayoff ? false : opts.thirdPlacePlayoff,
        startDate: opts.startDate ? new Date(opts.startDate).toISOString() : undefined,
        daysBetweenRounds: Number(opts.daysBetweenRounds),
      });
      toast.success('Bracket generated from standings');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Generate knockout bracket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ko-format">Format</Label>
            <Select value={opts.format} onValueChange={(v) => setOpts({ ...opts, format: v })}>
              <SelectTrigger id="ko-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single-elimination">Single elimination</SelectItem>
                <SelectItem value="playoff">IPL-style playoffs (top 4)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isPlayoff && (
            <div className="space-y-1.5">
              <Label htmlFor="ko-qualifiers">Qualifiers / group</Label>
              <Input id="ko-qualifiers" type="number" min={1} value={opts.qualifiersPerGroup} onChange={(e) => setOpts({ ...opts, qualifiersPerGroup: e.target.value })} className="w-full" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ko-start">First match date</Label>
            <Input id="ko-start" type="date" value={opts.startDate} onChange={(e) => setOpts({ ...opts, startDate: e.target.value })} className="w-full" />
          </div>
          {!isPlayoff && (
            <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-border/75 bg-card/55 px-3">
              <span className="text-sm">3rd-place playoff</span>
              <Switch checked={opts.thirdPlacePlayoff} onCheckedChange={(v) => setOpts({ ...opts, thirdPlacePlayoff: v })} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button className="w-full sm:w-auto" onClick={run} disabled={generate.isPending || locked} variant={hasBracket ? 'outline' : 'default'}>
            <GitBranch /> {hasBracket ? 'Regenerate' : 'Generate bracket'}
          </Button>
          {isPlayoff && (
            <p className="text-xs text-muted-foreground sm:flex-1 sm:basis-64">
              Top 4 advance: Qualifier 1 (1 v 2) and Eliminator (3 v 4), then Qualifier 2, then the Final. The top two seeds get a second chance.
            </p>
          )}
          {locked && <p className="text-xs text-muted-foreground">Bracket is locked — unlock not permitted.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Editable seeding for round 1 matchups (only when unlocked). */
function AdjustPanel({ tournamentId, bracket, teams }) {
  const { adjust } = useKnockoutMutations(tournamentId);
  const firstRound = bracket.rounds?.[0];
  if (!firstRound) return null;

  const teamName = (id) => teams.find((t) => t._id === String(id))?.name || 'TBD';

  const change = (matchupIndex, slot, teamId) => {
    adjust.mutate(
      { roundIndex: 0, matchupIndex, [slot === 'A' ? 'slotA' : 'slotB']: teamId },
      { onError: (e) => toast.error(apiError(e)) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Adjust first-round seeding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {firstRound.matchups.map((m, i) => (
          <div key={i} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border/70 bg-card/55 p-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
            <Select value={m.slotA?._id || m.slotA || ''} onValueChange={(v) => change(i, 'A', v)}>
              <SelectTrigger className="h-9 min-w-0"><SelectValue placeholder={m.slotALabel || 'TBD'}>{teamName(m.slotA?._id || m.slotA)}</SelectValue></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="shrink-0 text-center text-xs font-bold text-muted-foreground">vs</span>
            <Select value={m.slotB?._id || m.slotB || ''} onValueChange={(v) => change(i, 'B', v)}>
              <SelectTrigger className="h-9 min-w-0"><SelectValue placeholder={m.slotBLabel || 'TBD'}>{teamName(m.slotB?._id || m.slotB)}</SelectValue></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Reassign teams before locking. Once locked, the structure is fixed and results drive advancement.</p>
      </CardContent>
    </Card>
  );
}

export default function AdminKnockout() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: bracket, isLoading, isError, refetch } = useKnockout(tournamentId);
  const { data: teams = [] } = useTeams(tournamentId);
  const { lock } = useKnockoutMutations(tournamentId);
  const confirm = useConfirm();

  const hasBracket = !!bracket?.rounds?.length;
  const locked = bracket?.locked;

  const onLock = async () => {
    const ok = await confirm({
      title: 'Lock the bracket?',
      description: 'Structural edits will no longer be possible. Results will drive advancement from here.',
      confirmLabel: 'Lock bracket',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await lock.mutateAsync();
      toast.success('Bracket locked');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knockout stage"
        description="Generate, adjust, and lock the bracket with confidence once seeding looks right."
        actions={
          hasBracket ? (
            <>
              <Badge variant={locked ? 'success' : 'warning'}>{locked ? 'Locked' : 'Draft'}</Badge>
              {!locked && <Button onClick={onLock} disabled={lock.isPending} className="w-full sm:w-auto"><Lock /> Lock bracket</Button>}
            </>
          ) : null
        }
      />

      <GenerateCard tournament={tournament} tournamentId={tournamentId} hasBracket={hasBracket} locked={locked} />

      {isError ? (
        <ErrorState title="Couldn't load the bracket" description="There was a problem reaching the server." onRetry={refetch} />
      ) : isLoading ? (
        <div className="surface-elevated flex gap-8 overflow-hidden rounded-2xl border border-border/70 p-6">
          {[4, 2, 1].map((count, col) => (
            <div key={col} className="flex flex-1 flex-col justify-around gap-4">
              {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {hasBracket && !locked && <AdjustPanel tournamentId={tournamentId} bracket={bracket} teams={teams} />}
          <Card>
            <CardContent className="p-6">
              <Bracket bracket={bracket} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
