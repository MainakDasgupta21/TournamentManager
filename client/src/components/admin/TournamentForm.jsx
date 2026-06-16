import { useState } from 'react';
import { ChevronUp, ChevronDown, Save } from 'lucide-react';
import {
  SPORTS,
  SPORT_VALUES,
  TIEBREAKERS,
  DEFAULT_POINTS_CONFIG,
} from '@tms/shared/constants';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUpload from '@/components/admin/ImageUpload';

const TIEBREAKER_LABELS = {
  netRunRate: 'Net Run Rate',
  headToHead: 'Head-to-head',
  totalWins: 'Total wins',
  goalDifference: 'Goal difference',
  goalsScored: 'Goals scored',
};

const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

/** Build initial form state from an existing tournament (or sensible defaults). */
function buildState(initial) {
  const sport = initial?.sportType || SPORTS.CRICKET;
  const defaults = DEFAULT_POINTS_CONFIG[sport];
  return {
    name: initial?.name || '',
    sportType: sport,
    logo: initial?.logo || '',
    bannerImage: initial?.bannerImage || '',
    primaryColor: initial?.primaryColor || '#6366f1',
    startDate: toDateInput(initial?.startDate),
    endDate: toDateInput(initial?.endDate),
    venues: (initial?.venues || []).join(', '),
    description: initial?.description || '',
    pointsConfig: {
      win: initial?.pointsConfig?.win ?? defaults.win,
      draw: initial?.pointsConfig?.draw ?? defaults.draw,
      loss: initial?.pointsConfig?.loss ?? defaults.loss,
      noResult: initial?.pointsConfig?.noResult ?? defaults.noResult,
      bonusPointRule: {
        enabled: initial?.pointsConfig?.bonusPointRule?.enabled ?? false,
        description: initial?.pointsConfig?.bonusPointRule?.description ?? '',
        bonusPoints: initial?.pointsConfig?.bonusPointRule?.bonusPoints ?? 1,
      },
      tiebreakerOrder: initial?.pointsConfig?.tiebreakerOrder?.length
        ? [...initial.pointsConfig.tiebreakerOrder]
        : [...defaults.tiebreakerOrder],
    },
    groupSettings: {
      numberOfGroups: initial?.groupSettings?.numberOfGroups ?? 2,
      doubleRoundRobin: initial?.groupSettings?.doubleRoundRobin ?? false,
      qualifiersPerGroup: initial?.groupSettings?.qualifiersPerGroup ?? 2,
    },
  };
}

/** Serialise form state into the API payload shape. */
export function serialize(state) {
  return {
    name: state.name,
    sportType: state.sportType,
    logo: state.logo || '',
    bannerImage: state.bannerImage || '',
    primaryColor: state.primaryColor,
    startDate: state.startDate ? new Date(state.startDate).toISOString() : undefined,
    endDate: state.endDate ? new Date(state.endDate).toISOString() : undefined,
    venues: state.venues
      ? state.venues.split(',').map((v) => v.trim()).filter(Boolean)
      : [],
    description: state.description,
    pointsConfig: {
      ...state.pointsConfig,
      win: Number(state.pointsConfig.win),
      draw: Number(state.pointsConfig.draw),
      loss: Number(state.pointsConfig.loss),
      noResult: Number(state.pointsConfig.noResult),
      bonusPointRule: {
        ...state.pointsConfig.bonusPointRule,
        bonusPoints: Number(state.pointsConfig.bonusPointRule.bonusPoints),
      },
    },
    groupSettings: {
      numberOfGroups: Number(state.groupSettings.numberOfGroups),
      doubleRoundRobin: state.groupSettings.doubleRoundRobin,
      qualifiersPerGroup: Number(state.groupSettings.qualifiersPerGroup),
    },
  };
}

function NumberField({ label, value, onChange, min = 0 }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={min} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function TournamentForm({ initial, onSubmit, submitting, submitLabel = 'Save', lockSport }) {
  const [s, setS] = useState(() => buildState(initial));

  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const setPC = (patch) => setS((prev) => ({ ...prev, pointsConfig: { ...prev.pointsConfig, ...patch } }));
  const setGS = (patch) => setS((prev) => ({ ...prev, groupSettings: { ...prev.groupSettings, ...patch } }));

  const onSport = (sport) => {
    const d = DEFAULT_POINTS_CONFIG[sport];
    setS((prev) => ({
      ...prev,
      sportType: sport,
      pointsConfig: {
        ...prev.pointsConfig,
        win: d.win,
        draw: d.draw,
        loss: d.loss,
        noResult: d.noResult,
        tiebreakerOrder: [...d.tiebreakerOrder],
      },
    }));
  };

  const moveTiebreaker = (idx, dir) => {
    const arr = [...s.pointsConfig.tiebreakerOrder];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setPC({ tiebreakerOrder: arr });
  };

  const availableTiebreakers = TIEBREAKERS[s.sportType] || [];
  const isCricket = s.sportType === SPORTS.CRICKET;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(serialize(s));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tournament name</Label>
            <Input value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Summer Premier League" required />
          </div>
          <div className="space-y-1.5">
            <Label>Sport</Label>
            <Select value={s.sportType} onValueChange={onSport} disabled={lockSport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORT_VALUES.map((sp) => (
                  <SelectItem key={sp} value={sp}>{sp === 'cricket' ? 'Cricket' : 'Football'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockSport && <p className="text-xs text-muted-foreground">Sport cannot change after creation.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Accent color</Label>
            <div className="flex gap-2">
              <Input type="color" value={s.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} className="h-10 w-14 p-1" />
              <Input value={s.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={s.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Venues (comma-separated)</Label>
            <Input value={s.venues} onChange={(e) => set({ venues: e.target.value })} placeholder="Stadium A, Ground B" />
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label="Logo (optional)"
              value={s.logo}
              onChange={(url) => set({ logo: url })}
              variant="logo"
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label="Banner image (optional)"
              value={s.bannerImage}
              onChange={(url) => set({ bannerImage: url })}
              variant="banner"
              hint="Shown behind the tournament hero. Wide images work best."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={s.description} onChange={(e) => set({ description: e.target.value })} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Points configuration</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField label="Win" value={s.pointsConfig.win} onChange={(v) => setPC({ win: v })} />
            <NumberField label={isCricket ? 'Tie' : 'Draw'} value={s.pointsConfig.draw} onChange={(v) => setPC({ draw: v })} />
            <NumberField label="Loss" value={s.pointsConfig.loss} onChange={(v) => setPC({ loss: v })} />
            {isCricket && (
              <NumberField label="No result" value={s.pointsConfig.noResult} onChange={(v) => setPC({ noResult: v })} />
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bonus point rule</p>
                <p className="text-sm text-muted-foreground">Award extra points (admin applies it per result)</p>
              </div>
              <Switch
                checked={s.pointsConfig.bonusPointRule.enabled}
                onCheckedChange={(v) => setPC({ bonusPointRule: { ...s.pointsConfig.bonusPointRule, enabled: v } })}
              />
            </div>
            {s.pointsConfig.bonusPointRule.enabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Description</Label>
                  <Input
                    value={s.pointsConfig.bonusPointRule.description}
                    onChange={(e) => setPC({ bonusPointRule: { ...s.pointsConfig.bonusPointRule, description: e.target.value } })}
                    placeholder="e.g. Win by 2x margin"
                  />
                </div>
                <NumberField
                  label="Bonus points"
                  value={s.pointsConfig.bonusPointRule.bonusPoints}
                  onChange={(v) => setPC({ bonusPointRule: { ...s.pointsConfig.bonusPointRule, bonusPoints: v } })}
                />
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Tiebreaker priority (top applies first)</Label>
            <div className="space-y-2">
              {s.pointsConfig.tiebreakerOrder.map((tb, idx) => (
                <div key={tb} className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">{idx + 1}</span>
                  <span className="flex-1 text-sm font-medium">{TIEBREAKER_LABELS[tb] || tb}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTiebreaker(idx, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTiebreaker(idx, 1)}><ChevronDown className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Available for {isCricket ? 'cricket' : 'football'}: {availableTiebreakers.map((t) => TIEBREAKER_LABELS[t]).join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Group &amp; format settings</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Number of groups" value={s.groupSettings.numberOfGroups} min={1} onChange={(v) => setGS({ numberOfGroups: v })} />
          <NumberField label="Qualifiers per group" value={s.groupSettings.qualifiersPerGroup} min={1} onChange={(v) => setGS({ qualifiersPerGroup: v })} />
          <div className="flex items-center justify-between rounded-lg border border-border px-3">
            <div>
              <p className="text-sm font-medium">Double round-robin</p>
              <p className="text-xs text-muted-foreground">Home &amp; away</p>
            </div>
            <Switch checked={s.groupSettings.doubleRoundRobin} onCheckedChange={(v) => setGS({ doubleRoundRobin: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          <Save /> {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
