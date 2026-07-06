import type { InboundMessage, Role } from '@vox/protocol';
import { parseInbound } from '@vox/protocol';
import { WebSocket, WebSocketServer } from 'ws';

import { tokenMatches } from './auth.js';

const AUTH_TIMEOUT_MS = 3000;

export interface VoxSocket extends WebSocket {
  role?: Role;
}

export interface ServerHandle {
  port: number;
  /** Send a message to every authenticated UI client. */
  toUi(message: unknown): void;
  /** Send a message to the privileged core client, if connected. */
  toCore(message: unknown): void;
  close(): void;
}

export interface ServerCallbacks {
  onUiMessage(message: InboundMessage, reply: (message: unknown) => void): void;
  onCoreMessage(message: InboundMessage): void;
}

/**
 * Token-authenticated WebSocket server bound to 127.0.0.1 on an
 * OS-assigned port. The first frame on every connection must be a valid
 * `auth` message or the socket is dropped (PRD §8.1, §9.2).
 */
export function startServer(
  token: string,
  callbacks: ServerCallbacks
): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 }, () => {
      const address = wss.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('could not determine bound port'));
        return;
      }
      resolve({
        port: address.port,
        toUi(message) {
          const raw = JSON.stringify(message);
          for (const client of wss.clients) {
            const socket = client as VoxSocket;
            if (socket.role === 'ui' && socket.readyState === WebSocket.OPEN) {
              socket.send(raw);
            }
          }
        },
        toCore(message) {
          const raw = JSON.stringify(message);
          for (const client of wss.clients) {
            const socket = client as VoxSocket;
            if (socket.role === 'core' && socket.readyState === WebSocket.OPEN) {
              socket.send(raw);
            }
          }
        },
        close() {
          wss.close();
        }
      });
    });

    wss.on('connection', (socket: VoxSocket) => {
      const authTimer = setTimeout(() => {
        if (!socket.role) socket.terminate();
      }, AUTH_TIMEOUT_MS);

      socket.on('message', (data) => {
        const message = parseInbound(data.toString());

        if (!socket.role) {
          // First frame must authenticate.
          if (
            message?.type === 'auth' &&
            tokenMatches(message.payload.token, token)
          ) {
            socket.role = message.payload.role;
            clearTimeout(authTimer);
            socket.send(JSON.stringify({ type: 'auth_ok', payload: { role: socket.role } }));
          } else {
            clearTimeout(authTimer);
            socket.terminate();
          }
          return;
        }

        if (!message || message.type === 'auth') return;

        if (socket.role === 'core') {
          callbacks.onCoreMessage(message);
        } else {
          callbacks.onUiMessage(message, (reply) => socket.send(JSON.stringify(reply)));
        }
      });

      socket.on('error', (error) => {
        console.error('socket error:', error.message);
      });
    });

    wss.on('error', reject);
  });
}
