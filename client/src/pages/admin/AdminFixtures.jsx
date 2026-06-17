import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarPlus, Radio, Pencil, CheckCircle2, Zap, Search, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useFixtures, useFixtureMutations } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { FixtureStatusBadge } from '@/components/ui/status-badge';
import { useConfirm } from '@/components/ui/confirm';
import { TeamCrest, EmptyState, ErrorState, Spinner, SkeletonGrid, FilterChip, SearchInput } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import ResultEntryDialog from '@/components/admin/ResultEntryDialog';
import LiveScoring from '@/components/admin/LiveScoring';
import { formatDateTime, resultSummary } from '@/lib/format';
import { cn } from '@/lib/utils';

function GenerateCard({ tournament, tournamentId, hasFixtures }) {
  const { generateGroupStage } = useFixtureMutations(tournamentId);
  const confirm = useConfirm();
  const [opts, setOpts] = useState({
    doubleRoundRobin: tournament.groupSettings?.doubleRoundRobin ?? false,
    startDate: '',
    daysBetweenRounds: 7,
  });

  const run = async () => {
    if (hasFixtures) {
      const ok = await confirm({
        title: 'Regenerate group fixtures?',
        description:
          'This overwrites all existing group fixtures and any results entered for them. This cannot be undone.',
        confirmLabel: 'Regenerate',
      });
      if (!ok) return;
    }
    try {
      await generateGroupStage.mutateAsync({
        doubleRoundRobin: opts.doubleRoundRobin,
        startDate: opts.startDate ? new Date(opts.startDate).toISOString() : undefined,
        daysBetweenRounds: Number(opts.daysBetweenRounds),
        overwrite: hasFixtures,
      });
      toast.success('Group fixtures generated');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> Generate group fixtures</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="gen-start-date">First match date</Label>
          <Input id="gen-start-date" type="date" value={opts.startDate} onChange={(e) => setOpts({ ...opts, startDate: e.target.value })} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gen-days-between">Days between rounds</Label>
          <Input id="gen-days-between" type="number" min={0} value={opts.daysBetweenRounds} onChange={(e) => setOpts({ ...opts, daysBetweenRounds: e.target.value })} className="w-full" />
        </div>
        <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-border/75 bg-card/55 px-3">
          <span className="text-sm">Double round-robin</span>
          <Switch checked={opts.doubleRoundRobin} onCheckedChange={(v) => setOpts({ ...opts, doubleRoundRobin: v })} />
        </div>
        <Button className="w-full" onClick={run} disabled={generateGroupStage.isPending} variant={hasFixtures ? 'outline' : 'default'}>
          <Zap /> {hasFixtures ? 'Regenerate (overwrite)' : 'Generate fixtures'}
        </Button>
      </CardContent>
    </Card>
  );
}

/** ISO timestamp -> value for <input type="datetime-local"> (in local time). */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Reschedule + reassign the venue of a single fixture (Module: schedule edit). */
function ScheduleDialog({ tournament, fixture, saving, onSave, onClose }) {
  const [when, setWhen] = useState(toLocalInput(fixture.scheduledAt));
  const [venue, setVenue] = useState(fixture.venue ?? '');
  const venues = tournament.venues ?? [];

  const submit = (e) => {
    e.preventDefault();
    const body = { venue: venue.trim() };
    // Empty leaves the date unchanged (the schema can't store a null date).
    if (when) body.scheduledAt = new Date(when).toISOString();
    onSave(body);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Edit schedule — Match #{fixture.matchNumber ?? '–'}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fixture-when">Date &amp; time</Label>
          <Input id="fixture-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fixture-venue">Venue</Label>
          <Input
            id="fixture-venue"
            list="fixture-venue-options"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue (optional)"
            maxLength={160}
          />
          {venues.length > 0 && (
            <datalist id="fixture-venue-options">
              {venues.map((v) => <option key={v} value={v} />)}
            </datalist>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>Save changes</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function FixtureRow({ fixture, sport, onResult, onLive, onToggleLive, onReopen, onSchedule, toggling }) {
  const completed = fixture.status === 'completed';
  const live = fixture.status === 'live';
  const playable = fixture.teamA && fixture.teamB;
  const winnerId = fixture.winner?._id || fixture.winner;
  const aWins = completed && String(winnerId) === String(fixture.teamA?._id);
  const bWins = completed && String(winnerId) === String(fixture.teamB?._id);
  const aName = fixture.teamA?.name || fixture.placeholderA || 'TBD';
  const bName = fixture.teamB?.name || fixture.placeholderB || 'TBD';
  const score = completed ? resultSummary(fixture) || 'vs' : 'vs';

  return (
    <div className="surface-elevated surface-interactive flex flex-col gap-3 rounded-2xl border border-border/75 p-3 lg:flex-row lg:items-center lg:gap-4">
      {/* Matchup: match number + both teams (names truncate so the row can't overflow). */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">
          {fixture.matchNumber ?? '–'}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
            <span className={cn('truncate', aWins && 'font-semibold')}>{aName}</span>
            {fixture.teamA && (
              <span className="shrink-0">
                <TeamCrest team={fixture.teamA} size="sm" />
              </span>
            )}
          </div>
          <span className="shrink-0 whitespace-nowrap px-1 text-xs font-bold text-muted-foreground">{score}</span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {fixture.teamB && (
              <span className="shrink-0">
                <TeamCrest team={fixture.teamB} size="sm" />
              </span>
            )}
            <span className={cn('truncate', bWins && 'font-semibold')}>{bName}</span>
          </div>
        </div>
      </div>

      {/* Schedule + status. */}
      <div className="flex min-w-0 items-center justify-between gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
        <span className="truncate text-xs text-muted-foreground">
          {formatDateTime(fixture.scheduledAt)}{fixture.venue ? ` · ${fixture.venue}` : ''}
        </span>
        <FixtureStatusBadge status={fixture.status} sport={sport} />
      </div>

      {/* Actions wrap instead of overflowing on narrow widths. */}
      <div className="flex flex-wrap gap-1.5 lg:shrink-0 lg:justify-end">
        <Tooltip label="Edit date & venue">
          <Button size="sm" variant="outline" onClick={() => onSchedule(fixture)} aria-label="Edit date and venue">
            <CalendarClock />
          </Button>
        </Tooltip>
        {playable && !completed && (
          <Tooltip label={live ? 'Stop live' : 'Go live'}>
            <Button
              size="sm"
              variant={live ? 'secondary' : 'outline'}
              onClick={() => onToggleLive(fixture)}
              disabled={toggling}
              aria-label={live ? 'Stop live' : 'Go live'}
            >
              {toggling ? <Spinner className="h-4 w-4" /> : <Radio className={live ? 'text-destructive' : ''} />}
            </Button>
          </Tooltip>
        )}
        {playable && completed && (
          <Tooltip label="Re-open to live (append or correct events)">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReopen(fixture)}
              disabled={toggling}
              aria-label="Re-open to live"
            >
              {toggling ? <Spinner className="h-4 w-4" /> : <Radio />}
            </Button>
          </Tooltip>
        )}
        {playable && (
          <Tooltip label={completed ? 'Edit ball-by-ball / events' : 'Ball-by-ball / event scoring'}>
            <Button size="sm" variant="secondary" onClick={() => onLive(fixture)}>
              <Zap /> {completed ? 'Edit score' : 'Score'}
            </Button>
          </Tooltip>
        )}
        {playable && (
          <Button size="sm" onClick={() => onResult(fixture)}>
            {completed ? <Pencil /> : <CheckCircle2 />} {completed ? 'Quick edit' : 'Quick result'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Order mirrors the public fixtures page for cross-surface consistency.
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'scheduled', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

/**
 * Bucket group-stage fixtures by their round-robin round, in ascending order,
 * so the list can render under sticky "Round N" headers. Undated/round-less
 * fixtures fall into a trailing "Other" bucket.
 */
function groupByRound(list) {
  const map = new Map();
  for (const f of list) {
    const key = f.groupRound ?? Infinity;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, items]) => ({
      key: round === Infinity ? 'other' : `round-${round}`,
      label: round === Infinity ? 'Other' : `Round ${round}`,
      fixtures: items.sort((x, y) => (x.matchNumber ?? 0) - (y.matchNumber ?? 0)),
    }));
}

export default function AdminFixtures() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: fixtures = [], isLoading, isError, refetch } = useFixtures(tournamentId);
  const { update } = useFixtureMutations(tournamentId);
  const [resultTarget, setResultTarget] = useState(null);
  const [liveTarget, setLiveTarget] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const group = fixtures.filter((f) => f.stage === 'group');
  const knockout = fixtures.filter((f) => f.stage === 'knockout');

  // Client-side status + free-text filter (teams, round, venue, match number).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (f) => {
      if (status !== 'all' && f.status !== status) return false;
      if (!q) return true;
      const hay = [
        f.teamA?.name, f.teamB?.name, f.placeholderA, f.placeholderB,
        f.roundName, f.venue, f.matchNumber != null ? `#${f.matchNumber}` : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };
  }, [status, query]);

  const fGroup = group.filter(matches);
  const fKnockout = knockout.filter(matches);

  const toggleLive = async (fixture) => {
    const next = fixture.status === 'live' ? 'scheduled' : 'live';
    setTogglingId(fixture._id);
    try {
      await update.mutateAsync({ fixtureId: fixture._id, body: { status: next } });
      toast.success(next === 'live' ? 'Match is now live' : 'Match set to scheduled');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setTogglingId(null);
    }
  };

  // Re-open a completed match to live so missed events can be appended/corrected
  // (Module 5B). Finalising the console re-completes it and re-runs the cascade.
  const reopen = async (fixture) => {
    setTogglingId(fixture._id);
    try {
      await update.mutateAsync({ fixtureId: fixture._id, body: { status: 'live' } });
      toast.success('Match re-opened to live');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setTogglingId(null);
    }
  };

  const saveSchedule = async (body) => {
    if (!scheduleTarget) return;
    setSavingSchedule(true);
    try {
      await update.mutateAsync({ fixtureId: scheduleTarget._id, body });
      toast.success('Schedule updated');
      setScheduleTarget(null);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingSchedule(false);
    }
  };

  const renderRow = (f) => (
    <FixtureRow
      key={f._id}
      fixture={f}
      sport={tournament.sportType}
      onResult={setResultTarget}
      onLive={setLiveTarget}
      onToggleLive={toggleLive}
      onReopen={reopen}
      onSchedule={setScheduleTarget}
      toggling={togglingId === f._id}
    />
  );

  const emptyState = (total) =>
    total > 0 ? (
      <EmptyState icon={Search} title="No matching fixtures" description="No fixtures match the current filter or search." />
    ) : (
      <EmptyState icon={CalendarPlus} title="No fixtures" description="Generate group fixtures above." />
    );

  const renderList = (list, total) =>
    list.length ? <div className="space-y-2">{list.map(renderRow)}</div> : emptyState(total);

  // Group tab: bucket by round-robin round under sticky "Round N" headers.
  const renderRounds = (list, total) =>
    list.length ? (
      <div className="space-y-6">
        {groupByRound(list).map((round) => (
          <div key={round.key}>
            <h3 className="sticky top-16 z-20 -mx-1 mb-2 rounded-xl border border-border/70 bg-background/90 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/75">
              {round.label}
              <span className="ml-2 font-normal normal-case text-muted-foreground/70">
                {round.fixtures.length} {round.fixtures.length === 1 ? 'match' : 'matches'}
              </span>
            </h3>
            <div className="space-y-2">{round.fixtures.map(renderRow)}</div>
          </div>
        ))}
      </div>
    ) : emptyState(total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixtures & results"
        description="Generate schedules, go live instantly, and update outcomes without leaving the workflow."
      />
      <GenerateCard tournament={tournament} tournamentId={tournamentId} hasFixtures={group.length > 0} />

      {!isLoading && fixtures.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <FilterChip key={f.id} active={status === f.id} onClick={() => setStatus(f.id)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team, round, venue…"
            className="w-full lg:w-72"
          />
        </div>
      )}

      {isError ? (
        <ErrorState title="Couldn't load fixtures" description="There was a problem reaching the server." onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonGrid count={4} media={false} />
      ) : (
        <Tabs defaultValue="group">
          <TabsList>
            <TabsTrigger value="group">Group ({fGroup.length})</TabsTrigger>
            <TabsTrigger value="knockout">Knockout ({fKnockout.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="group">{renderRounds(fGroup, group.length)}</TabsContent>
          <TabsContent value="knockout">{renderList(fKnockout, knockout.length)}</TabsContent>
        </Tabs>
      )}

      <Dialog open={!!resultTarget} onOpenChange={(o) => !o && setResultTarget(null)}>
        {resultTarget && (
          <ResultEntryDialog
            tournament={tournament}
            tournamentId={tournamentId}
            fixture={resultTarget}
            onClose={() => setResultTarget(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!liveTarget} onOpenChange={(o) => !o && setLiveTarget(null)}>
        {liveTarget && (
          <LiveScoring
            tournament={tournament}
            tournamentId={tournamentId}
            fixture={liveTarget}
            onClose={() => setLiveTarget(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!scheduleTarget} onOpenChange={(o) => !o && setScheduleTarget(null)}>
        {scheduleTarget && (
          <ScheduleDialog
            tournament={tournament}
            fixture={scheduleTarget}
            saving={savingSchedule}
            onSave={saveSchedule}
            onClose={() => setScheduleTarget(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
