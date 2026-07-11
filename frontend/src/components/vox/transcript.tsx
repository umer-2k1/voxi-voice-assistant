import { useEffect, useRef, useState } from 'react';

import type { TranscriptTurn } from '@/stores/session';
import type { Settings } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';

import { cn, formatHotkey } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';

function timestamp(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Session transcript: every utterance, agent message, tool call and notice. */
export default function Transcript() {
  const turns = useSessionStore((s) => s.turns);
  const busy = useSessionStore((s) => s.busy);
  const bottom = useRef<HTMLDivElement>(null);
  // The real configured hotkey, so the hint never lies (falls back to default).
  const [hotkey, setHotkey] = useState('alt+space');

  useEffect(() => {
    void invoke<Settings>('get_settings')
      .then((settings) => {
        setHotkey(settings.hotkey);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, busy]);

  if (turns.length === 0) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-2'>
        <p className='text-sm text-gray-500'>Hold the hotkey and speak.</p>
        <span className='mono-label text-gray-400'>{formatHotkey(hotkey)} · push-to-talk</span>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-3 overflow-y-auto px-8 py-6'>
      <div className='flex justify-end'>
        <button
          type='button'
          className='mono-label text-gray-400 transition-colors hover:text-gray-600'
          onClick={() => {
            useSessionStore.getState().newConversation();
          }}
        >
          new conversation
        </button>
      </div>
      {turns.map((turn) => (
        <Turn key={turn.id} turn={turn} />
      ))}
      {busy ? <ThinkingDots /> : null}
      <div ref={bottom} />
    </div>
  );
}

function Turn({ turn }: Readonly<{ turn: TranscriptTurn }>) {
  if (turn.kind === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='bg-vox-500 max-w-[70%] rounded-xl rounded-br-sm px-4 py-2.5 text-sm text-white'>
          {turn.text}
        </div>
      </div>
    );
  }

  if (turn.kind === 'assistant') {
    return (
      <div className='flex flex-col items-start gap-1'>
        <div className='shadow-card max-w-[70%] rounded-xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700'>
          {turn.text}
        </div>
        <span className='mono-label px-1 text-gray-400'>{timestamp(turn.at)}</span>
      </div>
    );
  }

  return (
    <div className='flex justify-center'>
      <span
        className={cn(
          'rounded-full border px-3 py-1 font-mono text-[11px]',
          turn.kind === 'tool' && 'border-gray-200 bg-gray-100 text-gray-500',
          turn.kind === 'notice' && 'border-caution-line bg-caution-bg text-caution-text',
          turn.kind === 'error' && 'border-danger/30 bg-danger-bg text-danger'
        )}
      >
        {turn.text}
      </span>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className='flex items-center gap-1 px-1' aria-label='agent is thinking'>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className='animate-equalizer size-1.5 rounded-full bg-gray-300'
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}
