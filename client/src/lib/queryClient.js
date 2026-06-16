import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/** Centralised query keys so invalidation stays consistent. */
export const qk = {
  me: ['me'],
  users: (filters) => ['users', filters ?? {}],
  tournaments: (filters) => ['tournaments', filters ?? {}],
  tournament: (id) => ['tournament', id],
  tournamentAdmins: (id) => ['tournamentAdmins', id],
  adminCandidates: (id, q) => ['adminCandidates', id, q ?? ''],
  teams: (id) => ['teams', id],
  team: (id, teamId) => ['team', id, teamId],
  groups: (id) => ['groups', id],
  fixtures: (id, filters) => ['fixtures', id, filters ?? {}],
  fixture: (fixtureId) => ['fixture', fixtureId],
  standings: (id) => ['standings', id],
  knockout: (id) => ['knockout', id],
  leaderboards: (id) => ['leaderboards', id],
  player: (playerId) => ['player', playerId],
  auditLogs: (id, filters) => ['auditLogs', id, filters ?? {}],
};
