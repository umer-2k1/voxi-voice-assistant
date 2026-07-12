import type { ConnectorConfig, LlmProvider, OAuthPreset } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { OutboundToUiMessage } from '@vox/protocol';

import { notifyIfUnfocused } from '@/lib/notify';
import { useSessionStore } from '@/stores/session';

/** Only the main window raises system notifications (overlay would double-send). */
let notifyingWindow = false;

export interface ConnectorTestResult {
  ok: boolean;
  tools: string[];
  error?: string;
}

const pendingTests = new Map<string, (result: ConnectorTestResult) => void>();

export interface OAuthResult {
  ok: boolean;
  error?: string;
}

const pendingOAuth = new Map<string, (result: OAuthResult) => void>();

export interface ModelsListResult {
  ok: boolean;
  models: string[];
  error?: string;
}

const pendingModels = new Map<string, (result: ModelsListResult) => void>();

export interface LlmTestResult {
  ok: boolean;
  provider: string;
  model: string;
  latency_ms?: number;
  error?: string;
}

const pendingLlmTests = new Map<string, (result: LlmTestResult) => void>();

/** Browser round-trips are slow; give the user six minutes to authorize. */
const OAUTH_TIMEOUT_MS = 6 * 60 * 1000;

interface SidecarInfo {
  port: number | null;
  token: string;
}

let socket: WebSocket | null = null;
let started = false;

/**
 * Bridge between the Rust core, the sidecar WebSocket, and the session
 * store. Both windows call this; only the main window forwards
 * transcriptions to the agent (the overlay would double-send).
 * Survives sidecar restarts by re-polling `get_sidecar_info`.
 */
export function startAgentBridge(window: 'main' | 'overlay' = 'main'): void {
  if (started) {
    return;
  }
  started = true;
  notifyingWindow = window === 'main';

  void connectLoop();

  void listen<string>('sidecar-status', (event) => {
    if (event.payload === 'ready') {
      void connectLoop();
    }
    // 'unavailable' = launch command could not be built (e.g. Node
    // missing on a packaged install) — same dead end as 'failed'.
    if (event.payload === 'failed' || event.payload === 'unavailable') {
      useSessionStore.getState().setStatus('failed');
    }
  });

  if (window !== 'main') {
    return;
  }

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
  // e.g. enigo failing in a secure input field (P6) — surface the reason.
  void listen<string>('system-action-error', (event) => {
    useSessionStore.getState().addTurn('notice', event.payload);
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
        case 'assistant_delta': {
          store.appendDelta(message.payload.text);
          break;
        }
        case 'tool_running': {
          store.addTurn('tool', `${message.payload.connector} · ${message.payload.tool}`);
          break;
        }
        case 'need_input': {
          store.addTurn('notice', message.payload.question);
          store.setBusy(false);
          if (notifyingWindow) {
            void notifyIfUnfocused('Vox has a question', message.payload.question);
          }
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
          store.setPendingConfirm(message.payload);
          store.addTurn('notice', `Waiting for confirmation: ${message.payload.tool}`);
          if (notifyingWindow) {
            void notifyIfUnfocused(
              'Vox needs your approval',
              `${message.payload.connector} · ${message.payload.tool} is waiting for a decision.`
            );
          }
          break;
        }
        case 'connector_test_result': {
          const resolvePending = pendingTests.get(message.id);
          if (resolvePending) {
            pendingTests.delete(message.id);
            resolvePending(message.payload);
          }
          break;
        }
        case 'oauth_result': {
          const resolvePending = pendingOAuth.get(message.id);
          if (resolvePending) {
            pendingOAuth.delete(message.id);
            resolvePending(message.payload);
          }
          break;
        }
        case 'models_list': {
          const resolvePending = pendingModels.get(message.id);
          if (resolvePending) {
            pendingModels.delete(message.id);
            resolvePending(message.payload);
          }
          break;
        }
        case 'llm_test_result': {
          const resolvePending = pendingLlmTests.get(message.id);
          if (resolvePending) {
            pendingLlmTests.delete(message.id);
            resolvePending(message.payload);
          }
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

/** Probe a connector via the sidecar; resolves with its tool list. */
export function testConnector(connector: ConnectorConfig): Promise<ConnectorTestResult> {
  if (socket?.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, tools: [], error: 'Agent is not connected yet.' });
  }
  const id = crypto.randomUUID();
  const frame = JSON.stringify({ type: 'test_connector', id, payload: connector });
  return new Promise((resolve) => {
    pendingTests.set(id, resolve);
    setTimeout(() => {
      if (pendingTests.delete(id)) {
        resolve({ ok: false, tools: [], error: 'Connection test timed out.' });
      }
    }, 30_000);
    socket?.send(frame);
  });
}

/**
 * Run the browser OAuth flow for a directory connector. The sidecar does
 * the work (discovery, PKCE, token exchange) and stores the token set in
 * the keychain under `secretReference` before resolving — the token never
 * reaches this window.
 */
export function startOAuth(
  serverUrl: string,
  secretReference: string,
  name: string,
  preset?: OAuthPreset
): Promise<OAuthResult> {
  if (socket?.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, error: 'Agent is not connected yet.' });
  }
  const id = crypto.randomUUID();
  const frame = JSON.stringify({
    type: 'oauth_start',
    id,
    payload: { server_url: serverUrl, secret_ref: secretReference, name, preset }
  });
  return new Promise((resolve) => {
    pendingOAuth.set(id, resolve);
    setTimeout(() => {
      if (pendingOAuth.delete(id)) {
        resolve({ ok: false, error: 'Authorization timed out.' });
      }
    }, OAUTH_TIMEOUT_MS);
    socket?.send(frame);
  });
}

/** Fetch the live model catalog for a provider (Settings → Reasoning). */
export function listProviderModels(provider: LlmProvider): Promise<ModelsListResult> {
  if (socket?.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, models: [], error: 'Agent is not connected yet.' });
  }
  const id = crypto.randomUUID();
  const frame = JSON.stringify({ type: 'list_models', id, payload: { provider } });
  return new Promise((resolve) => {
    pendingModels.set(id, resolve);
    setTimeout(() => {
      if (pendingModels.delete(id)) {
        resolve({ ok: false, models: [], error: 'Fetching models timed out.' });
      }
    }, 20_000);
    socket?.send(frame);
  });
}

/** One-token smoke test of the saved provider + model + key. */
export function testLlmConnection(): Promise<LlmTestResult> {
  if (socket?.readyState !== WebSocket.OPEN) {
    return Promise.resolve({
      ok: false,
      provider: '',
      model: '',
      error: 'Agent is not connected yet.'
    });
  }
  const id = crypto.randomUUID();
  const frame = JSON.stringify({ type: 'test_llm', id, payload: {} });
  return new Promise((resolve) => {
    pendingLlmTests.set(id, resolve);
    setTimeout(() => {
      if (pendingLlmTests.delete(id)) {
        resolve({ ok: false, provider: '', model: '', error: 'Connection test timed out.' });
      }
    }, 40_000);
    socket?.send(frame);
  });
}

/** Approve or deny a pending side-effecting tool call (P7). */
export function sendConfirmResponse(id: string, approved: boolean): void {
  const store = useSessionStore.getState();
  store.setPendingConfirm(null);
  if (socket?.readyState !== WebSocket.OPEN) {
    store.addTurn('error', 'Agent is not connected — the action was not approved.');
    return;
  }
  store.setBusy(true);
  socket.send(JSON.stringify({ type: 'confirm_response', payload: { id, approved } }));
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
