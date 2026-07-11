import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';

/**
 * System notification for moments the user may have walked away from:
 * a command waiting on approval or a question. No-op when the window is
 * focused (the transcript is already in view) or permission is missing.
 */
export async function notifyIfUnfocused(title: string, body: string): Promise<void> {
  if (document.hasFocus()) {
    return;
  }
  const granted = await isPermissionGranted().catch(() => false);
  if (granted) {
    sendNotification({ title, body });
  }
}
