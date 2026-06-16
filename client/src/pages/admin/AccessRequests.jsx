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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, SkeletonGrid, TeamCrest, SearchInput, Pager, Spinner } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 12;

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
              <p className="truncate font-semibold">{user.name}</p>
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
              <Button size="sm" className="flex-1" disabled={busy} onClick={() => onApprove(user)}>
                <Check /> Approve
              </Button>
              <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => onReject(user)}>
                <X /> Decline
              </Button>
            </div>
          ) : (
            <div className="mt-auto pt-1">
              {user.approvalStatus === 'approved' ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject(user)}>
                  <X /> Revoke access
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onApprove(user)}>
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
  const confirm = useConfirm();
  useDocumentTitle('Access requests · Admin');

  const users = data?.users ?? [];
  const pages = data?.pages ?? 1;
  const hasSearch = debouncedQuery !== '';

  // Clamp the page if the result set shrank (e.g. after approving the last item).
  useEffect(() => {
    if (!isFetching && page > pages) setPage(pages);
  }, [isFetching, page, pages]);

  // Organisers must never reach this maintainer-only screen.
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  const onApprove = async (user) => {
    const ok = await confirm({
      title: `Approve ${user.name}?`,
      description: `${user.email} will be able to sign in and manage tournaments.`,
      confirmLabel: 'Approve',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await update.mutateAsync({ id: user._id, status: 'approved' });
      toast.success(`${user.name} approved`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onReject = async (user) => {
    const reapproved = user.approvalStatus === 'approved';
    const ok = await confirm({
      title: reapproved ? `Revoke access for ${user.name}?` : `Decline ${user.name}?`,
      description: reapproved
        ? 'They will be signed out and blocked from the admin panel.'
        : 'They will not be able to sign in. You can approve them later.',
      confirmLabel: reapproved ? 'Revoke access' : 'Decline request',
    });
    if (!ok) return;
    try {
      await update.mutateAsync({ id: user._id, status: 'rejected' });
      toast.success(reapproved ? 'Access revoked' : 'Request declined');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-4xl tracking-wide">
            <ShieldCheck className="h-7 w-7 text-primary" /> Access requests
          </h1>
          <p className="text-muted-foreground">Approve or decline organiser accounts</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="w-full sm:w-64"
            />
            {isFetching && <Spinner className="h-4 w-4 shrink-0" />}
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Declined</SelectItem>
              <SelectItem value="all">All accounts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid count={3} media={false} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load access requests"
          description="There was a problem reaching the server."
          onRetry={refetch}
        />
      ) : !users.length ? (
        <EmptyState
          icon={hasSearch ? Search : ShieldCheck}
          title={hasSearch ? 'No matches' : status === 'pending' ? 'No pending requests' : 'Nothing here'}
          description={
            hasSearch
              ? 'No accounts match your search. Try a different name or email.'
              : status === 'pending'
                ? 'New organiser sign-ups will appear here for review.'
                : 'No accounts match this filter.'
          }
          action={hasSearch ? <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((u) => (
              <RequestCard
                key={u._id}
                user={u}
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
