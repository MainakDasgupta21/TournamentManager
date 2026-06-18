import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Check, X, Mail, Building2, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useUsers, useUpdateApproval } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TeamCrest } from '@/components/ui/misc';
import { formatDate } from '@/lib/format';
import RequestQueuePage from '@/components/admin/RequestQueuePage';
import ReviewActionDialog from '@/components/admin/ReviewActionDialog';

const PAGE_SIZE = 12;
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All accounts' },
];

const STATUS_BADGE = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Declined', variant: 'live' },
};

function RequestCard({ user, onApprove, onReject, busy }) {
  const status = STATUS_BADGE[user.approvalStatus] ?? STATUS_BADGE.pending;
  const pending = user.approvalStatus === 'pending';
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <TeamCrest team={{ name: user.name, primaryColor: '#6366f1' }} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{user.name}</h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {user.email}
              </p>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            {user.organization && (
              <p className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" /> {user.organization}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" /> Requested {formatDate(user.createdAt)}
            </p>
          </div>

          {pending ? (
            <div className="mt-auto flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy}
                aria-label={`Approve ${user.name}`}
                onClick={() => onApprove(user)}
              >
                <Check /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                aria-label={`Decline ${user.name}`}
                onClick={() => onReject(user)}
              >
                <X /> Decline
              </Button>
            </div>
          ) : (
            <div className="mt-auto pt-1">
              {user.approvalStatus === 'approved' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Revoke access for ${user.name}`}
                  onClick={() => onReject(user)}
                >
                  <X /> Revoke access
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Approve ${user.name}`}
                  onClick={() => onApprove(user)}
                >
                  <Check /> Approve anyway
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AccessRequests() {
  const isSuperAdmin = useAuth((s) => s.isSuperAdmin());
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  // Changing the status filter or search term jumps back to the first page.
  useEffect(() => { setPage(1); }, [status, debouncedQuery]);

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(status !== 'all' ? { status } : {}),
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  };
  const { data, isLoading, isError, isFetching, refetch } = useUsers(filters);
  const update = useUpdateApproval();
  const [reviewDraft, setReviewDraft] = useState(null);
  useDocumentTitle('Access requests · Admin');

  const users = data?.users ?? [];
  const pages = data?.pages ?? 1;
  const hasSearch = debouncedQuery !== '';
  const activeMutationId = update.isPending ? update.variables?.id : null;

  // Clamp the page if the result set shrank (e.g. after approving the last item).
  useEffect(() => {
    if (!isFetching && page > pages) setPage(pages);
  }, [isFetching, page, pages]);

  // Organisers must never reach this maintainer-only screen.
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  const onApprove = (user) => setReviewDraft({ mode: 'approve', user });
  const onReject = (user) => setReviewDraft({ mode: 'reject', user });

  const onSubmitReview = async (note) => {
    if (!reviewDraft?.user) return;
    const user = reviewDraft.user;
    const isApprove = reviewDraft.mode === 'approve';
    const status = isApprove ? 'approved' : 'rejected';
    const isRevoke = !isApprove && user.approvalStatus === 'approved';

    try {
      await update.mutateAsync({
        id: user._id,
        status,
        note: note || undefined,
      });
      toast.success(
        isApprove
          ? `${user.name} approved`
          : isRevoke
            ? `Access revoked for ${user.name}`
            : `Request declined for ${user.name}`
      );
      setReviewDraft(null);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const selectedUser = reviewDraft?.user;
  const selectedMode = reviewDraft?.mode ?? 'approve';
  const isApproveAction = selectedMode === 'approve';
  const isRevokeAction = !isApproveAction && selectedUser?.approvalStatus === 'approved';
  const reviewTitle = selectedUser
    ? isApproveAction
      ? `Approve ${selectedUser.name}?`
      : isRevokeAction
        ? `Revoke access for ${selectedUser.name}?`
        : `Decline ${selectedUser.name}?`
    : '';
  const reviewDescription = selectedUser
    ? isApproveAction
      ? `${selectedUser.email} will be able to sign in and manage tournaments.`
      : isRevokeAction
        ? 'They will be signed out and blocked from the admin panel.'
        : 'They will not be able to sign in. You can approve them later.'
    : '';
  const reviewConfirmLabel = isApproveAction
    ? 'Approve'
    : isRevokeAction
      ? 'Revoke access'
      : 'Decline request';

  return (
    <>
      <RequestQueuePage
        icon={ShieldCheck}
        title="Access requests"
        description="Approve or decline organiser accounts"
        query={query}
        onQueryChange={(e) => setQuery(e.target.value)}
        searchPlaceholder="Search name or email…"
        searchLabel="Search organiser requests"
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        statusLabel="Filter organiser requests by status"
        isFetching={isFetching}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="Couldn't load access requests"
        errorDescription="There was a problem reaching the server."
        isEmpty={!users.length}
        hasSearch={hasSearch}
        emptyIcon={hasSearch ? Search : ShieldCheck}
        emptyTitle={hasSearch ? 'No matches' : status === 'pending' ? 'No pending requests' : 'Nothing here'}
        emptyDescription={
          hasSearch
            ? 'No accounts match your search. Try a different name or email.'
            : status === 'pending'
              ? 'New organiser sign-ups will appear here for review.'
              : 'No accounts match this filter.'
        }
        onClearSearch={() => setQuery('')}
        page={data?.page ?? page}
        pages={pages}
        onPage={setPage}
      >
        {users.map((u) => (
          <RequestCard
            key={u._id}
            user={u}
            onApprove={onApprove}
            onReject={onReject}
            busy={activeMutationId === u._id}
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
