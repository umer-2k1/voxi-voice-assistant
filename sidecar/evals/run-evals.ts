/**
 * Eval harness (PRD §12): scripted text-in runs against the real agent,
 * asserting on tool calls — catches agent regressions without voice.
 *
 * Usage:  GROQ_API_KEY=... pnpm --filter @vox/sidecar eval
 * Without a key the harness reports SKIPPED and exits 0 so CI stays green
 * until a key is configured as a repo secret.
 *
 * System actions are stubbed (no core channel here); MCP servers run for real.
 */
import { AIMessage } from '@langchain/core/messages';

import { buildAgent } from '../src/agent/graph.js';
import { coreBridge } from '../src/core-bridge.js';
import { mcpManager } from '../src/mcp/manager.js';

interface EvalCase {
  id: string;
  utterance: string;
  /** Tool names that must appear among the agent's tool calls. */
  expectTool: RegExp;
  /** Params predicate for the matched call. */
  expectParams?: (params: Record<string, unknown>) => boolean;
  /** True if the case is expected to pause on the confirm gate. */
  expectConfirm?: boolean;
  connectors?: Parameters<typeof mcpManager.rebuild>[0];
}

const GITHUB_PAT = process.env['GITHUB_PAT'];

const CASES: EvalCase[] = [
  // S3 runs only when a PAT is provided (hosted GitHub MCP needs auth).
  ...(GITHUB_PAT
    ? [
        {
          id: 'S3 most-starred github repos',
          utterance: 'Show my most starred GitHub repositories',
          expectTool: /repo|search|star/i,
          connectors: [
            {
              id: 'gh',
              name: 'github',
              transport: 'http' as const,
              url: 'https://api.githubcopilot.com/mcp/',
              enabled: true,
              secret_ref: 'eval_github_pat'
            }
          ]
        }
      ]
    : []),
  {
    id: 'S2 open documents folder',
    utterance: 'Open my Documents folder',
    expectTool: /^open_path$/,
    expectParams: (p) => String(p['path'] ?? '').toLowerCase().includes('documents')
  },
  {
    id: 'S4 create markdown file pauses for confirmation',
    utterance: "Create a markdown file called meeting-notes.md with today's date as the heading",
    expectTool: /^(write_file|create_file)$/,
    expectConfirm: true,
    connectors: [
      {
        id: 'fs',
        name: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
        enabled: true
      }
    ]
  }
];

const provider = (process.env['VOX_EVAL_PROVIDER'] ?? 'groq') as 'groq' | 'ollama';
if (provider === 'groq' && !process.env['GROQ_API_KEY']) {
  console.log('SKIPPED: GROQ_API_KEY not set — eval harness needs a live provider.');
  process.exit(0);
}

// Stub the core channel: system actions succeed without a Rust core,
// and the GitHub PAT (if any) is served from the environment.
coreBridge.attach(() => undefined);
coreBridge.systemAction = async () => ({ ok: true });
coreBridge.getSecret = async (ref: string) =>
  ref === 'eval_github_pat' ? (GITHUB_PAT ?? null) : null;

const settings = {
  hotkey: 'alt+space',
  llm_provider: provider,
  llm_model:
    process.env['VOX_EVAL_MODEL'] ?? (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'qwen3:1.7b'),
  stt_model: 'base.en'
};

let failures = 0;

for (const testCase of CASES) {
  await mcpManager.rebuild(testCase.connectors ?? []);
  const agent = await buildAgent(settings);

  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let confirmed = false;

  try {
    const stream = await agent.stream(
      { messages: [{ role: 'user', content: testCase.utterance }] },
      { configurable: { thread_id: `eval-${testCase.id}` }, streamMode: 'updates' }
    );
    for await (const update of stream as AsyncIterable<Record<string, unknown>>) {
      if ('__interrupt__' in update) {
        confirmed = true;
        const intr = (update['__interrupt__'] as Array<{ value: { tool: string; params: Record<string, unknown> } }>)[0];
        if (intr) toolCalls.push({ name: intr.value.tool, args: intr.value.params });
        break; // don't resume — the gate itself is the assertion
      }
      const agentUpdate = update['agent'] as { messages?: unknown[] } | undefined;
      const last = agentUpdate?.messages?.at(-1);
      if (last instanceof AIMessage) {
        for (const call of last.tool_calls ?? []) {
          toolCalls.push({ name: call.name, args: call.args as Record<string, unknown> });
        }
      }
    }
  } catch (error) {
    console.error(`FAIL ${testCase.id}: agent run threw: ${String(error)}`);
    failures++;
    continue;
  }

  const match = toolCalls.find((c) => testCase.expectTool.test(c.name));
  const paramsOk = !match || !testCase.expectParams || testCase.expectParams(match.args);
  const confirmOk = !testCase.expectConfirm || confirmed;

  if (match && paramsOk && confirmOk) {
    console.log(`PASS ${testCase.id} — ${match.name}(${JSON.stringify(match.args)})${confirmed ? ' [paused for confirm]' : ''}`);
  } else {
    console.error(
      `FAIL ${testCase.id} — calls: ${JSON.stringify(toolCalls)}, confirm: ${confirmed}`
    );
    failures++;
  }
}

await mcpManager.close();
process.exit(failures === 0 ? 0 : 1);
