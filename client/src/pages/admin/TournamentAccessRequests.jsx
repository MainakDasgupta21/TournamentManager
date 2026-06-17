import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Check, X, Mail, Building2, Clock, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useTournamentAccessRequests, useReviewTournamentAccessRequest } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiError } from '@/lib/api';
import { formatDate, sportLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, SkeletonGrid, TeamCrest, SearchInput, Pager, Spinner } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';

const PAGE_SIZE = 12;

const STATUS_BADGE = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Declined', variant: 'live' },
};

function RequestCard({ request, onApprove, onReject, busy }) {
  const status = STATUS_BADGE[request.status] ?? STATUS_BADGE.pending;
  const pending = request.status === 'pending';
  const requester = request.requestedBy ?? {};
  const tournament = request.tournamentId ?? {};

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <TeamCrest team={{ name: requester.name ?? 'Requester', primaryColor: '#6366f1' }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{requester.name ?? 'Unknown requester'}</p>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {requester.email ?? 'No email'}
              </p>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tournament.name ?? 'Tournament removed'}</span>
              {tournament.sportType && <Badge variant="outline">{sportLabel(tournament.sportType)}</Badge>}
            </p>
            {requester.organization && (
              <p className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" /> {requester.organization}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" /> Requested {formatDate(request.createdAt)}
            </p>
            {request.reviewNote && (
              <p className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-xs">
                Note: {request.reviewNote}
              </p>
            )}
          </div>

          <div className="mt-auto">
            {tournament._id ? (
              <Button asChild size="sm" variant="ghost" className="px-0 text-primary">
                <Link to={`/admin/t/${tournament._id}`}>Open tournament</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Tournament no longer exists.</p>
            )}
          </div>

          {pending && (
            <div className="mt-auto flex gap-2 pt-1">
              <Button size="sm" className="flex-1" disabled={busy} onClick={() => onApprove(request)}>
                <Check /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => onReject(request)}
              >
                <X /> Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function TournamentAccessRequests() {
  const isSuperAdmin = useAuth((s) => s.isSuperAdmin());
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedQuery]);

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(status !== 'all' ? { status } : {}),
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  };
  const { data, isLoading, isError, isFetching, refetch } = useTournamentAccessRequests(filters);
  const update = useReviewTournamentAccessRequest();
  const confirm = useConfirm();
  useDocumentTitle('Tournament access requests · Admin');

  const requests = data?.requests ?? [];
  const pages = data?.pages ?? 1;
  const hasSearch = debouncedQuery !== '';

  useEffect(() => {
    if (!isFetching && page > pages) setPage(pages);
  }, [isFetching, page, pages]);

  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  const onApprove = async (request) => {
    const requester = request.requestedBy?.name ?? 'this organiser';
    const tournament = request.tournamentId?.name ?? 'this tournament';
    const ok = await confirm({
      title: `Approve ${requester}?`,
      description: `They will be able to manage ${tournament}.`,
      confirmLabel: 'Approve',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await update.mutateAsync({
        id: request._id,
        status: 'approved',
        tournamentId: request.tournamentId?._id,
      });
      toast.success('Tournament access approved');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onReject = async (request) => {
    const requester = request.requestedBy?.name ?? 'this organiser';
    const ok = await confirm({
      title: `Decline ${requester}?`,
      description: 'They will not be granted management access to this tournament.',
      confirmLabel: 'Decline request',
    });
    if (!ok) return;
    try {
      await update.mutateAsync({
        id: request._id,
        status: 'rejected',
        tournamentId: request.tournamentId?._id,
      });
      toast.success('Request declined');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-4xl tracking-wide">
            <ShieldCheck className="h-7 w-7 text-primary" /> Tournament access requests
          </h1>
          <p className="text-muted-foreground">Approve or decline per-tournament admin access</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search requester or tournament…"
              className="w-full sm:w-72"
            />
            {isFetching && <Spinner className="h-4 w-4 shrink-0" />}
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Declined</SelectItem>
              <SelectItem value="all">All requests</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid count={3} media={false} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load tournament access requests"
          description="There was a problem reaching the server."
          onRetry={refetch}
        />
      ) : !requests.length ? (
        <EmptyState
          icon={hasSearch ? Search : ShieldCheck}
          title={hasSearch ? 'No matches' : status === 'pending' ? 'No pending requests' : 'Nothing here'}
          description={
            hasSearch
              ? 'No requests match your search. Try a different requester or tournament name.'
              : status === 'pending'
                ? 'New tournament access requests will appear here for review.'
                : 'No requests match this filter.'
          }
          action={hasSearch ? <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => (
              <RequestCard
                key={r._id}
                request={r}
                onApprove={onApprove}
                onReject={onReject}
                busy={update.isPending}
              />
            ))}
          </div>
          <Pager page={data?.page ?? page} pages={pages} onPage={setPage} className="mt-8" />
        </>
      )}
    </div>
  );
}
