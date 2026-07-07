import type { StructuredToolInterface } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { ConnectorConfig } from '@vox/protocol';

import { resolveBearerToken } from '../oauth.js';

/**
 * Manages MCP clients for the enabled connectors. Rebuilt whenever the
 * core pushes `config_updated`. Remote connectors with a `secret_ref`
 * get their token resolved through the core channel at build time.
 */
export class McpManager {
  private client: MultiServerMCPClient | null = null;
  private tools: StructuredToolInterface[] = [];

  async rebuild(connectors: ConnectorConfig[]): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => undefined);
      this.client = null;
      this.tools = [];
    }

    const enabled = connectors.filter((c) => c.enabled);
    if (enabled.length === 0) return;

    type ServerConfigs = ConstructorParameters<typeof MultiServerMCPClient>[0]['mcpServers'];
    const mcpServers: ServerConfigs = {};
    for (const connector of enabled) {
      if (connector.transport === 'stdio' && connector.command) {
        mcpServers[connector.name] = {
          transport: 'stdio',
          command: connector.command,
          args: connector.args ?? []
        };
      } else if (connector.transport === 'http' && connector.url) {
        const headers: Record<string, string> = {};
        if (connector.secret_ref) {
          // Plain PAT/API key, or an OAuth token set (refreshed when stale).
          const token = await resolveBearerToken(connector.secret_ref).catch(() => null);
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
        mcpServers[connector.name] = { transport: 'http', url: connector.url, headers };
      }
    }
    if (Object.keys(mcpServers).length === 0) return;

    this.client = new MultiServerMCPClient({ mcpServers });
    this.tools = await this.client.getTools();
    console.error(`mcp: ${this.tools.length} tool(s) from ${Object.keys(mcpServers).join(', ')}`);
  }

  getTools(): StructuredToolInterface[] {
    return this.tools;
  }

  /** Connection test for the Connectors tab (M5). */
  async listToolsFor(connector: ConnectorConfig): Promise<string[]> {
    const single = new McpManager();
    try {
      await single.rebuild([{ ...connector, enabled: true }]);
      return single.getTools().map((t) => t.name);
    } finally {
      await single.close();
    }
  }

  async close(): Promise<void> {
    if (this.client) await this.client.close().catch(() => undefined);
    this.client = null;
    this.tools = [];
  }
}

export const mcpManager = new McpManager();
