/**
 * Win-probability band (Module 8). A stacked horizontal bar showing each side's
 * (and, for football, the draw's) win chance. Values are expected to sum to ~100.
 */
export default function WinProbabilityBar({ a = 50, b = 50, draw = 0, labelA = 'A', labelB = 'B', note }) {
  const total = Math.max(1, a + b + draw);
  const pa = (a / total) * 100;
  const pd = (draw / total) * 100;
  const pb = (b / total) * 100;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="text-primary">{labelA} {Math.round(a)}%</span>
        {draw > 0 && <span className="text-muted-foreground">Draw {Math.round(draw)}%</span>}
        <span className="text-accent">{labelB} {Math.round(b)}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pa}%` }} />
        {draw > 0 && <div className="h-full bg-muted-foreground/40 transition-all duration-500" style={{ width: `${pd}%` }} />}
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pb}%` }} />
      </div>
      {note && <p className="mt-1.5 text-center text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
