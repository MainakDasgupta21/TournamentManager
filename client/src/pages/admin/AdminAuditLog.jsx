import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  History, RefreshCw, ChevronDown, ChevronRight,
  Plus, Pencil, Trash2, RotateCcw, Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { AUDIT_ENTITY, AUDIT_ACTION } from '@tms/shared/constants';
import { useAuditLogs, useRecalculate } from '@/hooks/queries';
import { useConfirm } from '@/components/ui/confirm';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, Spinner, Skeleton } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';

const ENTITY_LABELS = {
  [AUDIT_ENTITY.RESULT]: 'Result',
  [AUDIT_ENTITY.EVENT]: 'Event',
  [AUDIT_ENTITY.FIXTURE]: 'Fixture',
  [AUDIT_ENTITY.POINTS_CONFIG]: 'Points config',
  [AUDIT_ENTITY.KNOCKOUT]: 'Knockout',
  [AUDIT_ENTITY.TOURNAMENT]: 'Tournament',
  [AUDIT_ENTITY.STANDINGS]: 'Recalculation',
};

const ACTION_META = {
  [AUDIT_ACTION.CREATE]: { label: 'Added', icon: Plus, className: 'text-[hsl(var(--success))]' },
  [AUDIT_ACTION.UPDATE]: { label: 'Edited', icon: Pencil, className: 'text-primary' },
  [AUDIT_ACTION.DELETE]: { label: 'Deleted', icon: Trash2, className: 'text-destructive' },
  [AUDIT_ACTION.REOPEN]: { label: 'Re-opened', icon: RotateCcw, className: 'text-[hsl(var(--warning))]' },
  [AUDIT_ACTION.RECALCULATE]: { label: 'Recalculated', icon: Calculator, className: 'text-accent' },
};

const ALL = '__all__';

/** Full recalculation trigger with the downstream-invalidation confirm flow. */
function RecalculateButton({ tournamentId }) {
  const recalc = useRecalculate(tournamentId);
  const confirm = useConfirm();

  const run = async () => {
    const ok = await confirm({
      title: 'Recalculate everything?',
      description:
        'Rebuilds all group standings and player stats, and re-evaluates the knockout bracket from the recorded results.',
      confirmLabel: 'Recalculate',
      variant: 'default',
    });
    if (!ok) return;

    try {
      let res = await recalc.mutateAsync(false);
      if (res?.requiresConfirm) {
        const affected = res.affected ?? [];
        const list = affected
          .map((a) => `#${a.matchNumber ?? '?'}${a.roundName ? ` (${a.roundName})` : ''}`)
          .join(', ');
        const ok2 = await confirm({
          title: 'Reset downstream knockout matches?',
          description:
            `Recalculation found ${affected.length} already-played match(es) whose result no longer ` +
            `matches the bracket: ${list}. Confirm to reset them to scheduled and re-advance.`,
          confirmLabel: 'Reset & recalculate',
        });
        if (!ok2) return;
        res = await recalc.mutateAsync(true);
      }
      toast.success(
        `Recalculated · ${res.groups} group(s), ${res.playersUpdated} player(s)${
          res.bracketChanged ? ', bracket updated' : ''
        }`
      );
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Button onClick={run} disabled={recalc.isPending} variant="outline">
      <RefreshCw className={recalc.isPending ? 'animate-spin' : ''} /> Recalculate all
    </Button>
  );
}

function Json({ value }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground scrollbar-thin">
      {value == null ? '—' : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AuditRow({ log }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[log.action] ?? ACTION_META[AUDIT_ACTION.UPDATE];
  const Icon = meta.icon;
  const hasDiff = log.before != null || log.after != null;

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => hasDiff && setOpen((o) => !o)}
          className="flex w-full items-start gap-3 text-left"
        >
          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary ${meta.className}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ENTITY_LABELS[log.entityType] ?? log.entityType}</Badge>
              <span className={`text-sm font-semibold ${meta.className}`}>{meta.label}</span>
              <span className="truncate text-sm text-muted-foreground">{log.summary}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {log.editedByName || 'System'} · {formatDateTime(log.createdAt)}
            </p>
          </div>
          {hasDiff && (
            open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {open && hasDiff && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Before</p>
              <Json value={log.before} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">After</p>
              <Json value={log.after} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAuditLog() {
  const { tournamentId } = useOutletContext();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState(ALL);

  const filters = { page, limit: 25, ...(entityType !== ALL ? { entityType } : {}) };
  const { data, isLoading, isFetching, isError, refetch } = useAuditLogs(tournamentId, filters);
  const items = data?.items ?? [];
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Audit log"
        description="Review every scoring and configuration change, then recalculate standings and stats when required."
        actions={<RecalculateButton tournamentId={tournamentId} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={entityType}
          onValueChange={(v) => { setEntityType(v); setPage(1); }}
        >
          <SelectTrigger className="w-52"><SelectValue placeholder="All changes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All changes</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFetching && <Spinner className="h-4 w-4" />}
        <p className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">
          {data?.total ?? 0} change{(data?.total ?? 0) === 1 ? '' : 's'} recorded
        </p>
      </div>

      {isError ? (
        <ErrorState title="Couldn't load the audit log" description="There was a problem reaching the server." onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No changes yet"
          description="Result entries, event edits and configuration changes will appear here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((log) => <AuditRow key={log._id} log={log} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {data?.page ?? page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
