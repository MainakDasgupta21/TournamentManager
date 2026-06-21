import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Users, Shirt, X, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  CRICKET_ROLES,
  FOOTBALL_POSITIONS,
  PLAYER_CATEGORIES,
  SPORTS,
  footballPositionLabel,
  normalizeFootballPosition,
} from '@tms/shared/constants';
import { useTeams, useTeam, useTeamMutations } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamCrest, EmptyState, ErrorState, SkeletonGrid } from '@/components/ui/misc';
import { PlayerCategoryBadge } from '@/components/ui/player-category-badge';
import ImageUpload from '@/components/admin/ImageUpload';
import FormationEditor from '@/components/admin/FormationEditor';
import { Tooltip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { PageHeader } from '@/components/ui/page-header';
import { assignedFormationPlayerIds, normalizeFormation } from '@/lib/formation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Radix Select needs a non-empty value, so "Unrated" uses a sentinel that maps
// back to `null` on the way to the API.
const UNRATED = 'unrated';
const CATEGORY_OPTIONS = [UNRATED, ...PLAYER_CATEGORIES];
const toCategoryPayload = (v) => (v === UNRATED ? null : v);

/** Short, sport-aware roster summary line (matches · key stats). */
function playerStatSummary(player, sport) {
  if (sport === SPORTS.CRICKET) {
    const c = player.stats?.cricket ?? {};
    return `${c.matches ?? 0} M · ${c.runs ?? 0} runs · ${c.wickets ?? 0} wkts`;
  }
  const f = player.stats?.football ?? {};
  return `${f.appearances ?? 0} apps · ${f.goals ?? 0} G · ${f.assists ?? 0} A`;
}

/** Tier dropdown shared by the add form and inline edit. */
function CategorySelect({ value, onChange, ...props }) {
  return (
    <Select value={value} onValueChange={onChange} {...props}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {CATEGORY_OPTIONS.map((c) => (
          <SelectItem key={c} value={c}>{c === UNRATED ? 'Unrated' : c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
        <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto"><Plus /> Add</Button>
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
function PlayerRow({ player, sport, roleOptions, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const normalizeRole = (role) => {
    if (sport !== SPORTS.FOOTBALL) return role;
    const normalized = normalizeFootballPosition(role);
    if (!normalized) return roleOptions[0];
    return roleOptions.includes(normalized) ? normalized : roleOptions[0];
  };
  const blank = {
    name: player.name,
    role: normalizeRole(player.role),
    jerseyNumber: player.jerseyNumber ?? '',
    category: player.category ?? UNRATED,
  };
  const [form, setForm] = useState(blank);

  const startEdit = () => {
    setForm({
      name: player.name,
      role: normalizeRole(player.role),
      jerseyNumber: player.jerseyNumber ?? '',
      category: player.category ?? UNRATED,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onUpdate(player._id, {
      name: form.name.trim(),
      role: normalizeRole(form.role),
      // Empty leaves the number unchanged (the schema can't store null).
      jerseyNumber: form.jerseyNumber === '' ? undefined : Number(form.jerseyNumber),
      category: toCategoryPayload(form.category),
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <li className="space-y-2 py-2">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-label="Player name"
        />
        <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_64px_auto]">
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger aria-label="Position"><SelectValue /></SelectTrigger>
            <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {sport === SPORTS.FOOTBALL ? `${r} - ${footballPositionLabel(r)}` : r}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
          <CategorySelect
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            aria-label="Category"
          />
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
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary text-xs font-bold tabular-nums">
        {player.jerseyNumber ?? '–'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{player.name}</span>
          <PlayerCategoryBadge category={player.category} size="xs" />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {player.role && (
            <span className="tracking-wide">
              {sport === SPORTS.FOOTBALL
                ? `${normalizeFootballPosition(player.role)} - ${footballPositionLabel(player.role)}`
                : player.role}
            </span>
          )}
          {player.role && ' · '}
          {playerStatSummary(player, sport)}
        </p>
      </div>
      <Tooltip label="Edit player">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={startEdit} aria-label="Edit player">
          <Pencil className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip label="Remove player">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onRemove(player._id)} aria-label="Remove player">
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
    </li>
  );
}

function RosterDialog({ tournamentId, team, sport }) {
  const { data } = useTeam(tournamentId, team._id);
  const { addPlayer, updatePlayer, removePlayer, updateFormation } = useTeamMutations(tournamentId);
  const roleOptions = sport === SPORTS.CRICKET ? CRICKET_ROLES : FOOTBALL_POSITIONS;
  const blankForm = { name: '', role: roleOptions[0], jerseyNumber: '', category: UNRATED };
  const [form, setForm] = useState(blankForm);
  const [formationDraft, setFormationDraft] = useState(null);
  const lastHydratedFormationTeamRef = useRef(null);

  const players = data?.players ?? [];
  const isFootball = sport === SPORTS.FOOTBALL;
  const savedFormation = data?.team?.defaultFormation ?? null;
  const teamId = data?.team?._id ? String(data.team._id) : null;

  const formationDirty = useMemo(
    () => JSON.stringify(formationDraft) !== JSON.stringify(savedFormation),
    [formationDraft, savedFormation]
  );
  const assignedFormationCount = useMemo(
    () => assignedFormationPlayerIds(formationDraft).length,
    [formationDraft]
  );

  useEffect(() => {
    if (!isFootball || !teamId) return;
    const teamChanged = lastHydratedFormationTeamRef.current !== teamId;
    if (teamChanged) {
      lastHydratedFormationTeamRef.current = teamId;
      setFormationDraft(savedFormation);
      return;
    }
    if (!formationDirty) {
      setFormationDraft(savedFormation);
    }
  }, [isFootball, teamId, savedFormation, formationDirty]);

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
          role: isFootball ? normalizeFootballPosition(form.role) : form.role,
          jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
          category: toCategoryPayload(form.category),
        },
      });
      toast.success('Player added');
      setForm(blankForm);
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

  const saveFormation = async () => {
    try {
      await updateFormation.mutateAsync({
        teamId: team._id,
        defaultFormation: formationDraft,
      });
      toast.success('Default formation saved');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Shirt className="h-4 w-4" /> {team.name} — Roster</DialogTitle>
      </DialogHeader>
      {isFootball ? (
        <Tabs defaultValue="roster" className="space-y-3">
          <TabsList>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="formation">Formation</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-3">
            <form onSubmit={submit} className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Player</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_64px_auto]">
                <div className="space-y-1">
                  <Label className="text-xs">Position</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {isFootball ? `${r} - ${footballPositionLabel(r)}` : r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">#</Label>
                  <Input type="number" value={form.jerseyNumber} onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} />
                </div>
                <Button type="submit" size="icon" disabled={addPlayer.isPending} className="w-full sm:w-10"><Plus /></Button>
              </div>
            </form>
            <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
              {players.length ? players.map((p) => (
                <PlayerRow
                  key={p._id}
                  player={p}
                  sport={sport}
                  roleOptions={roleOptions}
                  onUpdate={onUpdatePlayer}
                  onRemove={onRemovePlayer}
                />
              )) : <p className="py-4 text-center text-sm text-muted-foreground">No players yet.</p>}
            </ul>
          </TabsContent>

          <TabsContent value="formation" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Football only</Badge>
                <Badge variant={assignedFormationCount === 11 ? 'success' : 'secondary'}>
                  XI assigned: {assignedFormationCount}/11
                </Badge>
                {formationDirty && <Badge variant="accent">Unsaved changes</Badge>}
                <p className="text-xs text-muted-foreground">
                  This is the team default; match overrides can be set while entering match results.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormationDraft(null)}
                  disabled={!formationDraft || updateFormation.isPending}
                >
                  Clear default
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveFormation}
                  disabled={!formationDirty || updateFormation.isPending}
                >
                  {updateFormation.isPending ? 'Saving...' : 'Save formation'}
                </Button>
              </div>
            </div>

            <p className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
              Use <span className="font-medium text-foreground">Assign players</span> to build XI and
              swap players, and <span className="font-medium text-foreground">Edit positions</span> to
              drag tactical cards anywhere on the pitch (auto-labeled by location).
            </p>

            <FormationEditor
              roster={players}
              value={formationDraft}
              onChange={(next) => setFormationDraft(normalizeFormation(next))}
              disabled={updateFormation.isPending}
              title="Default team formation"
              description="Build your primary tactical shape for this team (preset + slot assignments)."
            />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Player</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_64px_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">#</Label>
                <Input type="number" value={form.jerseyNumber} onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} />
              </div>
              <Button type="submit" size="icon" disabled={addPlayer.isPending} className="w-full sm:w-10"><Plus /></Button>
            </div>
          </form>
          <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
            {players.length ? players.map((p) => (
              <PlayerRow
                key={p._id}
                player={p}
                sport={sport}
                roleOptions={roleOptions}
                onUpdate={onUpdatePlayer}
                onRemove={onRemovePlayer}
              />
            )) : <p className="py-4 text-center text-sm text-muted-foreground">No players yet.</p>}
          </ul>
        </>
      )}
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
      <PageHeader
        title="Teams"
        description="Build and manage squads, rosters, and optional football default formations."
      />

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
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <TeamCrest team={team} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.shortCode}{team.seed ? ` · seed ${team.seed}` : ''}</p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
