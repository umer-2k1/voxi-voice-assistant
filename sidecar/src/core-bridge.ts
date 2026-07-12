import { randomUUID } from 'node:crypto';

import type { InboundMessage } from '@vox/protocol';

/**
 * Request/response bridge to the Rust core over the privileged channel.
 * The sidecar sends `get_secret` / `system_action` frames with an id and
 * awaits the matching `secret_value` / `system_result`.
 */
export class CoreBridge {
  private pending = new Map<string, (value: InboundMessage) => void>();
  private send: ((message: unknown) => void) | null = null;

  attach(send: (message: unknown) => void): void {
    this.send = send;
  }

  /** Route core-role frames that carry a correlation id. */
  handle(message: InboundMessage): boolean {
    if (!('id' in message) || typeof message.id !== 'string') return false;
    const resolve = this.pending.get(message.id);
    if (!resolve) return false;
    this.pending.delete(message.id);
    resolve(message);
    return true;
  }

  private request(type: string, payload: unknown, timeoutMs = 15_000): Promise<InboundMessage> {
    if (!this.send) return Promise.reject(new Error('core channel not connected'));
    const id = randomUUID();
    const frame = { type, id, payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${type} timed out`));
      }, timeoutMs);
      this.pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      this.send!(frame);
    });
  }

  async getSecret(secretRef: string): Promise<string | null> {
    const response = await this.request('get_secret', { secret_ref: secretRef });
    if (response.type !== 'secret_value') throw new Error('unexpected response');
    return response.payload.value;
  }

  /** Persist a secret (OAuth token set) in the OS keychain via the core. */
  async storeSecret(secretRef: string, value: string): Promise<void> {
    const response = await this.request('store_secret', { secret_ref: secretRef, value });
    if (response.type !== 'secret_stored') throw new Error('unexpected response');
    if (!response.payload.ok) {
      throw new Error(response.payload.detail ?? 'keychain write failed');
    }
  }

  async systemAction(
    action: 'open_path' | 'insert_text' | 'context_snapshot',
    args: Record<string, unknown>
  ): Promise<{ ok: boolean; detail?: string }> {
    const response = await this.request('system_action', { action, args });
    if (response.type !== 'system_result') throw new Error('unexpected response');
    return response.payload;
  }
}

export const coreBridge = new CoreBridge();
