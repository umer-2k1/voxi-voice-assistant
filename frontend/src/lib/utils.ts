import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAC_MODIFIERS: Record<string, string> = {
  alt: '⌥',
  ctrl: '⌃',
  shift: '⇧',
  super: '⌘'
};

/** Render a stored hotkey ("alt+space") for display ("⌥ Space" / "Alt + Space"). */
export function formatHotkey(hotkey: string): string {
  const isMac = navigator.userAgent.includes('Mac');
  const parts = hotkey.split('+').map((part) => {
    const key = part.trim().toLowerCase();
    if (isMac && key in MAC_MODIFIERS) {
      return MAC_MODIFIERS[key];
    }
    return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
  });
  return parts.join(isMac ? ' ' : ' + ');
}
