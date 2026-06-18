import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Shuffle, Plus, Trash2, Layers, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTeams, useGroups, useGroupMutations } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamCrest, EmptyState, ErrorState, SkeletonGrid } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function AdminGroups() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: teams = [], isLoading, isError: teamsError, refetch: refetchTeams } = useTeams(tournamentId);
  const { data: groups = [], isError: groupsError, refetch: refetchGroups } = useGroups(tournamentId);
  const { create, update, remove, autoDistribute } = useGroupMutations(tournamentId);
  const confirm = useConfirm();

  const onRemoveGroup = async (group) => {
    const ok = await confirm({
      title: `Delete ${group.name}?`,
      description: 'Teams in this group will become unassigned.',
      confirmLabel: 'Delete group',
    });
    if (ok) remove.mutate(group._id);
  };

  const [numGroups, setNumGroups] = useState(tournament.groupSettings?.numberOfGroups ?? 2);
  const [newGroupName, setNewGroupName] = useState('');

  const assignedIds = new Set(groups.flatMap((g) => g.teams.map((t) => t._id)));
  const unassigned = teams.filter((t) => !assignedIds.has(t._id));

  const runAutoDistribute = async () => {
    if (teams.length < 2) return toast.error('Add at least 2 teams first');
    if (groups.length > 0) {
      const ok = await confirm({
        title: 'Replace existing groups?',
        description: 'Auto-distribute rebuilds every group from seed order, replacing the current team assignments.',
        confirmLabel: 'Replace groups',
      });
      if (!ok) return;
    }
    // Seed order = current sort (seed asc, then name) from the teams query.
    const seededTeamIds = teams.map((t) => t._id);
    try {
      await autoDistribute.mutateAsync({ numberOfGroups: Number(numGroups), seededTeamIds });
      toast.success('Teams distributed via snake draft');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await create.mutateAsync({ name: newGroupName.trim(), teams: [] });
      setNewGroupName('');
      toast.success('Group created');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const addTeamToGroup = (group, teamId) => {
    update.mutate(
      { groupId: group._id, body: { teams: [...group.teams.map((t) => t._id), teamId] } },
      { onSuccess: () => toast.success(`Team added to ${group.name}`), onError: (e) => toast.error(apiError(e)) }
    );
  };
  const removeTeamFromGroup = (group, teamId) => {
    update.mutate(
      { groupId: group._id, body: { teams: group.teams.filter((t) => t._id !== teamId).map((t) => t._id) } },
      { onSuccess: () => toast.success(`Team removed from ${group.name}`), onError: (e) => toast.error(apiError(e)) }
    );
  };

  if (teamsError || groupsError) {
    return (
      <ErrorState
        title="Couldn't load groups"
        description="There was a problem reaching the server."
        onRetry={() => { refetchTeams(); refetchGroups(); }}
      />
    );
  }

  if (isLoading) return <SkeletonGrid count={4} media={false} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Distribute teams quickly and fine-tune group composition with an efficient seeded flow."
      />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shuffle className="h-4 w-4" /> Seeded snake draft</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4 sm:gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="num-groups">Number of groups</Label>
            <Input id="num-groups" type="number" min={1} value={numGroups} onChange={(e) => setNumGroups(e.target.value)} className="w-32" />
          </div>
          <Button onClick={runAutoDistribute} disabled={autoDistribute.isPending}>
            <Shuffle /> Auto-distribute {teams.length} teams
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Distributes teams by seed order (1→A, 2→B, … then snake back). Replaces existing groups.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Create a group manually</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group A" className="w-full max-w-sm" />
          <Button onClick={addGroup} disabled={create.isPending}><Plus /> Add group</Button>
        </CardContent>
      </Card>

      {unassigned.length > 0 && (
        <p className="rounded-xl border border-border/70 bg-card/55 px-3 py-2 text-sm text-muted-foreground">
          {unassigned.length} team(s) not yet assigned to a group.
        </p>
      )}

      {!groups.length ? (
        <EmptyState icon={Layers} title="No groups yet" description="Auto-distribute or create groups above." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group._id}>
              <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <CardTitle className="font-display text-2xl tracking-wide">{group.name}</CardTitle>
                <Tooltip label="Delete group">
                  <Button variant="ghost" size="icon" onClick={() => onRemoveGroup(group)} aria-label="Delete group">
                    <Trash2 className="text-destructive" />
                  </Button>
                </Tooltip>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5">
                  {group.teams.length ? group.teams.map((t) => (
                    <li key={t._id} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/55 px-3 py-2">
                      <TeamCrest team={t} size="sm" />
                      <span className="flex-1 text-sm font-medium">{t.name}</span>
                      <Tooltip label="Remove from group">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTeamFromGroup(group, t._id)} aria-label="Remove from group">
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </Tooltip>
                    </li>
                  )) : <p className="text-sm text-muted-foreground">No teams.</p>}
                </ul>
                {unassigned.length > 0 && (
                  <Select onValueChange={(teamId) => addTeamToGroup(group, teamId)} value="">
                    <SelectTrigger className="h-9"><SelectValue placeholder="+ Add team" /></SelectTrigger>
                    <SelectContent>
                      {unassigned.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
