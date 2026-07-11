import { invoke } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

/** macOS TCC state for the microphone; other platforms report device presence. */
export type MicPermission = 'granted' | 'denied' | 'undetermined' | 'unknown';

interface CorePermissions {
  accessibility: boolean;
  microphone: MicPermission;
  microphone_device: boolean;
}

export interface PermissionsState extends CorePermissions {
  notifications: boolean;
}

/** One snapshot of everything Vox may ask the OS for. */
export async function checkAllPermissions(): Promise<PermissionsState> {
  const [core, notifications] = await Promise.all([
    invoke<CorePermissions>('check_permissions'),
    isPermissionGranted().catch(() => false)
  ]);
  return { ...core, notifications };
}

/** Fire the OS notification consent prompt; resolves to the new state. */
export async function requestNotifications(): Promise<boolean> {
  const result = await requestPermission().catch(() => 'denied');
  return result === 'granted';
}
