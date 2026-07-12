import { useEffect, useState } from 'react';

import type { Settings } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';

import PermissionList from '@/components/vox/permission-list';
import ReasoningSettings from '@/components/vox/reasoning-settings';
import { cn } from '@/lib/utils';
import {
  disableTranscriptPersistence,
  enableTranscriptPersistence,
  isTranscriptPersistenceEnabled
} from '@/stores/session';

const STT_MODELS = [
  { key: 'small', label: 'small — default, needs a capable CPU (466 MB)' },
  { key: 'base.en', label: 'base.en — fast, English only (142 MB)' },
  { key: 'large-v3', label: 'large-v3 — best quality, slow (2.9 GB)' }
];

/** Settings: hotkey, reasoning provider/model/key (S7, P10), STT model. */
export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void invoke<Settings>('get_settings').then(setSettings);
  }, []);

  if (settings === null) {
    return null;
  }

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await invoke('update_settings', { settings: next });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 1500);
  };

  return (
    <div className='flex h-full flex-col gap-6 overflow-y-auto px-8 py-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Settings</h1>
          <p className='text-sm text-gray-500'>Changes apply immediately.</p>
        </div>
        <span
          className={cn(
            'mono-label transition-opacity duration-200',
            saved ? 'text-success opacity-100' : 'opacity-0'
          )}
        >
          saved
        </span>
      </div>

      <Section title='Push-to-talk' hint='Click the keycap, then press the new combination.'>
        <HotkeyRecorder
          value={settings.hotkey}
          onChange={(hotkey) => {
            void update({ hotkey });
          }}
        />
      </Section>

      <Section
        title='Reasoning'
        hint='Pick a provider, save its API key once, choose a model from the live list, then test.'
      >
        <ReasoningSettings settings={settings} update={update} />
      </Section>

      <Section title='Speech to text' hint='Runs fully on-device. Changing model may download it.'>
        <div className='flex flex-col gap-1.5'>
          {STT_MODELS.map((model) => (
            <label key={model.key} className='flex items-center gap-2 text-sm text-gray-700'>
              <input
                type='radio'
                name='stt-model'
                className='accent-vox-500'
                checked={settings.stt_model === model.key}
                onChange={() => {
                  void update({ stt_model: model.key });
                  void invoke('download_stt_model', { model: model.key }).catch(() => undefined);
                }}
              />
              <span className='font-mono text-xs'>{model.label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section
        title='Permissions'
        hint='What Vox is allowed to do, and why. Grant here or revoke any time in System Settings.'
      >
        <PermissionList />
      </Section>

      <Section title='Privacy' hint='Off by default. Nothing ever leaves this device either way.'>
        <TranscriptPersistenceToggle />
      </Section>
    </div>
  );
}

/** Opt-in transcript persistence; disabling erases what was stored. */
function TranscriptPersistenceToggle() {
  const [enabled, setEnabled] = useState(isTranscriptPersistenceEnabled);

  return (
    <label className='flex items-start gap-2 text-sm text-gray-700'>
      <input
        type='checkbox'
        className='accent-vox-500 mt-0.5'
        checked={enabled}
        onChange={(event) => {
          if (event.target.checked) {
            enableTranscriptPersistence();
          } else {
            disableTranscriptPersistence();
          }
          setEnabled(event.target.checked);
        }}
      />
      <span>
        Keep the transcript between launches
        <span className='block text-xs text-gray-500'>
          Stores the last 200 turns locally so a restart doesn&rsquo;t lose context. Turning this
          off deletes the stored transcript immediately.
        </span>
      </span>
    </label>
  );
}

function Section({
  title,
  hint,
  children
}: Readonly<{ title: string; hint: string; children: React.ReactNode }>) {
  return (
    <section className='shadow-card flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4'>
      <div>
        <h2 className='text-ink text-[15px] font-bold'>{title}</h2>
        <p className='text-[13px] text-gray-500'>{hint}</p>
      </div>
      {children}
    </section>
  );
}

/** Design-system keycap input: click, press keys, saved on release. */
function HotkeyRecorder({
  value,
  onChange
}: Readonly<{ value: string; onChange: (hotkey: string) => void }>) {
  const [recording, setRecording] = useState(false);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!recording) {
      return;
    }
    event.preventDefault();
    const key = event.key.toLowerCase();
    if (['shift', 'control', 'alt', 'meta'].includes(key)) {
      return; // wait for a non-modifier
    }
    const parts = [
      event.ctrlKey ? 'ctrl' : null,
      event.altKey ? 'alt' : null,
      event.shiftKey ? 'shift' : null,
      event.metaKey ? 'super' : null,
      key === ' ' ? 'space' : key
    ].filter(Boolean);
    if (parts.length < 2) {
      return; // require at least one modifier
    }
    setRecording(false);
    onChange(parts.join('+'));
  };

  return (
    <button
      type='button'
      className={cn(
        'w-fit rounded-md border px-3 py-1.5 font-mono text-xs transition-colors duration-120',
        recording
          ? 'border-vox-300 bg-vox-50 text-vox-800'
          : 'border-gray-300 bg-gray-100 text-gray-700'
      )}
      onClick={() => {
        setRecording(true);
      }}
      onBlur={() => {
        setRecording(false);
      }}
      onKeyDown={onKeyDown}
    >
      {recording ? 'press keys…' : value}
    </button>
  );
}
