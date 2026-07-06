/**
 * Week-1 risk gate A: can the chosen runtime (Bun vs Node) run our two
 * native-adjacent workloads — a `ws` WebSocket server and stdio MCP
 * server spawning via @langchain/mcp-adapters?
 *
 * Run:  bun run spikes/gate-a-runtime.ts
 *       npx tsx spikes/gate-a-runtime.ts
 */
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { WebSocket, WebSocketServer } from 'ws';

const results: Record<string, string> = {};

// --- 1. ws server round-trip on 127.0.0.1 ---
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('ws timeout')), 10_000);
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 }, () => {
    const addr = wss.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    wss.on('connection', (socket) => {
      socket.on('message', (data) => socket.send(`echo:${data.toString()}`));
    });
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    client.on('open', () => client.send('hello'));
    client.on('message', (data) => {
      results['ws'] = data.toString() === 'echo:hello' ? 'PASS' : `FAIL: ${data.toString()}`;
      clearTimeout(timer);
      client.close();
      wss.close();
      resolve();
    });
    client.on('error', reject);
  });
});

// --- 2. stdio MCP spawn + tool listing ---
const client = new MultiServerMCPClient({
  mcpServers: {
    filesystem: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
    }
  }
});

try {
  const tools = await client.getTools();
  results['mcp_stdio'] = tools.length > 0 ? `PASS (${tools.length} tools)` : 'FAIL: 0 tools';
} catch (error) {
  results['mcp_stdio'] = `FAIL: ${String(error)}`;
} finally {
  await client.close();
}

console.log(JSON.stringify({ runtime: process.versions.bun ? 'bun' : 'node', ...results }));
process.exit(results['ws'] === 'PASS' && results['mcp_stdio']?.startsWith('PASS') ? 0 : 1);
