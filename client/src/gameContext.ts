import type { Socket } from 'socket.io-client';
import type { InitPayload } from './types';

let gameSocket: Socket | null = null;
let bootPayload: InitPayload | null = null;

export function setGameContext(socket: Socket, payload: InitPayload): void {
  gameSocket = socket;
  bootPayload = payload;
}

export function getGameSocket(): Socket {
  if (!gameSocket) throw new Error('Socket not ready');
  return gameSocket;
}

export function getBootPayload(): InitPayload {
  if (!bootPayload) throw new Error('Boot payload not ready');
  return bootPayload;
}
