/**
 * Vox agent sidecar entry point.
 *
 * Spawned by the Rust core with VOX_SESSION_TOKEN in the environment.
 * Binds a WebSocket server to 127.0.0.1 on an OS-assigned port and prints
 * `{"port": N}` on stdout so the core can complete the handshake.
 */
import type { AgentEvents } from './agent/runner.js';
import { AgentRunner } from './agent/runner.js';
import { coreBridge } from './core-bridge.js';
import { mcpManager } from './mcp/manager.js';
import { runOAuthFlow } from './oauth.js';
import { startServer } from './server.js';

const token = process.env['VOX_SESSION_TOKEN'];
if (!token) {
  console.error('VOX_SESSION_TOKEN not set; refusing to start.');
  process.exit(1);
}

const runner = new AgentRunner();

const handle = await startServer(token, {
  onUiMessage(message) {
    const events: AgentEvents = {
      assistant: (text) => handle.toUi({ type: 'assistant_message', payload: { text } }),
      toolRunning: (tool) =>
        handle.toUi({ type: 'tool_running', payload: { tool, connector: 'vox' } }),
      confirmRequest: (id, tool, params) =>
        handle.toUi({ type: 'confirm_request', payload: { id, tool, connector: 'vox', params } }),
      needInput: (question) => handle.toUi({ type: 'need_input', payload: { question } }),
      error: (msg, recoverable) =>
        handle.toUi({ type: 'error', payload: { message: msg, recoverable } }),
      done: (threadId) => handle.toUi({ type: 'done', payload: { thread_id: threadId } })
    };

    switch (message.type) {
      case 'user_utterance':
        void runner.utterance(message.payload.text, message.payload.thread_id, events);
        break;
      case 'confirm_response':
        void runner.confirmResponse(message.payload.id, message.payload.approved, events);
        break;
      case 'resume':
        void runner.utterance(message.payload.text, message.payload.thread_id, events);
        break;
      case 'oauth_start': {
        // Directory click-to-connect: authorize in the browser, store the
        // token set in the keychain, then tell the UI it can enable the
        // connector. The keychain write happens before oauth_result.
        const { id } = message;
        console.error(`oauth: starting flow for ${message.payload.name}`);
        void runOAuthFlow(message.payload.server_url, message.payload.secret_ref)
          .then(() => handle.toUi({ type: 'oauth_result', id, payload: { ok: true } }))
          .catch((error: unknown) => {
            const detail = error instanceof Error ? error.message : String(error);
            console.error(`oauth: ${message.payload.name} failed: ${detail}`);
            handle.toUi({ type: 'oauth_result', id, payload: { ok: false, error: detail } });
          });
        break;
      }
      case 'test_connector': {
        // Connectors tab: probe the server and report its tool list.
        const { id } = message;
        void mcpManager
          .listToolsFor(message.payload)
          .then((tools) =>
            handle.toUi({ type: 'connector_test_result', id, payload: { ok: true, tools } })
          )
          .catch((error: unknown) =>
            handle.toUi({
              type: 'connector_test_result',
              id,
              payload: { ok: false, tools: [], error: String(error) }
            })
          );
        break;
      }
      default:
        break;
    }
  },
  onCoreMessage(message) {
    // Correlated get_secret / system_action responses.
    if (coreBridge.handle(message)) return;

    if (message.type === 'config_updated') {
      void (async () => {
        try {
          await mcpManager.rebuild(message.payload.connectors);
        } catch (error) {
          console.error('mcp rebuild failed:', error);
        }
        runner.invalidate(message.payload.settings);
        console.error(
          `config: ${message.payload.connectors.length} connector(s), provider ${message.payload.settings.llm_provider}`
        );
      })();
    }
  }
});

coreBridge.attach((message) => handle.toCore(message));

// Port handshake — the only line the Rust core reads from stdout.
console.log(JSON.stringify({ port: handle.port }));
console.error(`vox sidecar listening on 127.0.0.1:${handle.port}`);
