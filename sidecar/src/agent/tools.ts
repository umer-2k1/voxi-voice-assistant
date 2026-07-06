import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { coreBridge } from '../core-bridge.js';

/**
 * Built-in system tools. Both round-trip to the Rust core over the
 * privileged channel; the webview is never involved.
 *
 * Classification (see docs/decisions):
 * - open_path: read-only-equivalent — reveals a file/folder/URL, no mutation.
 * - insert_text: exempt from the confirm gate — it IS the explicitly
 *   requested dictation intent (PRD P6/S5).
 */
export const openPathTool = tool(
  async ({ path }: { path: string }) => {
    const result = await coreBridge.systemAction('open_path', { path });
    if (!result.ok) return `Failed to open: ${result.detail ?? 'unknown error'}`;
    return `Opened ${path}.`;
  },
  {
    name: 'open_path',
    description:
      'Open a file, folder, or URL on the user\'s computer with the default application. ' +
      'Use "~" for the home directory, e.g. "~/Documents" for the Documents folder.',
    schema: z.object({
      path: z.string().describe('Absolute path, path starting with ~, or a URL')
    })
  }
);

export const insertTextTool = tool(
  async ({ text }: { text: string }) => {
    const result = await coreBridge.systemAction('insert_text', { text });
    if (!result.ok) {
      return `Could not insert text (${result.detail ?? 'unknown error'}). It is shown in the transcript instead: ${text}`;
    }
    return 'Text inserted at the cursor.';
  },
  {
    name: 'insert_text',
    description:
      'Type text at the current cursor position in whatever application the user has focused. ' +
      'Use this when the user dictates content meant for another app.',
    schema: z.object({
      text: z.string().describe('The exact text to type at the cursor')
    })
  }
);

export const builtinTools = [openPathTool, insertTextTool];
