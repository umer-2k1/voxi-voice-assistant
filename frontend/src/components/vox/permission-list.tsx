import { useEffect, useState } from 'react';

import type { PermissionsState } from '@/lib/permissions';

import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';
import { checkAllPermissions, requestNotifications } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const IS_MAC = navigator.userAgent.includes('Mac');

/**
 * Every OS permission Vox uses, each with why it's needed and when it's
 * exercised. Live state refreshes every 2s so system prompts answered
 * outside the app are picked up without a manual re-check. Shared by the
 * onboarding wizard and Settings.
 */
export default function PermissionList() {
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
