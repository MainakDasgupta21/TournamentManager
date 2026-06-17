import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, UserPlus, Crown, Trash2, Search, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLES } from '@tms/shared/constants';
import {
  useTournamentAdmins,
  useAdminCandidates,
  useCollaboratorMutations,
} from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';

/** Coloured initials avatar derived from a name. */
function Avatar({ name }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
      {initials || '?'}
    </span>
  );
}

function PersonRow({ person, badge, action }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={person.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{person.name}</p>
          {badge}
        </div>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" /> {person.email}
        </p>
      </div>
      {action}
    </li>
  );
}

/** Search + assign panel — super-admin-only. */
function AddCollaborator({ tournamentId, assign }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: candidates = [], isFetching } = useAdminCandidates(tournamentId, debounced);
  const showResults = debounced.length >= 2;

  const onAdd = (candidate) => {
    assign.mutate(candidate._id, {
      onSuccess: () => {
        toast.success(`${candidate.name} added as a collaborator`);
        setQ('');
      },
      onError: (e) => toast.error(apiError(e)),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Add a collaborator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Search approved organisers by name or email. Collaborators can manage everything
          except adding or removing other collaborators.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organisers…"
            className="pl-9"
            type="search"
          />
        </div>

        {showResults && (
          <div className="rounded-lg border border-border">
            {isFetching && !candidates.length ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : candidates.length ? (
              <ul className="divide-y divide-border/60 px-3">
                {candidates.map((c) => (
                  <PersonRow
                    key={c._id}
                    person={c}
                    action={
                      <Button size="sm" onClick={() => onAdd(c)} disabled={assign.isPending}>
                        <UserPlus className="h-4 w-4" /> Add
                      </Button>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No approved organisers match “{debounced}”.
              </p>
            )}
          </div>
        )}
        {!showResults && q.trim().length === 1 && (
          <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminCollaborators() {
  const { tournamentId } = useOutletContext();
  const user = useAuth((s) => s.user);
  const confirm = useConfirm();

  const { data, isLoading, isError, refetch } = useTournamentAdmins(tournamentId);
  const { assign, remove } = useCollaboratorMutations(tournamentId);

  const canManage = user?.role === USER_ROLES.SUPER_ADMIN;

  const owner = data?.owner ?? null;
  const admins = data?.admins ?? [];

  const onRemove = async (admin) => {
    const ok = await confirm({
      title: `Remove ${admin.name}?`,
      description: 'They will immediately lose management access to this tournament.',
      confirmLabel: 'Remove collaborator',
    });
    if (!ok) return;
    remove.mutate(admin._id, {
      onSuccess: () => toast.success('Collaborator removed'),
      onError: (e) => toast.error(apiError(e)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide">Collaborators</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          People who can manage this tournament. Super admins control collaborator access.
        </p>
      </div>

      {isError ? (
        <ErrorState
          title="Couldn't load collaborators"
          description="There was a problem reaching the server."
          onRetry={refetch}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Management team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60">
                {owner && (
                  <PersonRow
                    person={owner}
                    badge={
                      <Badge variant="outline" className="gap-1">
                        <Crown className="h-3 w-3 text-amber-400" /> Owner
                      </Badge>
                    }
                  />
                )}
                {admins.map((admin) => (
                  <PersonRow
                    key={admin._id}
                    person={admin}
                    badge={
                      admin.role === USER_ROLES.SUPER_ADMIN ? (
                        <Badge variant="outline" className="gap-1">
                          <ShieldCheck className="h-3 w-3 text-primary" /> Super admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Collaborator</Badge>
                      )
                    }
                    action={
                      canManage ? (
                        <Tooltip label="Remove collaborator">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemove(admin)}
                            disabled={remove.isPending}
                            aria-label={`Remove ${admin.name}`}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </Tooltip>
                      ) : null
                    }
                  />
                ))}
              </ul>

              {!admins.length && (
                <EmptyState
                  icon={Users}
                  title="No collaborators yet"
                  description={
                    canManage
                      ? 'Add an approved organiser below to share management of this tournament.'
                      : 'Only the owner has management access right now.'
                  }
                />
              )}
            </CardContent>
          </Card>

          {canManage ? (
            <AddCollaborator tournamentId={tournamentId} assign={assign} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only super admins can add or remove collaborators.
            </p>
          )}
        </>
      )}
    </div>
  );
}
