import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io = null;

/** Room name helpers keep client/server in sync on the channel naming. */
export const rooms = {
  tournament: (id) => `tournament:${id}`,
  fixture: (id) => `fixture:${id}`,
};

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
      if (tournamentId) socket.join(rooms.tournament(tournamentId));
    });
    socket.on('leaveTournament', (tournamentId) => {
      if (tournamentId) socket.leave(rooms.tournament(tournamentId));
    });
    socket.on('joinFixture', (fixtureId) => {
      if (fixtureId) socket.join(rooms.fixture(fixtureId));
    });
    socket.on('leaveFixture', (fixtureId) => {
      if (fixtureId) socket.leave(rooms.fixture(fixtureId));
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
