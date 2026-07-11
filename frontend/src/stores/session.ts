import { create } from 'zustand';

export type TurnKind = 'user' | 'assistant' | 'tool' | 'notice' | 'error';

export interface TranscriptTurn {
  id: string;
  kind: TurnKind;
  text: string;
  at: number;
  /** True while assistant tokens are still arriving for this turn. */
  streaming?: boolean;
}

export interface PendingConfirm {
  id: string;
  tool: string;
  connector: string;
  params: Record<string, unknown>;
}

export type SidecarStatus = 'connecting' | 'ready' | 'stopped' | 'failed';

interface SessionState {
  status: SidecarStatus;
  threadId: string;
  turns: TranscriptTurn[];
  busy: boolean;
  pendingConfirm: PendingConfirm | null;
  setStatus: (status: SidecarStatus) => void;
  addTurn: (kind: TurnKind, text: string) => void;
  /** Append a token chunk to the in-progress assistant turn. */
  appendDelta: (text: string) => void;
  /** Fresh thread id + empty transcript — a new agent conversation. */
  newConversation: () => void;
  setBusy: (busy: boolean) => void;
  setPendingConfirm: (pending: PendingConfirm | null) => void;
}

// ---------- opt-in transcript persistence (privacy toggle) ----------

const PERSIST_FLAG_KEY = 'vox-transcript-persist';
const PERSIST_DATA_KEY = 'vox-transcript';
const PERSIST_LIMIT = 200;

export function isTranscriptPersistenceEnabled(): boolean {
  return localStorage.getItem(PERSIST_FLAG_KEY) === '1';
}

export function enableTranscriptPersistence(): void {
  localStorage.setItem(PERSIST_FLAG_KEY, '1');
  persistTurns(useSessionStore.getState().turns);
}

/** Disabling also erases anything already stored. */
export function disableTranscriptPersistence(): void {
  localStorage.removeItem(PERSIST_FLAG_KEY);
  localStorage.removeItem(PERSIST_DATA_KEY);
}

function persistTurns(turns: TranscriptTurn[]): void {
  if (!isTranscriptPersistenceEnabled()) {
    return;
  }
  const finished = turns.filter((turn) => turn.streaming !== true).slice(-PERSIST_LIMIT);
  try {
    localStorage.setItem(PERSIST_DATA_KEY, JSON.stringify(finished));
  } catch {
    // Quota exceeded — persistence is best-effort.
  }
}

function hydrateTurns(): TranscriptTurn[] {
  if (!isTranscriptPersistenceEnabled()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(PERSIST_DATA_KEY);
    const parsed = raw === null ? [] : (JSON.parse(raw) as TranscriptTurn[]);
    return parsed.map((turn, index) => ({ ...turn, id: `h${index}` }));
  } catch {
    return [];
  }
}

let counter = 0;

export const useSessionStore = create<SessionState>((set) => ({
  status: 'connecting',
  threadId: crypto.randomUUID(),
  turns: hydrateTurns(),
  busy: false,
  pendingConfirm: null,
  setStatus: (status) => {
    set({ status });
  },
  addTurn: (kind, text) => {
    set((state) => {
      const last = state.turns.at(-1);
      // The final assistant message replaces the streamed draft.
      if (kind === 'assistant' && last?.kind === 'assistant' && last.streaming === true) {
        return {
          turns: [...state.turns.slice(0, -1), { ...last, text, streaming: false }]
        };
      }
      return {
        turns: [...state.turns, { id: `t${++counter}`, kind, text, at: Date.now() }]
      };
    });
  },
  appendDelta: (text) => {
    set((state) => {
      const last = state.turns.at(-1);
      if (last?.kind === 'assistant' && last.streaming === true) {
        return {
          turns: [...state.turns.slice(0, -1), { ...last, text: last.text + text }]
        };
      }
      return {
        turns: [
          ...state.turns,
          { id: `t${++counter}`, kind: 'assistant', text, at: Date.now(), streaming: true }
        ]
      };
    });
  },
  newConversation: () => {
    set({ threadId: crypto.randomUUID(), turns: [], busy: false, pendingConfirm: null });
    localStorage.removeItem(PERSIST_DATA_KEY);
  },
  setBusy: (busy) => {
    set({ busy });
  },
  setPendingConfirm: (pendingConfirm) => {
    set({ pendingConfirm });
  }
}));

// Persist finished turns whenever the transcript changes (no-op unless
// the privacy toggle is on).
useSessionStore.subscribe((state, previous) => {
  if (state.turns !== previous.turns) {
    persistTurns(state.turns);
  }
});
