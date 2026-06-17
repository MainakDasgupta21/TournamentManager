import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/store/auth';

const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);

/* --------------------------------- Uploads -------------------------------- */

/** Upload a single image and resolve to its public URL. */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data.url;
    },
  });
}

/* ------------------------------ Preferences ------------------------------ */

/**
 * Persist the signed-in user's theme to the database (the source of truth).
 * The UI applies the new theme optimistically; this syncs it server-side and
 * refreshes the cached session user.
 */
export function useUpdateThemePreference() {
  return useMutation({
    mutationFn: (theme) => api.patch('/auth/preferences', { theme }).then((r) => r.data.data.user),
    onSuccess: (user) => {
      if (user) useAuth.setState({ user });
    },
  });
}

/* --------------------------------- Users --------------------------------- */

/** Super-admin user directory (organiser access requests + accounts). */
export function useUsers(filters, options) {
  return useQuery({
    queryKey: qk.users(filters),
    queryFn: () => get('/users', filters),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useUpdateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }) =>
      api.patch(`/users/${id}/approval`, { status, note }).then((r) => r.data.data.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

/** Super-admin queue for tournament-level access requests. */
export function useTournamentAccessRequests(filters, options) {
  return useQuery({
    queryKey: qk.tournamentAccessRequests(filters),
    queryFn: () => get('/tournament-access-requests', filters),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useReviewTournamentAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }) =>
      api.patch(`/tournament-access-requests/${id}/review`, { status, note }).then((r) => r.data.data.request),
    onSuccess: (_request, vars) => {
      qc.invalidateQueries({ queryKey: ['tournamentAccessRequests'] });
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      if (vars?.tournamentId) {
        qc.invalidateQueries({ queryKey: qk.tournament(vars.tournamentId) });
        qc.invalidateQueries({ queryKey: qk.tournamentAdmins(vars.tournamentId) });
        qc.invalidateQueries({ queryKey: qk.auditLogs(vars.tournamentId) });
      }
    },
  });
}

/* ------------------------------ Tournaments ------------------------------ */

export function useTournaments(filters) {
  return useQuery({
    queryKey: qk.tournaments(filters),
    queryFn: () => get('/tournaments', filters),
    select: (d) => d.tournaments,
  });
}

/**
 * Paginated tournament list — keeps the full `{ tournaments, total, page, pages }`
 * payload (unlike `useTournaments`, which selects just the array) and holds the
 * previous page on screen while the next one loads.
 */
export function useTournamentList(filters) {
  return useQuery({
    queryKey: qk.tournaments(filters),
    queryFn: () => get('/tournaments', filters),
    placeholderData: keepPreviousData,
  });
}

export function useTournament(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.tournament(id),
    queryFn: () => get(`/tournaments/${id}`),
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/tournaments', body).then((r) => r.data.data.tournament),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournaments'] }),
  });
}

/** Request management access to a specific tournament. */
export function useRequestTournamentAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId, message }) =>
      api
        .post(`/tournaments/${tournamentId}/access-requests`, message ? { message } : {})
        .then((r) => r.data.data.request),
    onSuccess: (_request, vars) => {
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      qc.invalidateQueries({ queryKey: ['tournamentAccessRequests'] });
      if (vars?.tournamentId) {
        qc.invalidateQueries({ queryKey: qk.tournament(vars.tournamentId) });
      }
    },
  });
}

export function useUpdateTournament(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/tournaments/${id}`, body).then((r) => r.data.data.tournament),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tournament(id) });
      qc.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useUpdatePointsConfig(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pointsConfig) =>
      api.patch(`/tournaments/${id}/points-config`, { pointsConfig }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tournament(id) }),
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/tournaments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournaments'] }),
  });
}

/* ------------------------------ Collaborators ----------------------------- */

/** Owner + collaborator admins for a tournament (managers only). */
export function useTournamentAdmins(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.tournamentAdmins(id),
    queryFn: () => get(`/tournaments/${id}/admins`),
  });
}

/** Typeahead search for organisers to add as collaborators (super-admin-only). */
export function useAdminCandidates(id, q, enabled = true) {
  return useQuery({
    enabled: !!id && enabled && (q?.trim().length ?? 0) >= 2,
    queryKey: qk.adminCandidates(id, q?.trim()),
    queryFn: () => get(`/tournaments/${id}/admin-candidates`, { q: q.trim() }),
    select: (d) => d.candidates,
    keepPreviousData: true,
  });
}

export function useCollaboratorMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.tournamentAdmins(id) });
    qc.invalidateQueries({ queryKey: ['adminCandidates', id] });
    qc.invalidateQueries({ queryKey: qk.tournament(id) });
    qc.invalidateQueries({ queryKey: ['tournaments'] });
    qc.invalidateQueries({ queryKey: qk.auditLogs(id) });
  };
  return {
    assign: useMutation({
      mutationFn: (userId) =>
        api.post(`/tournaments/${id}/admins`, { userId }).then((r) => r.data.data.tournament),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (userId) => api.delete(`/tournaments/${id}/admins/${userId}`),
      onSuccess: invalidate,
    }),
  };
}

/* --------------------------------- Teams --------------------------------- */

export function useTeams(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.teams(id),
    queryFn: () => get(`/tournaments/${id}/teams`),
    select: (d) => d.teams,
  });
}

export function useTeam(id, teamId) {
  return useQuery({
    enabled: !!id && !!teamId,
    queryKey: qk.team(id, teamId),
    queryFn: () => get(`/tournaments/${id}/teams/${teamId}`),
  });
}

export function useTeamMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.teams(id) });
    qc.invalidateQueries({ queryKey: qk.groups(id) });
  };
  return {
    create: useMutation({
      mutationFn: (body) => api.post(`/tournaments/${id}/teams`, body).then((r) => r.data.data.team),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ teamId, body }) =>
        api.patch(`/tournaments/${id}/teams/${teamId}`, body).then((r) => r.data.data.team),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (teamId) => api.delete(`/tournaments/${id}/teams/${teamId}`),
      onSuccess: invalidate,
    }),
    addPlayer: useMutation({
      mutationFn: ({ teamId, body }) =>
        api.post(`/tournaments/${id}/teams/${teamId}/players`, body).then((r) => r.data.data.player),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.team(id, v.teamId) }),
    }),
    updatePlayer: useMutation({
      mutationFn: ({ teamId, playerId, body }) =>
        api
          .patch(`/tournaments/${id}/teams/${teamId}/players/${playerId}`, body)
          .then((r) => r.data.data.player),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.team(id, v.teamId) }),
    }),
    removePlayer: useMutation({
      mutationFn: ({ teamId, playerId }) =>
        api.delete(`/tournaments/${id}/teams/${teamId}/players/${playerId}`),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.team(id, v.teamId) }),
    }),
  };
}

/* --------------------------------- Groups -------------------------------- */

export function useGroups(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.groups(id),
    queryFn: () => get(`/tournaments/${id}/groups`),
    select: (d) => d.groups,
  });
}

export function useGroupMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.groups(id) });
    qc.invalidateQueries({ queryKey: qk.teams(id) });
  };
  return {
    create: useMutation({
      mutationFn: (body) => api.post(`/tournaments/${id}/groups`, body).then((r) => r.data.data.group),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ groupId, body }) =>
        api.patch(`/tournaments/${id}/groups/${groupId}`, body).then((r) => r.data.data.group),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (groupId) => api.delete(`/tournaments/${id}/groups/${groupId}`),
      onSuccess: invalidate,
    }),
    autoDistribute: useMutation({
      mutationFn: (body) =>
        api.post(`/tournaments/${id}/groups/auto-distribute`, body).then((r) => r.data.data),
      onSuccess: invalidate,
    }),
  };
}

/* -------------------------------- Fixtures ------------------------------- */

export function useFixtures(id, filters) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.fixtures(id, filters),
    queryFn: () => get(`/tournaments/${id}/fixtures`, filters),
    select: (d) => d.fixtures,
  });
}

/** A single fixture with populated teams + result (Match Center). */
export function useFixture(fixtureId) {
  return useQuery({
    enabled: !!fixtureId,
    queryKey: qk.fixture(fixtureId),
    queryFn: () => get(`/fixtures/${fixtureId}`),
    select: (d) => d.fixture,
  });
}

export function useFixtureMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['fixtures', id] });
    qc.invalidateQueries({ queryKey: qk.standings(id) });
    qc.invalidateQueries({ queryKey: qk.knockout(id) });
    qc.invalidateQueries({ queryKey: qk.tournament(id) });
  };
  return {
    generateGroupStage: useMutation({
      mutationFn: (body) =>
        api.post(`/tournaments/${id}/fixtures/generate-group-stage`, body).then((r) => r.data.data),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ fixtureId, body }) =>
        api.patch(`/fixtures/${fixtureId}`, body).then((r) => r.data.data.fixture),
      onSuccess: invalidate,
    }),
    submitResult: useMutation({
      // Returns the full payload ({ fixture, requiresConfirm, affected }) so the
      // caller can surface the knockout downstream-invalidation confirm flow.
      mutationFn: ({ fixtureId, body }) =>
        api.patch(`/fixtures/${fixtureId}/result`, body).then((r) => r.data.data),
      onSuccess: invalidate,
    }),
    editEvents: useMutation({
      // Add/edit/delete a single ball or goal/card/sub on a fixture (Module 5B).
      mutationFn: ({ fixtureId, body }) =>
        api.patch(`/fixtures/${fixtureId}/events`, body).then((r) => r.data.data.fixture),
      onSuccess: invalidate,
    }),
    liveUpdate: useMutation({
      mutationFn: ({ fixtureId, body }) =>
        api.patch(`/fixtures/${fixtureId}/live-update`, body).then((r) => r.data.data),
    }),
  };
}

/* --------------------- Recalculation & audit (Module 5B) ------------------ */

/** Admin: trigger a full recalculation cascade. Resolves to the result payload
 *  (may contain `requiresConfirm` + `affected` when bracket changes need OK). */
export function useRecalculate(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm = false) =>
      api.post(`/tournaments/${id}/recalculate`, { confirm }).then((r) => r.data.data),
    onSuccess: (data) => {
      if (data?.requiresConfirm) return;
      qc.invalidateQueries({ queryKey: ['fixtures', id] });
      qc.invalidateQueries({ queryKey: qk.standings(id) });
      qc.invalidateQueries({ queryKey: qk.knockout(id) });
      qc.invalidateQueries({ queryKey: qk.leaderboards(id) });
      qc.invalidateQueries({ queryKey: ['players', id] });
      qc.invalidateQueries({ queryKey: qk.auditLogs(id) });
    },
  });
}

/** Admin: paginated audit trail for a tournament. */
export function useAuditLogs(id, filters) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.auditLogs(id, filters),
    queryFn: () => get(`/tournaments/${id}/audit-logs`, filters),
    keepPreviousData: true,
  });
}

/* ------------------------------- Standings ------------------------------- */

export function useStandings(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.standings(id),
    queryFn: () => get(`/tournaments/${id}/standings`),
    select: (d) => d.standings,
  });
}

/* ----------------------- Leaderboards & player stats --------------------- */

/** Tournament-wide leaderboards (cricket/football, sport-aware on the server). */
export function useLeaderboards(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.leaderboards(id),
    queryFn: () => get(`/tournaments/${id}/leaderboards`),
    select: (d) => d.leaderboards,
  });
}

/** All players in a tournament with cached stats (used by the POTM picker). */
export function useTournamentPlayers(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ['players', id],
    queryFn: () => get(`/tournaments/${id}/players`),
    select: (d) => d.players,
  });
}

/** Single player profile: cached aggregate stats + match-by-match breakdown. */
export function usePlayerStats(playerId) {
  return useQuery({
    enabled: !!playerId,
    queryKey: qk.player(playerId),
    queryFn: () => get(`/players/${playerId}/stats`),
  });
}

/** Admin: assign (or clear) the Player of the Tournament. */
export function useSetPlayerOfTournament(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId) =>
      api.patch(`/tournaments/${id}/player-of-tournament`, { playerId }).then((r) => r.data.data.tournament),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leaderboards(id) });
      qc.invalidateQueries({ queryKey: qk.tournament(id) });
    },
  });
}

/* ------------------------------- Knockouts ------------------------------- */

export function useKnockout(id) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.knockout(id),
    queryFn: () => get(`/tournaments/${id}/knockouts`),
    select: (d) => d.bracket,
  });
}

export function useKnockoutMutations(id) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.knockout(id) });
    qc.invalidateQueries({ queryKey: ['fixtures', id] });
    qc.invalidateQueries({ queryKey: qk.tournament(id) });
  };
  return {
    generate: useMutation({
      mutationFn: (body) =>
        api.post(`/tournaments/${id}/knockouts/generate`, body).then((r) => r.data.data.bracket),
      onSuccess: invalidate,
    }),
    adjust: useMutation({
      mutationFn: (body) =>
        api.patch(`/tournaments/${id}/knockouts/adjust`, body).then((r) => r.data.data.bracket),
      onSuccess: invalidate,
    }),
    lock: useMutation({
      mutationFn: () => api.patch(`/tournaments/${id}/knockouts/lock`).then((r) => r.data.data.bracket),
      onSuccess: invalidate,
    }),
  };
}
