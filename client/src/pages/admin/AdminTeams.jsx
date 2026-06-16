import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Users, Shirt, X, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CRICKET_ROLES, FOOTBALL_POSITIONS, SPORTS } from '@tms/shared/constants';
import { useTeams, useTeam, useTeamMutations } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamCrest, EmptyState, ErrorState, SkeletonGrid } from '@/components/ui/misc';
import ImageUpload from '@/components/admin/ImageUpload';
import { Tooltip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

function AddTeamForm({ tournamentId, onDone }) {
  const { create } = useTeamMutations(tournamentId);
  const blank = { name: '', shortCode: '', primaryColor: '#3b82f6', logo: '' };
  const [form, setForm] = useState(blank);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ ...form, shortCode: form.shortCode.toUpperCase() });
      toast.success('Team added');
      setForm(blank);
      onDone?.();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Team name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mumbai Mavericks" required />
        </div>
        <div className="space-y-1.5">
          <Label>Short code</Label>
          <Input value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} placeholder="MUM" maxLength={4} required />
        </div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-10 p-1" />
        </div>
        <Button type="submit" disabled={create.isPending}><Plus /> Add</Button>
      </div>
      <ImageUpload
        label="Team logo (optional)"
        value={form.logo}
        onChange={(url) => setForm((f) => ({ ...f, logo: url }))}
        variant="logo"
      />
    </form>
  );
}

/** A roster entry that flips between a read-only row and an inline edit form. */
function PlayerRow({ player, roleOptions, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: player.name,
    role: player.role,
    jerseyNumber: player.jerseyNumber ?? '',
  });

  const startEdit = () => {
    setForm({ name: player.name, role: player.role, jerseyNumber: player.jerseyNumber ?? '' });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onUpdate(player._id, {
      name: form.name.trim(),
      role: form.role,
      // Empty leaves the number unchanged (the schema can't store null).
      jerseyNumber: form.jerseyNumber === '' ? undefined : Number(form.jerseyNumber),
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <li className="grid grid-cols-[1fr_120px_64px_auto] items-center gap-2 py-2">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-label="Player name"
        />
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={form.jerseyNumber}
          onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
          aria-label="Jersey number"
        />
        <div className="flex gap-1">
          <Button size="icon" className="h-8 w-8" onClick={save} disabled={saving} aria-label="Save player">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)} aria-label="Cancel edit">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-xs font-bold">{player.jerseyNumber ?? '–'}</span>
      <span className="flex-1 text-sm font-medium">{player.name}</span>
      <span className="text-xs uppercase text-muted-foreground">{player.role}</span>
      <Tooltip label="Edit player">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} aria-label="Edit player">
          <Pencil className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip label="Remove player">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(player._id)} aria-label="Remove player">
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
    </li>
  );
}

function RosterDialog({ tournamentId, team, sport }) {
  const { data } = useTeam(tournamentId, team._id);
  const { addPlayer, updatePlayer, removePlayer } = useTeamMutations(tournamentId);
  const roleOptions = sport === SPORTS.CRICKET ? CRICKET_ROLES : FOOTBALL_POSITIONS;
  const [form, setForm] = useState({ name: '', role: roleOptions[0], jerseyNumber: '' });

  const players = data?.players ?? [];

  const onUpdatePlayer = async (playerId, body) => {
    try {
      await updatePlayer.mutateAsync({ teamId: team._id, playerId, body });
      toast.success('Player updated');
      return true;
    } catch (err) {
      toast.error(apiError(err));
      return false;
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await addPlayer.mutateAsync({
        teamId: team._id,
        body: {
          name: form.name,
          role: form.role,
          jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
        },
      });
      toast.success('Player added');
      setForm({ name: '', role: roleOptions[0], jerseyNumber: '' });
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const onRemovePlayer = (playerId) => {
    removePlayer.mutate(
      { teamId: team._id, playerId },
      { onSuccess: () => toast.success('Player removed'), onError: (e) => toast.error(apiError(e)) }
    );
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Shirt className="h-4 w-4" /> {team.name} — Roster</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-[1fr_120px_70px_auto] items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">Player</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-1"><Label className="text-xs">{sport === SPORTS.CRICKET ? 'Role' : 'Position'}</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">#</Label>
          <Input type="number" value={form.jerseyNumber} onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} />
        </div>
        <Button type="submit" size="icon" disabled={addPlayer.isPending}><Plus /></Button>
      </form>
      <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
        {players.length ? players.map((p) => (
          <PlayerRow
            key={p._id}
            player={p}
            roleOptions={roleOptions}
            onUpdate={onUpdatePlayer}
            onRemove={onRemovePlayer}
          />
        )) : <p className="py-4 text-center text-sm text-muted-foreground">No players yet.</p>}
      </ul>
    </DialogContent>
  );
}

export default function AdminTeams() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: teams = [], isLoading, isError, refetch } = useTeams(tournamentId);
  const { remove } = useTeamMutations(tournamentId);
  const confirm = useConfirm();

  const onRemoveTeam = async (team) => {
    const ok = await confirm({
      title: `Delete ${team.name}?`,
      description: 'The team and its roster will be removed from this tournament.',
      confirmLabel: 'Delete team',
    });
    if (!ok) return;
    remove.mutate(team._id, {
      onSuccess: () => toast.success('Team deleted'),
      onError: (e) => toast.error(apiError(e)),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl tracking-wide">Teams</h2>

      <Card>
        <CardHeader><CardTitle>Add a team</CardTitle></CardHeader>
        <CardContent><AddTeamForm tournamentId={tournamentId} /></CardContent>
      </Card>

      {isError ? (
        <ErrorState title="Couldn't load teams" description="There was a problem reaching the server." onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonGrid count={6} media={false} />
      ) : !teams.length ? (
        <EmptyState icon={Users} title="No teams yet" description="Add teams above to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team._id}>
              <CardContent className="flex items-center gap-3 p-4">
                <TeamCrest team={team} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.shortCode}{team.seed ? ` · seed ${team.seed}` : ''}</p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm"><Shirt /> Roster</Button>
                  </DialogTrigger>
                  <RosterDialog tournamentId={tournamentId} team={team} sport={tournament.sportType} />
                </Dialog>
                <Tooltip label="Delete team">
                  <Button variant="ghost" size="icon" onClick={() => onRemoveTeam(team)} aria-label="Delete team">
                    <Trash2 className="text-destructive" />
                  </Button>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
