import { create } from 'zustand';

export type TurnKind = 'user' | 'assistant' | 'tool' | 'notice' | 'error';

export interface TranscriptTurn {
  id: string;
  kind: TurnKind;
  text: string;
  at: number;
}

export type SidecarStatus = 'connecting' | 'ready' | 'stopped' | 'failed';

interface SessionState {
  status: SidecarStatus;
  threadId: string;
  turns: TranscriptTurn[];
  busy: boolean;
  setStatus(status: SidecarStatus): void;
  addTurn(kind: TurnKind, text: string): void;
  setBusy(busy: boolean): void;
}

let counter = 0;

export const useSessionStore = create<SessionState>((set) => ({
  status: 'connecting',
  threadId: crypto.randomUUID(),
  turns: [],
  busy: false,
  setStatus: (status) => {
    set({ status });
  },
  addTurn: (kind, text) => {
    set((state) => ({
      turns: [...state.turns, { id: `t${++counter}`, kind, text, at: Date.now() }]
    }));
  },
  setBusy: (busy) => {
    set({ busy });
  }
}));
