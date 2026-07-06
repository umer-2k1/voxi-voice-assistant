import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { OutboundToUiMessage } from '@vox/protocol';

import { useSessionStore } from '@/stores/session';

interface SidecarInfo {
  port: number | null;
  token: string;
}

let socket: WebSocket | null = null;
let started = false;

/**
 * Bridge between the Rust core, the sidecar WebSocket, and the session
 * store. Call once from the main window; survives sidecar restarts by
 * re-polling `get_sidecar_info`.
 */
export function startAgentBridge(): void {
  if (started) {
    return;
  }
  started = true;

  void connectLoop();

  // Rust emits the transcription of each push-to-talk utterance; the main
  // window forwards it to the agent and logs it in the transcript.
  void listen<{ text: string }>('transcription', (event) => {
    const store = useSessionStore.getState();
    store.addTurn('user', event.payload.text);
    sendUtterance(event.payload.text);
  });
  void listen('transcription-empty', () => {
    useSessionStore.getState().addTurn('notice', "Didn't catch that — try again.");
  });
  void listen<{ message: string }>('stt-error', (event) => {
    useSessionStore.getState().addTurn('error', event.payload.message);
  });
  void listen<string>('sidecar-status', (event) => {
    if (event.payload === 'ready') {
      void connectLoop();
    }
    if (event.payload === 'failed') {
      useSessionStore.getState().setStatus('failed');
    }
  });
}

async function connectLoop(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN) {
    return;
  }
  useSessionStore.getState().setStatus('connecting');

  for (let attempt = 0; attempt < 30; attempt++) {
    const info = await invoke<SidecarInfo>('get_sidecar_info').catch(() => null);
    if (info?.port) {
      try {
        await open(info.port, info.token);
        return;
      } catch {
        // sidecar may still be booting; keep polling
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  useSessionStore.getState().setStatus('failed');
}

function open(port: number, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'auth', payload: { token, role: 'ui' } }));
    });
    ws.addEventListener('message', (event) => {
      const parsed = OutboundToUiMessage.safeParse(JSON.parse(String(event.data)));
      if (!parsed.success) {
        return;
      }
      const message = parsed.data;
      const store = useSessionStore.getState();

      switch (message.type) {
        case 'auth_ok': {
          socket = ws;
          store.setStatus('ready');
          resolve();
          break;
        }
        case 'assistant_message': {
          store.addTurn('assistant', message.payload.text);
          break;
        }
        case 'tool_running': {
          store.addTurn('tool', `${message.payload.connector} · ${message.payload.tool}`);
          break;
        }
        case 'need_input': {
          store.addTurn('notice', message.payload.question);
          store.setBusy(false);
          break;
        }
        case 'error': {
          store.addTurn('error', message.payload.message);
          store.setBusy(false);
          break;
        }
        case 'done': {
          store.setBusy(false);
          break;
        }
        case 'confirm_request': {
          // Confirm card lands in M6.
          break;
        }
      }
    });
    ws.addEventListener('close', () => {
      if (socket === ws) {
        socket = null;
      }
      useSessionStore.getState().setStatus('stopped');
      void connectLoop();
    });
    ws.addEventListener('error', () => {
      reject(new Error('ws error'));
    });
  });
}

export function sendUtterance(text: string): void {
  const store = useSessionStore.getState();
  if (socket?.readyState !== WebSocket.OPEN) {
    store.addTurn('error', 'Agent is not connected yet.');
    return;
  }
  store.setBusy(true);
  socket.send(
    JSON.stringify({
      type: 'user_utterance',
      payload: { text, thread_id: store.threadId }
    })
  );
}
