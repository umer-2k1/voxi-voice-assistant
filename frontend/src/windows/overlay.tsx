import { useEffect, useRef, useState } from 'react';

import { listen } from '@tauri-apps/api/event';

import { cn } from '@/lib/utils';

type MicState = 'idle' | 'listening' | 'thinking';

/**
 * Overlay window (route "/overlay") — frameless, transparent, always-on-top.
 * Shows the mic pill; per the design system these are the only elements
 * that ever loop an animation. The confirm-before-acting card lands in M6.
 */
export default function OverlayWindow() {
  const [state, setState] = useState<MicState>('idle');
  const [line, setLine] = useState<string | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const showLine = (text: string, ms = 5000) => {
      if (lineTimer.current) {
        clearTimeout(lineTimer.current);
      }
      setLine(text);
      lineTimer.current = setTimeout(() => {
        setLine(null);
      }, ms);
    };

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
  }, []);

  return (
    <div className='flex h-dvh flex-col items-center justify-end gap-2 bg-transparent pb-2'>
      {line === null ? null : (
        <div className='shadow-card max-w-[340px] truncate rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-700'>
          {line}
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-full border bg-white py-2 pr-4 pl-3',
          state === 'listening'
            ? 'border-vox-300 animate-listening-pulse shadow-glow'
            : 'shadow-card border-gray-200'
        )}
      >
        {state === 'listening' ? <Equalizer /> : <StatusDot state={state} />}
        <span className={cn('mono-label', state === 'idle' ? 'text-gray-400' : 'text-gray-700')}>
          {state === 'idle' && 'idle'}
          {state === 'listening' && 'listening'}
          {state === 'thinking' && 'thinking…'}
        </span>
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
