import { useEffect, useState } from 'react';

import type { PermissionsState } from '@/lib/permissions';
import type { Settings } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OllamaModelPicker from '@/components/vox/ollama-model-picker';
import { checkAllPermissions, requestNotifications } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const GROQ_KEY_REF = 'groq_api_key';
const IS_MAC = navigator.userAgent.includes('Mac');

type StepKey = 'welcome' | 'permissions' | 'reasoning' | 'ready';

const STEPS: StepKey[] = ['welcome', 'permissions', 'reasoning', 'ready'];

/**
 * First-run setup wizard: the whole path from install to first voice
 * command in one guided flow — permissions, reasoning model, and a
 * pointer to connectors. Nothing here requires a terminal.
 */
export default function Onboarding({ onDone }: Readonly<{ onDone: () => void }>) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? 'welcome';
  const last = index === STEPS.length - 1;

  return (
    <div className='bg-background flex h-dvh items-center justify-center'>
      <div className='shadow-pop flex w-[520px] flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-8'>
        <div className='flex items-center justify-between'>
          <BrandMark />
          <span className='mono-label text-gray-400'>
            step {index + 1} of {STEPS.length}
          </span>
        </div>

        {step === 'welcome' ? <WelcomeStep /> : null}
        {step === 'permissions' ? <PermissionsStep /> : null}
        {step === 'reasoning' ? <ReasoningStep /> : null}
        {step === 'ready' ? <ReadyStep /> : null}

        <div className='flex items-center justify-between'>
          <Button
            variant='ghost'
            className={cn(index === 0 && 'invisible')}
            onClick={() => {
              setIndex((current) => Math.max(0, current - 1));
            }}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              if (last) {
                onDone();
              } else {
                setIndex((current) => current + 1);
              }
            }}
          >
            {last ? 'Start using Vox' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const BRAND_BARS = [
  { id: 'low', height: 10 },
  { id: 'mid', height: 16 },
  { id: 'high', height: 7 }
];

function BrandMark() {
  return (
    <span className='flex items-end gap-0.5' aria-hidden>
      {BRAND_BARS.map((bar) => (
        <span key={bar.id} className='bg-vox-500 w-1 rounded-full' style={{ height: bar.height }} />
      ))}
      <span className='text-ink ml-2 text-[15px] font-bold'>Vox</span>
    </span>
  );
}

function WelcomeStep() {
  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Talk to your computer.</h1>
      <p className='text-sm leading-relaxed text-gray-700'>
        Hold the hotkey from any app, say what you want done, and release. Vox transcribes on your
        device, plans with an agent, and asks before it changes anything.
      </p>
      <p className='mono-label text-gray-500'>⌥ space · push-to-talk</p>
      <p className='text-sm text-gray-500'>
        This takes about a minute: permissions, then a reasoning model.
      </p>
    </div>
  );
}

/**
 * Every OS permission Vox uses, each with why it's needed and when it's
 * exercised. Live state refreshes every 2s so system prompts answered
 * outside the app are picked up without a manual re-check.
 */
function PermissionsStep() {
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);

  const check = () => {
    void checkAllPermissions().then(setPermissions);
  };

  useEffect(() => {
    check();
    const timer = setInterval(check, 2000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const microphoneGranted = permissions?.microphone === 'granted';
  const microphoneDenied = permissions?.microphone === 'denied';

  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Permissions.</h1>
      <p className='text-sm text-gray-600'>
        Each one is asked once, used only for what it says, and works the moment you grant it.
      </p>

      <PermissionRow
        granted={microphoneGranted}
        title='Microphone'
        detail='Why: so Vox can hear your commands. When: only while you hold the push-to-talk hotkey — audio is transcribed on your device and never stored or uploaded.'
        action={
          microphoneDenied ? (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                void invoke('open_system_settings', { pane: 'microphone' });
              }}
            >
              Open System Settings
            </Button>
          ) : (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                void invoke('request_microphone');
              }}
            >
              Enable
            </Button>
          )
        }
      />

      {IS_MAC ? (
        <PermissionRow
          granted={permissions?.accessibility ?? false}
          title='Accessibility'
          detail='Why: lets Vox type dictated text and act inside other apps. When: only while a command you spoke asks Vox to type or click somewhere — never in the background.'
          action={
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  void invoke('request_accessibility');
                }}
              >
                Enable
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  void invoke('open_system_settings', { pane: 'accessibility' });
                }}
              >
                System Settings
              </Button>
            </div>
          }
        />
      ) : null}

      <PermissionRow
        granted={permissions?.notifications ?? false}
        title='Notifications'
        detail='Why: so Vox can tell you when a command finishes or needs your approval. When: only while Vox is working on something and you are in another app — nothing promotional, ever.'
        action={
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              void requestNotifications().then(check);
            }}
          >
            Enable
          </Button>
        }
      />

      <p className='text-xs text-gray-500'>
        You can continue without any of these — the matching feature just stays off until granted,
        and you can grant them later from Settings.
      </p>
    </div>
  );
}

function PermissionRow({
  granted,
  title,
  detail,
  action
}: Readonly<{
  granted: boolean;
  title: string;
  detail: string;
  action?: React.ReactNode;
}>) {
  return (
    <div className='flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3'>
      <span
        className={cn('mt-1 size-2 shrink-0 rounded-full', granted ? 'bg-success' : 'bg-caution')}
        aria-hidden
      />
      <div className='flex-1'>
        <p className='text-ink text-sm font-semibold'>
          {title}{' '}
          <span className='mono-label ml-1 text-gray-400'>{granted ? 'granted' : 'needed'}</span>
        </p>
        <p className='text-xs leading-relaxed text-gray-500'>{detail}</p>
      </div>
      {granted ? null : action}
    </div>
  );
}

/** Pick the agent's brain: Groq key or a local Ollama model. */
function ReasoningStep() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [hasGroqKey, setHasGroqKey] = useState(false);

  useEffect(() => {
    void invoke<Settings>('get_settings').then(setSettings);
    void invoke<boolean>('has_secret', { secretRef: GROQ_KEY_REF }).then(setHasGroqKey);
  }, []);

  if (settings === null) {
    return null;
  }

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void invoke('update_settings', { settings: next });
  };

  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Pick a brain.</h1>
      <div className='flex items-center gap-2'>
        {(['groq', 'ollama'] as const).map((provider) => (
          <Button
            key={provider}
            size='sm'
            variant={settings.llm_provider === provider ? 'default' : 'outline'}
            onClick={() => {
              update({
                llm_provider: provider,
                llm_model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'qwen3:8b'
              });
            }}
          >
            {provider === 'groq' ? 'Groq (cloud, fast)' : 'Ollama (local, private)'}
          </Button>
        ))}
      </div>

      {settings.llm_provider === 'groq' ? (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='onboarding-groq-key'>
            Groq API key{' '}
            <span className='mono-label ml-1 text-gray-400'>
              {hasGroqKey ? 'configured' : 'free at console.groq.com'}
            </span>
          </Label>
          <div className='flex gap-2'>
            <Input
              id='onboarding-groq-key'
              type='password'
              placeholder='gsk_…'
              value={groqKey}
              onChange={(event) => {
                setGroqKey(event.target.value);
              }}
            />
            <Button
              disabled={groqKey === ''}
              onClick={() => {
                void invoke('store_secret', { secretRef: GROQ_KEY_REF, value: groqKey }).then(
                  () => {
                    setGroqKey('');
                    setHasGroqKey(true);
                    void invoke('update_settings', { settings });
                  }
                );
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <OllamaModelPicker
          value={settings.llm_model}
          onChange={(model) => {
            update({ llm_model: model });
          }}
        />
      )}
    </div>
  );
}

function ReadyStep() {
  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Ready.</h1>
      <p className='text-sm leading-relaxed text-gray-700'>
        Hold <span className='font-mono text-xs'>⌥ space</span>, say{' '}
        <em>&ldquo;open my documents folder&rdquo;</em>, and release. The floating pill shows what
        Vox heard and what it did.
      </p>
      <p className='text-sm leading-relaxed text-gray-700'>
        To let Vox reach your tools — Gmail, Google Drive, Notion, GitHub, your files — open{' '}
        <span className='font-semibold'>Connectors → Browse directory</span> and click connect.
      </p>
      <p className='text-xs text-gray-500'>
        Everything here can be changed later in Settings. Speech stays on your device either way.
      </p>
    </div>
  );
}
