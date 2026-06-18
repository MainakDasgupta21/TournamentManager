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
import { TeamCrest } from '@/components/ui/misc';
import RequestQueuePage from '@/components/admin/RequestQueuePage';
import ReviewActionDialog from '@/components/admin/ReviewActionDialog';

const PAGE_SIZE = 12;
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All requests' },
];

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
        <CardContent className="flex h-full flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start gap-3">
            <TeamCrest team={{ name: requester.name ?? 'Requester', primaryColor: '#6366f1' }} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{requester.name ?? 'Unknown requester'}</h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {requester.email ?? 'No email'}
              </p>
            </div>
            <Badge variant={status.variant} className="ml-auto shrink-0">{status.label}</Badge>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
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
              <Button asChild size="sm" variant="outline" className="w-full justify-start sm:w-auto">
                <Link to={`/admin/t/${tournament._id}`}>Open tournament</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Tournament no longer exists.</p>
            )}
          </div>

          {pending && (
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <Button
                size="sm"
                className="w-full"
                disabled={busy}
                aria-label={`Approve ${requester.name ?? 'requester'}`}
                onClick={() => onApprove(request)}
              >
                <Check /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={busy}
                aria-label={`Decline ${requester.name ?? 'requester'}`}
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
  const [reviewDraft, setReviewDraft] = useState(null);
  useDocumentTitle('Tournament access requests · Admin');

  const requests = data?.requests ?? [];
  const pages = data?.pages ?? 1;
  const hasSearch = debouncedQuery !== '';
  const activeMutationId = update.isPending ? update.variables?.id : null;

  useEffect(() => {
    const safePages = Math.max(pages, 1);
    if (!isFetching && page > safePages) setPage(safePages);
  }, [isFetching, page, pages]);

  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  const onApprove = (request) => setReviewDraft({ mode: 'approve', request });
  const onReject = (request) => setReviewDraft({ mode: 'reject', request });

  const onSubmitReview = async (note) => {
    if (!reviewDraft?.request) return;
    const request = reviewDraft.request;
    const status = reviewDraft.mode === 'approve' ? 'approved' : 'rejected';
    try {
      await update.mutateAsync({
        id: request._id,
        status,
        note: note || undefined,
        tournamentId: request.tournamentId?._id,
      });
      toast.success(status === 'approved' ? 'Tournament access approved' : 'Tournament access declined');
      setReviewDraft(null);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const selectedRequest = reviewDraft?.request;
  const selectedMode = reviewDraft?.mode ?? 'approve';
  const selectedRequester = selectedRequest?.requestedBy?.name ?? 'this organiser';
  const selectedTournament = selectedRequest?.tournamentId?.name ?? 'this tournament';
  const reviewTitle = selectedMode === 'approve'
    ? `Approve ${selectedRequester}?`
    : `Decline ${selectedRequester}?`;
  const reviewDescription = selectedMode === 'approve'
    ? `They will be able to manage ${selectedTournament}.`
    : 'They will not be granted management access to this tournament.';
  const reviewConfirmLabel = selectedMode === 'approve' ? 'Approve' : 'Decline request';

  return (
    <>
      <RequestQueuePage
        icon={ShieldCheck}
        title="Tournament access requests"
        description="Approve or decline per-tournament admin access"
        query={query}
        onQueryChange={(e) => setQuery(e.target.value)}
        searchPlaceholder="Search requester or tournament…"
        searchLabel="Search tournament access requests"
        searchWidthClassName="sm:w-72"
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        statusLabel="Filter tournament requests by status"
        isFetching={isFetching}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="Couldn't load tournament access requests"
        errorDescription="There was a problem reaching the server."
        isEmpty={!requests.length}
        hasSearch={hasSearch}
        emptyIcon={hasSearch ? Search : ShieldCheck}
        emptyTitle={hasSearch ? 'No matches' : status === 'pending' ? 'No pending requests' : 'Nothing here'}
        emptyDescription={
          hasSearch
            ? 'No requests match your search. Try a different requester or tournament name.'
            : status === 'pending'
              ? 'New tournament access requests will appear here for review.'
              : 'No requests match this filter.'
        }
        onClearSearch={() => setQuery('')}
        page={data?.page ?? page}
        pages={pages}
        onPage={setPage}
      >
        {requests.map((r) => (
          <RequestCard
            key={r._id}
            request={r}
            onApprove={onApprove}
            onReject={onReject}
            busy={activeMutationId === r._id}
          />
        ))}
      </RequestQueuePage>

      <ReviewActionDialog
        open={!!reviewDraft}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setReviewDraft(null);
        }}
        mode={selectedMode}
        title={reviewTitle}
        description={reviewDescription}
        confirmLabel={reviewConfirmLabel}
        isSubmitting={update.isPending}
        onConfirm={onSubmitReview}
      />
    </>
  );
}
