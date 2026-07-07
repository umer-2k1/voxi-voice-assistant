import { useCallback, useEffect, useRef, useState } from 'react';

import type { PendingConfirm } from '@/stores/session';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { sendConfirmResponse, startAgentBridge } from '@/lib/agent-socket';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';

type MicState = 'idle' | 'listening' | 'thinking';

const OVERLAY_SIZE = { width: 380, height: 120 };
const OVERLAY_SIZE_CONFIRM = { width: 420, height: 320 };

/**
 * Overlay window (route "/overlay") — frameless, transparent, always-on-top.
 * Shows the mic pill (the only looping animations in the app) and the
 * confirm-before-acting card (P7).
 */
export default function OverlayWindow() {
  const [state, setState] = useState<MicState>('idle');
  const [line, setLine] = useState<string | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingConfirm = useSessionStore((s) => s.pendingConfirm);
  const busy = useSessionStore((s) => s.busy);
  const turns = useSessionStore((s) => s.turns);

  useEffect(() => {
    startAgentBridge('overlay');
  }, []);

  const showLine = useCallback((text: string, ms = 5000) => {
    if (lineTimer.current) {
      clearTimeout(lineTimer.current);
    }
    setLine(text);
    lineTimer.current = setTimeout(() => {
      setLine(null);
    }, ms);
  }, []);

  // Surface agent replies in the overlay so Vox is fully usable while
  // another app has focus — no need to switch to the main window.
  useEffect(() => {
    const last = turns.at(-1);
    if (!last) {
      return;
    }
    if (last.kind === 'assistant' || last.kind === 'notice' || last.kind === 'error') {
      showLine(last.text, 9000);
    }
  }, [turns, showLine]);

  // Grow the window for the confirm card; shrink back after.
  useEffect(() => {
    const size = pendingConfirm ? OVERLAY_SIZE_CONFIRM : OVERLAY_SIZE;
    void invoke('resize_overlay', size).catch(() => undefined);
  }, [pendingConfirm]);

  useEffect(() => {
    const subs = [
      listen<MicState>('mic-state', (event) => {
        setState(event.payload);
      }),
      listen<{ text: string }>('transcription', (event) => {
        showLine(event.payload.text);
      }),
      listen('transcription-empty', () => {
        showLine("Didn't catch that — try again.", 3000);
      }),
      listen<{ message: string }>('stt-error', (event) => {
        showLine(event.payload.message, 6000);
      }),
      listen<string>('mic-error', (event) => {
        showLine(event.payload, 6000);
      })
    ];
    return () => {
      for (const sub of subs) {
        void sub.then((unlisten) => {
          unlisten();
        });
      }
      if (lineTimer.current) {
        clearTimeout(lineTimer.current);
      }
    };
  }, [showLine]);

  // The mic pipeline drives listening/thinking; while the agent itself is
  // working the session store's busy flag keeps the pill on "thinking…".
  const displayState: MicState = busy && state === 'idle' ? 'thinking' : state;

  return (
    <div className='flex h-dvh flex-col items-center justify-end gap-2 bg-transparent pb-2'>
      {pendingConfirm === null ? null : <ConfirmCard pending={pendingConfirm} />}
      {line === null ? null : (
        <div className='shadow-card max-w-[340px] truncate rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-700'>
          {line}
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-full border bg-white py-2 pr-4 pl-3',
          displayState === 'listening'
            ? 'border-vox-300 animate-listening-pulse shadow-glow'
            : 'shadow-card border-gray-200'
        )}
      >
        {displayState === 'listening' ? <Equalizer /> : <StatusDot state={displayState} />}
        <span
          className={cn('mono-label', displayState === 'idle' ? 'text-gray-400' : 'text-gray-700')}
        >
          {displayState === 'idle' && 'idle'}
          {displayState === 'listening' && 'listening'}
          {displayState === 'thinking' && 'thinking…'}
        </span>
      </div>
    </div>
  );
}

/**
 * Confirm-before-acting card (design system §8): caution-styled, shows the
 * exact tool and parameters; nothing executes without explicit approval.
 */
function ConfirmCard({ pending }: Readonly<{ pending: PendingConfirm }>) {
  return (
    <div className='border-caution-line shadow-pop w-[400px] rounded-xl border bg-white p-4'>
      <p className='mono-label text-caution-text'>confirm before acting</p>
      <p className='text-ink mt-2 text-sm font-semibold'>{pending.tool}</p>
      <pre className='bg-caution-bg border-caution-line mt-2 max-h-36 overflow-auto rounded-md border px-3 py-2 font-mono text-[11px] whitespace-pre-wrap text-gray-700'>
        {JSON.stringify(pending.params, null, 2)}
      </pre>
      <div className='mt-3 flex justify-end gap-2'>
        <button
          type='button'
          className='hover:bg-gray-150 rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-120'
          onClick={() => {
            sendConfirmResponse(pending.id, false);
          }}
        >
          Deny
        </button>
        <button
          type='button'
          className='bg-vox-500 hover:bg-vox-600 rounded-md px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-120'
          onClick={() => {
            sendConfirmResponse(pending.id, true);
          }}
        >
          Confirm & run
        </button>
      </div>
    </div>
  );
}

function StatusDot({ state }: Readonly<{ state: MicState }>) {
  return (
    <span
      className={cn('size-2 rounded-full', state === 'thinking' ? 'bg-vox-500' : 'bg-gray-300')}
      aria-hidden
    />
  );
}

/** Three-bar equalizer — the brand mark, alive while Vox listens. */
function Equalizer() {
  return (
    <span className='flex h-4 items-center gap-0.5' aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className='bg-vox-500 animate-equalizer w-1 origin-center rounded-full'
          style={{ height: [10, 16, 7][index], animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </span>
  );
}
