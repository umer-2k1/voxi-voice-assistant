import { useEffect, useState } from 'react';

import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';

interface Permissions {
  accessibility: boolean;
  microphone_device: boolean;
}

const IS_MAC = navigator.userAgent.includes('Mac');

/**
 * First-run permissions onboarding (P9, macOS only): check state,
 * deep-link to System Settings, re-check. Windows renders nothing.
 */
export default function PermissionsBanner() {
  const [permissions, setPermissions] = useState<Permissions | null>(null);

  const check = () => {
    void invoke<Permissions>('check_permissions').then(setPermissions);
  };

  useEffect(check, []);

  if (!IS_MAC || permissions === null) {
    return null;
  }
  if (permissions.accessibility && permissions.microphone_device) {
    return null;
  }

  return (
    <div className='border-caution-line bg-caution-bg mx-8 mt-4 flex flex-col gap-2 rounded-lg border px-4 py-3'>
      <p className='mono-label text-caution-text'>permissions needed</p>
      {permissions.microphone_device ? null : (
        <p className='text-sm text-gray-700'>No microphone found — connect or enable one.</p>
      )}
      {permissions.accessibility ? null : (
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-gray-700'>
            Accessibility permission lets Vox type dictated text into other apps.
          </p>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              void invoke('open_system_settings', { pane: 'accessibility' });
            }}
          >
            Open System Settings
          </Button>
        </div>
      )}
      <Button size='sm' variant='ghost' className='w-fit' onClick={check}>
        Re-check
      </Button>
    </div>
  );
}
