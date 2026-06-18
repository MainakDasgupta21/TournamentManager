import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io = null;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Room name helpers keep client/server in sync on the channel naming. */
export const rooms = {
  tournament: (id) => `tournament:${id}`,
  fixture: (id) => `fixture:${id}`,
};

const normalizeObjectId = (value) => (typeof value === 'string' ? value.trim() : '');
const isObjectId = (value) => OBJECT_ID_RE.test(normalizeObjectId(value));

/** Socket event names (shared contract with the client). */
export const EVENTS = {
  LIVE_UPDATE: 'fixture:liveUpdate',
  RESULT: 'fixture:result',
  STANDINGS: 'standings:update',
  STATUS: 'fixture:status',
  BRACKET: 'knockout:update',
  STATS: 'stats:update',
};

/**
 * Attach Socket.io to the HTTP server. Clients join tournament/fixture rooms so
 * we only push updates to interested viewers (a public tournament page joins
 * its tournament room; a live match view also joins the fixture room).
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('joinTournament', (tournamentId) => {
      if (!isObjectId(tournamentId)) return;
      socket.join(rooms.tournament(normalizeObjectId(tournamentId)));
    });
    socket.on('leaveTournament', (tournamentId) => {
      if (!isObjectId(tournamentId)) return;
      socket.leave(rooms.tournament(normalizeObjectId(tournamentId)));
    });
    socket.on('joinFixture', (fixtureId) => {
      if (!isObjectId(fixtureId)) return;
      socket.join(rooms.fixture(normalizeObjectId(fixtureId)));
    });
    socket.on('leaveFixture', (fixtureId) => {
      if (!isObjectId(fixtureId)) return;
      socket.leave(rooms.fixture(normalizeObjectId(fixtureId)));
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/** Emit to everyone viewing a tournament (home/standings/bracket pages). */
export function emitToTournament(tournamentId, event, payload) {
  io?.to(rooms.tournament(tournamentId)).emit(event, payload);
}

/** Emit to everyone watching a specific match's live view. */
export function emitToFixture(fixtureId, event, payload) {
  io?.to(rooms.fixture(fixtureId)).emit(event, payload);
}
