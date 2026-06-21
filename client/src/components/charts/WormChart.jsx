import { useMemo } from 'react';
import { overSeries, hasBallDetail } from '@/lib/cricketSeries';

const W = 520;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

/**
 * Cumulative-runs "worm" graph (Module 8). Overlays each innings as a line so
 * you can compare the two chases at a glance. Hand-rolled SVG (no chart dep).
 */
export default function WormChart({ innings = [], teamsById = {} }) {
  const series = useMemo(
    () =>
      innings
        .map((inn) => ({
          label: teamsById[String(inn.battingTeam)]?.shortCode || 'INN',
          points: [{ over: 0, cum: 0 }, ...overSeries(inn)],
          wickets: overSeries(inn).filter((o) => o.wickets > 0),
        }))
        .filter((s) => s.points.length > 1),
    [innings, teamsById]
  );

  if (!innings.some(hasBallDetail)) return null;

  const maxOver = Math.max(...series.flatMap((s) => s.points.map((p) => p.over)), 1);
  const maxCum = Math.max(...series.flatMap((s) => s.points.map((p) => p.cum)), 1);

  const x = (over) => PAD.left + (over / maxOver) * (W - PAD.left - PAD.right);
  const y = (cum) => H - PAD.bottom - (cum / maxCum) * (H - PAD.top - PAD.bottom);

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCum * f));

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative runs worm chart">
        {/* horizontal grid + y labels */}
        {gridY.map((val, gi) => (
          // Key by index: grid values can repeat (e.g. all 0 when no runs yet),
          // which would otherwise produce duplicate React keys.
          <g key={gi}>
            <line x1={PAD.left} y1={y(val)} x2={W - PAD.right} y2={y(val)} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
            <text x={PAD.left - 6} y={y(val) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">{val}</text>
          </g>
        ))}
        {/* x label */}
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground" fontSize="9">{maxOver} ov</text>

        {series.map((s, i) => {
          const color = COLORS[i % COLORS.length];
          const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${x(p.over).toFixed(1)} ${y(p.cum).toFixed(1)}`).join(' ');
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.wickets.map((w, k) => (
                <circle key={k} cx={x(w.over)} cy={y(w.cum)} r="3.5" fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth="1.5" />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-xs">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> wicket
        </span>
      </div>
    </div>
  );
}
