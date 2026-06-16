import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, EVENTS } from '@/lib/socket';
import { qk } from '@/lib/queryClient';

/**
 * Subscribe to a tournament's live channel. On any broadcast we invalidate the
 * affected queries (so TanStack Query refetches the source of truth) and keep a
 * map of per-fixture live snapshots for the ticker / live banners.
 */
export function useLiveTournament(tournamentId) {
  const qc = useQueryClient();
  const [liveStates, setLiveStates] = useState({});

  useEffect(() => {
    if (!tournamentId) return undefined;
    const socket = getSocket();
    socket.emit('joinTournament', tournamentId);
    // Drop any snapshots from a previously-viewed tournament.
    setLiveStates({});

    const onLive = (payload) => {
      if (!payload?.fixtureId) return;
      // Ball-by-ball/goal-by-goal updates only refresh the in-memory live
      // snapshot used by tickers/banners. Invalidating the whole fixtures list
      // on every delivery would trigger a refetch storm during live scoring;
      // the persisted list is refreshed on STATUS / RESULT events instead.
      setLiveStates((prev) => ({ ...prev, [payload.fixtureId]: payload.liveState }));
    };
    const onResult = () => {
      qc.invalidateQueries({ queryKey: ['fixtures', tournamentId] });
      qc.invalidateQueries({ queryKey: qk.standings(tournamentId) });
      qc.invalidateQueries({ queryKey: qk.knockout(tournamentId) });
    };
    const onStandings = () => qc.invalidateQueries({ queryKey: qk.standings(tournamentId) });
    const onBracket = () => qc.invalidateQueries({ queryKey: qk.knockout(tournamentId) });
    const onStatus = () => qc.invalidateQueries({ queryKey: ['fixtures', tournamentId] });
    // Player aggregate stats changed -> refresh team rosters / leaderboards.
    const onStats = () => {
      qc.invalidateQueries({ queryKey: ['team', tournamentId] });
      qc.invalidateQueries({ queryKey: qk.teams(tournamentId) });
      qc.invalidateQueries({ queryKey: qk.leaderboards(tournamentId) });
    };

    socket.on(EVENTS.LIVE_UPDATE, onLive);
    socket.on(EVENTS.RESULT, onResult);
    socket.on(EVENTS.STANDINGS, onStandings);
    socket.on(EVENTS.BRACKET, onBracket);
    socket.on(EVENTS.STATUS, onStatus);
    socket.on(EVENTS.STATS, onStats);

    return () => {
      socket.emit('leaveTournament', tournamentId);
      socket.off(EVENTS.LIVE_UPDATE, onLive);
      socket.off(EVENTS.RESULT, onResult);
      socket.off(EVENTS.STANDINGS, onStandings);
      socket.off(EVENTS.BRACKET, onBracket);
      socket.off(EVENTS.STATUS, onStatus);
      socket.off(EVENTS.STATS, onStats);
    };
  }, [tournamentId, qc]);

  return { liveStates };
}
