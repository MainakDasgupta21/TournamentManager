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
import ResultEntryDialog from '@/components/admin/ResultEntryDialog';
import LiveScoring from '@/components/admin/LiveScoring';
import { formatDateTime, resultSummary } from '@/lib/format';

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
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>First match date</Label>
          <Input type="date" value={opts.startDate} onChange={(e) => setOpts({ ...opts, startDate: e.target.value })} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label>Days between rounds</Label>
          <Input type="number" min={0} value={opts.daysBetweenRounds} onChange={(e) => setOpts({ ...opts, daysBetweenRounds: e.target.value })} className="w-36" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Double round-robin</span>
          <Switch checked={opts.doubleRoundRobin} onCheckedChange={(v) => setOpts({ ...opts, doubleRoundRobin: v })} />
        </div>
        <Button onClick={run} disabled={generateGroupStage.isPending} variant={hasFixtures ? 'outline' : 'default'}>
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
          <Label>Date &amp; time</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Venue</Label>
          <Input
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
      <span className="w-8 text-center text-xs font-bold text-muted-foreground">{fixture.matchNumber ?? '–'}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          <span className={String(winnerId) === String(fixture.teamA?._id) ? 'font-semibold' : ''}>
            {fixture.teamA?.name || fixture.placeholderA || 'TBD'}
          </span>
          {fixture.teamA && <TeamCrest team={fixture.teamA} size="sm" />}
        </div>
        <span className="px-2 text-xs font-bold text-muted-foreground">
          {completed ? (resultSummary(fixture) || 'vs') : 'vs'}
        </span>
        <div className="flex flex-1 items-center gap-2">
          {fixture.teamB && <TeamCrest team={fixture.teamB} size="sm" />}
          <span className={String(winnerId) === String(fixture.teamB?._id) ? 'font-semibold' : ''}>
            {fixture.teamB?.name || fixture.placeholderB || 'TBD'}
          </span>
        </div>
      </div>
      <span className="w-full text-xs text-muted-foreground sm:w-auto">
        {formatDateTime(fixture.scheduledAt)}{fixture.venue ? ` · ${fixture.venue}` : ''}
      </span>
      <FixtureStatusBadge status={fixture.status} sport={sport} />
      <div className="flex gap-1.5">
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

  const renderList = (list, total) =>
    list.length ? (
      <div className="space-y-2">
        {list.map((f) => (
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
        ))}
      </div>
    ) : total > 0 ? (
      <EmptyState icon={Search} title="No matching fixtures" description="No fixtures match the current filter or search." />
    ) : (
      <EmptyState icon={CalendarPlus} title="No fixtures" description="Generate group fixtures above." />
    );

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl tracking-wide">Fixtures &amp; results</h2>
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
          <TabsContent value="group">{renderList(fGroup, group.length)}</TabsContent>
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
