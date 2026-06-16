import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

/** Shared event-name contract with the server (see server/src/socket/index.js). */
export const EVENTS = {
  LIVE_UPDATE: 'fixture:liveUpdate',
  RESULT: 'fixture:result',
  STANDINGS: 'standings:update',
  STATUS: 'fixture:status',
  BRACKET: 'knockout:update',
  STATS: 'stats:update',
};

let socket = null;

/** Lazily create the singleton socket connection. */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}
