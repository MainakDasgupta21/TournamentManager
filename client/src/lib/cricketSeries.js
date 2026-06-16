import { ballRuns } from '@/lib/cricket';

/**
 * Per-over series for an innings (Module 8 charts). Returns one entry per over
 * with that over's runs, wickets and the running cumulative total.
 */
export function overSeries(inn) {
  const overs = inn?.oversDetail ?? [];
  let cum = 0;
  return overs.map((over, i) => {
    let runs = 0;
    let wickets = 0;
    for (const b of over.balls ?? []) {
      runs += ballRuns(b);
      if (b.isWicket) wickets += 1;
    }
    cum += runs;
    return { over: (over.overNumber ?? i) + 1, runs, wickets, cum };
  });
}

/** True if an innings carries ball-by-ball detail worth charting. */
export function hasBallDetail(inn) {
  return Array.isArray(inn?.oversDetail) && inn.oversDetail.some((o) => (o.balls ?? []).length);
}
