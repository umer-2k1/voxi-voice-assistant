import { AIMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import type { Settings } from '@vox/protocol';

import type { VoxAgent } from './graph.js';
import { buildAgent } from './graph.js';

export interface AgentEvents {
  assistant(text: string): void;
  /** Token-level chunk; the final assistant() for the turn is authoritative. */
  assistantDelta(text: string): void;
  toolRunning(tool: string): void;
  confirmRequest(id: string, tool: string, params: Record<string, unknown>): void;
  needInput(question: string): void;
  error(message: string, recoverable: boolean): void;
  done(threadId: string): void;
}

/**
 * Drives the LangGraph agent for one session: streams graph updates into
 * protocol events and handles the interrupt → confirm → resume cycle.
 */
export class AgentRunner {
  private agent: VoxAgent | null = null;
  private settings: Settings | null = null;
  /** interrupt id → thread that is paused on it */
  private pendingConfirms = new Map<string, string>();

  invalidate(settings: Settings): void {
    this.settings = settings;
    this.agent = null; // lazily rebuilt with fresh provider/tools
  }

  private async ensureAgent(): Promise<VoxAgent> {
    if (!this.settings) throw new Error('Agent is not configured yet.');
    this.agent ??= await buildAgent(this.settings);
    return this.agent;
  }

  async utterance(text: string, threadId: string, events: AgentEvents): Promise<void> {
    await this.run({ messages: [{ role: 'user', content: text }] }, threadId, events);
  }

  async confirmResponse(id: string, approved: boolean, events: AgentEvents): Promise<void> {
    const threadId = this.pendingConfirms.get(id);
    if (!threadId) {
      events.error('Nothing is waiting for confirmation.', true);
      return;
    }
    this.pendingConfirms.delete(id);
    await this.run(new Command({ resume: { approved } }), threadId, events);
  }

  private async run(input: unknown, threadId: string, events: AgentEvents): Promise<void> {
    let agent: VoxAgent;
    try {
      agent = await this.ensureAgent();
    } catch (error) {
      events.error(error instanceof Error ? error.message : String(error), true);
      events.done(threadId);
      return;
    }

    try {
      // 'updates' drives the event protocol; 'messages' adds token-level
      // deltas so replies render as they generate instead of all at once.
      const stream = await agent.stream(input as never, {
        configurable: { thread_id: threadId },
        streamMode: ['updates', 'messages']
      });

      let interrupted = false;
      for await (const chunk of stream as AsyncIterable<[string, unknown]>) {
        const [mode, payload] = chunk;

        if (mode === 'messages') {
          const [message, metadata] = payload as [
            { content?: unknown; tool_call_chunks?: unknown[] },
            { langgraph_node?: string } | undefined
          ];
          // Only pure-text tokens from the model node — tool-call chunks
          // and tool outputs are surfaced through 'updates' events.
          if (
            metadata?.langgraph_node === 'agent' &&
            typeof message.content === 'string' &&
            message.content !== '' &&
            (message.tool_call_chunks ?? []).length === 0
          ) {
            events.assistantDelta(message.content);
          }
          continue;
        }

        const update = payload as Record<string, unknown>;
        if ('__interrupt__' in update) {
          const interrupts = update['__interrupt__'] as Array<{
            id?: string;
            value: { tool: string; params: Record<string, unknown> };
          }>;
          for (const intr of interrupts) {
            const id = intr.id ?? crypto.randomUUID();
            this.pendingConfirms.set(id, threadId);
            events.confirmRequest(id, intr.value.tool, intr.value.params);
            interrupted = true;
          }
          continue;
        }

        const agentUpdate = update['agent'] as { messages?: unknown[] } | undefined;
        const last = agentUpdate?.messages?.at(-1);
        if (last instanceof AIMessage) {
          for (const call of last.tool_calls ?? []) {
            events.toolRunning(call.name);
          }
          const text = typeof last.content === 'string' ? last.content.trim() : '';
          if (text && (last.tool_calls ?? []).length === 0) {
            events.assistant(text);
          }
        }
      }

      if (!interrupted) events.done(threadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('agent run failed:', message);
      events.error(message, true);
      events.done(threadId);
    }
  }
}
