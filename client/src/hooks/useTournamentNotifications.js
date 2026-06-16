import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSocket, EVENTS } from '@/lib/socket';
import { api } from '@/lib/api';
import { resultSummary } from '@/lib/format';
import { useNotifications } from '@/store/notifications';

const teamName = (f, side) => f?.[`team${side}`]?.name || f?.[`placeholder${side}`] || 'TBD';
const matchTag = (f) => (f?.matchNumber != null ? `Match #${f.matchNumber}` : f?.roundName || 'Match');

/** Fetch a single fixture with its teams + result populated (public endpoint). */
async function fetchFixture(fixtureId) {
  try {
    const { data } = await api.get(`/fixtures/${fixtureId}`);
    return data?.data?.fixture ?? null;
  } catch {
    return null;
  }
}

function buildResultNotice(f) {
  const a = teamName(f, 'A');
  const b = teamName(f, 'B');
  const winnerId = f.winner?._id || f.winner;
  const summary = resultSummary(f);
  let title;
  if (!winnerId) {
    title = `${a} drew with ${b}`;
  } else {
    const aWon = String(winnerId) === String(f.teamA?._id);
    title = aWon ? `${a} beat ${b}` : `${b} beat ${a}`;
  }
  return { kind: 'result', fixtureId: String(f._id), title, detail: summary ? `${matchTag(f)} · ${summary}` : matchTag(f) };
}

function buildLiveNotice(f) {
  return {
    kind: 'live',
    fixtureId: String(f._id),
    title: `${teamName(f, 'A')} vs ${teamName(f, 'B')}`,
    detail: `${matchTag(f)} · Live now`,
  };
}

/**
 * Subscribe to a tournament's live channel and turn notable broadcasts
 * (results, matches going live) into human-readable notices in the
 * notifications store. The room itself is joined by `useLiveTournament`, which
 * the tournament layouts also mount; this hook only attaches extra listeners.
 *
 * @param {string} tournamentId
 * @param {{ toast?: boolean }} [opts] surface a transient toast too (used on the
 *   public viewer, off in the admin console where organisers get action toasts).
 */
export function useTournamentNotifications(tournamentId, { toast: withToast = false } = {}) {
  const setContext = useNotifications((s) => s.setContext);
  const add = useNotifications((s) => s.add);

  useEffect(() => {
    if (!tournamentId) return undefined;
    setContext(tournamentId);

    const socket = getSocket();
    let cancelled = false;

    const push = (notice) => {
      if (cancelled || !notice) return;
      add(notice);
      if (withToast) {
        toast(notice.title, { description: notice.detail });
      }
    };

    const onResult = async ({ fixtureId } = {}) => {
      if (!fixtureId) return;
      const f = await fetchFixture(fixtureId);
      if (f) push(buildResultNotice(f));
    };

    const onStatus = async ({ fixtureId, status } = {}) => {
      if (!fixtureId || status !== 'live') return;
      const f = await fetchFixture(fixtureId);
      if (f) push(buildLiveNotice(f));
    };

    socket.on(EVENTS.RESULT, onResult);
    socket.on(EVENTS.STATUS, onStatus);

    return () => {
      cancelled = true;
      socket.off(EVENTS.RESULT, onResult);
      socket.off(EVENTS.STATUS, onStatus);
    };
  }, [tournamentId, withToast, setContext, add]);
}
