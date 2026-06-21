import { overSeries, hasBallDetail } from '@/lib/cricketSeries';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const W = 520;
const BASE_H = 180;
const BASE_PAD = { top: 14, right: 12, bottom: 24, left: 30 };

/**
 * Manhattan chart (Module 8): runs scored per over as bars, with a red dot above
 * any over in which a wicket fell. One innings per chart.
 */
export default function ManhattanChart({ innings, color = 'hsl(var(--primary))', label }) {
  const isCompact = useMediaQuery('(max-width: 639px)');
  if (!hasBallDetail(innings)) return null;
  const data = overSeries(innings);
  if (!data.length) return null;

  const H = isCompact ? 210 : BASE_H;
  const PAD = isCompact ? { top: 16, right: 14, bottom: 30, left: 34 } : BASE_PAD;
  const axisFontSize = isCompact ? 10 : 9;
  const showOverLabels = isCompact ? data.length <= 14 : data.length <= 24;

  const maxRuns = Math.max(...data.map((d) => d.runs), 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const bw = plotW / data.length;
  const barW = Math.max(4, bw * 0.7);
  const y = (runs) => PAD.top + plotH - (runs / maxRuns) * plotH;

  const gridY = [0, 0.5, 1].map((f) => Math.round(maxRuns * f));

  return (
    <div className="w-full overflow-hidden">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        role="img"
        aria-label="Runs per over"
      >
        {gridY.map((val) => (
          <g key={val}>
            <line x1={PAD.left} y1={y(val)} x2={W - PAD.right} y2={y(val)} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
            <text x={PAD.left - 5} y={y(val) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={axisFontSize}>{val}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + i * bw + (bw - barW) / 2;
          const top = y(d.runs);
          return (
            <g key={i}>
              <rect x={cx} y={top} width={barW} height={PAD.top + plotH - top} rx="2" fill={color} opacity="0.85" />
              {d.wickets > 0 && <circle cx={cx + barW / 2} cy={top - 6} r="3" fill="hsl(var(--destructive))" />}
              {showOverLabels && (
                <text x={cx + barW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={isCompact ? 9 : 8}>{d.over}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
