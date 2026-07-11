import { useEffect, useState } from 'react';

import type { PermissionsState } from '@/lib/permissions';

import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';
import { checkAllPermissions } from '@/lib/permissions';

const IS_MAC = navigator.userAgent.includes('Mac');

/**
 * Post-onboarding safety net (P9): if a required permission was skipped
 * or later revoked, surface it above the transcript with a one-click
 * path to fix it. Renders nothing when everything is granted.
 */
export default function PermissionsBanner() {
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);

  const check = () => {
    void checkAllPermissions().then(setPermissions);
  };

  useEffect(check, []);

  if (permissions === null) {
    return null;
  }
  const microphoneOk = permissions.microphone === 'granted' && permissions.microphone_device;
  const accessibilityOk = !IS_MAC || permissions.accessibility;
  if (microphoneOk && accessibilityOk) {
    return null;
  }

  return (
    <div className='border-caution-line bg-caution-bg mx-8 mt-4 flex flex-col gap-2 rounded-lg border px-4 py-3'>
      <p className='mono-label text-caution-text'>permissions needed</p>
      {permissions.microphone_device ? null : (
        <p className='text-sm text-gray-700'>No microphone found — connect or enable one.</p>
      )}
      {permissions.microphone === 'denied' ? (
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-gray-700'>
            Microphone access is off — Vox cannot hear commands until it is allowed.
          </p>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              void invoke('open_system_settings', { pane: 'microphone' });
            }}
          >
            Open System Settings
          </Button>
        </div>
      ) : null}
      {accessibilityOk ? null : (
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-gray-700'>
            Accessibility permission lets Vox type dictated text into other apps.
          </p>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              void invoke('request_accessibility');
            }}
          >
            Grant Accessibility
          </Button>
        </div>
      )}
      <Button size='sm' variant='ghost' className='w-fit' onClick={check}>
        Re-check
      </Button>
    </div>
  );
}
