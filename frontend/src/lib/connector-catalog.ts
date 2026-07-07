/**
 * Curated connector directory (the "click and it connects" catalog).
 *
 * - `oauth` entries authorize in the browser via the sidecar's OAuth 2.1
 *   client (dynamic registration + PKCE); no manual keys.
 * - `token` entries ask for one paste-able credential, stored in the
 *   OS keychain.
 * - `none` entries connect straight away.
 *
 * Remote URLs are the providers' official hosted MCP endpoints.
 */

export type CatalogAuth = 'none' | 'token' | 'oauth';

export interface CatalogEntry {
  key: string;
  name: string;
  description: string;
  auth: CatalogAuth;
  transport: 'stdio' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  /** Label for the token input when auth === 'token'. */
  tokenLabel?: string;
  /** Where to create the credential. */
  tokenHint?: string;
}

export const CONNECTOR_CATALOG: CatalogEntry[] = [
  {
    key: 'filesystem',
    name: 'Filesystem',
    description: 'Read, search, create, and edit files in your home folder',
    auth: 'none',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '~/']
  },
  {
    key: 'github',
    name: 'GitHub',
    description: 'Repos, issues, and pull requests via the official GitHub MCP server',
    auth: 'token',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    tokenLabel: 'GitHub personal access token',
    tokenHint: 'github.com/settings/tokens'
  },
  {
    key: 'notion',
    name: 'Notion',
    description: 'Search, create, and update pages in your Notion workspace',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.notion.com/mcp'
  },
  {
    key: 'linear',
    name: 'Linear',
    description: 'Create and manage Linear issues, projects, and cycles',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.linear.app/mcp'
  },
  {
    key: 'sentry',
    name: 'Sentry',
    description: 'Query errors, issues, and releases from your Sentry projects',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.sentry.dev/mcp'
  },
  {
    key: 'atlassian',
    name: 'Atlassian',
    description: 'Jira issues and Confluence pages in your Atlassian sites',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.atlassian.com/v1/sse'
  },
  {
    key: 'asana',
    name: 'Asana',
    description: 'Manage Asana tasks, projects, and comments',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.asana.com/sse'
  },
  {
    key: 'canva',
    name: 'Canva',
    description: 'Search, create, and export Canva designs',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.canva.com/mcp'
  },
  {
    key: 'figma',
    name: 'Figma',
    description: 'Bring Figma file context into your voice commands',
    auth: 'oauth',
    transport: 'http',
    url: 'https://mcp.figma.com/mcp'
  },
  {
    key: 'stripe',
    name: 'Stripe',
    description: 'Look up customers, payments, and invoices in Stripe',
    auth: 'token',
    transport: 'http',
    url: 'https://mcp.stripe.com',
    tokenLabel: 'Stripe API key',
    tokenHint: 'dashboard.stripe.com/apikeys'
  },
  {
    key: 'huggingface',
    name: 'Hugging Face',
    description: 'Search models, datasets, and papers on the Hub',
    auth: 'token',
    transport: 'http',
    url: 'https://huggingface.co/mcp',
    tokenLabel: 'Hugging Face access token',
    tokenHint: 'huggingface.co/settings/tokens'
  },
  {
    key: 'context7',
    name: 'Context7',
    description: 'Up-to-date documentation for any library, on demand',
    auth: 'none',
    transport: 'http',
    url: 'https://mcp.context7.com/mcp'
  },
  {
    key: 'deepwiki',
    name: 'DeepWiki',
    description: 'Ask questions about any public GitHub repository',
    auth: 'none',
    transport: 'http',
    url: 'https://mcp.deepwiki.com/mcp'
  }
];
