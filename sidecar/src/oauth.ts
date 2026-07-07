import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';

import { coreBridge } from './core-bridge.js';

/**
 * OAuth 2.1 client for remote MCP servers (directory click-to-connect).
 *
 * Flow (MCP authorization spec): discover the authorization server via
 * RFC 9728 protected-resource metadata, dynamically register a client
 * (RFC 7591), send the user to the browser with PKCE, catch the redirect
 * on a 127.0.0.1 loopback server, exchange the code, and persist the
 * token set in the OS keychain through the core channel. The webview
 * never sees a token.
 */

const FLOW_TIMEOUT_MS = 5 * 60 * 1000;

interface AuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
}

/** What gets stored in the keychain (JSON) for an OAuth connector. */
export interface OAuthTokenSet {
  access_token: string;
  refresh_token?: string;
  /** epoch ms; absent = does not expire as far as we know */
  expires_at?: number;
  token_endpoint: string;
  client_id: string;
  client_secret?: string;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function fetchJson(url: string | URL): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Find the authorization server + its endpoints for an MCP server URL. */
async function discover(serverUrl: string): Promise<AuthServerMetadata> {
  const server = new URL(serverUrl);

  // RFC 9728: the resource says who its authorization server is.
  let authServer = server.origin;
  const resourceMeta =
    (await fetchJson(
      new URL(`/.well-known/oauth-protected-resource${server.pathname}`, server.origin)
    )) ?? (await fetchJson(new URL('/.well-known/oauth-protected-resource', server.origin)));
  const advertised = resourceMeta?.['authorization_servers'];
  if (Array.isArray(advertised) && typeof advertised[0] === 'string') {
    authServer = advertised[0];
  }

  // RFC 8414 / OIDC discovery on the authorization server.
  for (const wellKnown of [
    '/.well-known/oauth-authorization-server',
    '/.well-known/openid-configuration'
  ]) {
    const meta = await fetchJson(new URL(wellKnown, authServer));
    if (meta?.['authorization_endpoint'] && meta['token_endpoint']) {
      return meta as unknown as AuthServerMetadata;
    }
  }

  // Last resort: the MCP spec's default endpoint locations.
  return {
    authorization_endpoint: new URL('/authorize', authServer).href,
    token_endpoint: new URL('/token', authServer).href,
    registration_endpoint: new URL('/register', authServer).href
  };
}

/** RFC 7591 dynamic client registration. Falls back to a public client id. */
async function registerClient(
  metadata: AuthServerMetadata,
  redirectUri: string
): Promise<{ clientId: string; clientSecret?: string }> {
  if (!metadata.registration_endpoint) {
    throw new Error('This server does not support automatic client registration.');
  }
  const response = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Vox',
      client_uri: 'https://github.com/umer-2k1/voxi-voice-assistant',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    })
  });
  if (!response.ok) {
    throw new Error(`Client registration failed (${response.status}).`);
  }
  const registered = (await response.json()) as { client_id: string; client_secret?: string };
  return { clientId: registered.client_id, clientSecret: registered.client_secret };
}

/** Wait for exactly one authorization redirect on a loopback server. */
function waitForCallback(
  server: http.Server,
  expectedState: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Authorization timed out — the browser window was not completed.'));
    }, FLOW_TIMEOUT_MS);

    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        response.writeHead(404).end();
        return;
      }
      const errorParam = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        '<html><body style="font-family: sans-serif; display: grid; place-items: center; height: 90vh;">' +
          '<p>Vox is connected. You can close this tab and return to the app.</p></body></html>'
      );

      clearTimeout(timer);
      if (errorParam) {
        reject(new Error(`Authorization was refused: ${errorParam}`));
      } else if (!code || state !== expectedState) {
        reject(new Error('Authorization response was invalid.'));
      } else {
        resolve(code);
      }
    });
  });
}

/**
 * Run the full authorization flow for `serverUrl` and store the tokens
 * under `secretRef`. Resolves when the keychain write is confirmed.
 */
export async function runOAuthFlow(serverUrl: string, secretRef: string): Promise<void> {
  const metadata = await discover(serverUrl);

  const server = http.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('could not bind the OAuth callback port');
    }
    const redirectUri = `http://127.0.0.1:${address.port}/callback`;

    const { clientId, clientSecret } = await registerClient(metadata, redirectUri);

    const verifier = base64url(randomBytes(48));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const state = base64url(randomBytes(24));

    const authorizeUrl = new URL(metadata.authorization_endpoint);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('resource', serverUrl);
    if (metadata.scopes_supported?.length) {
      authorizeUrl.searchParams.set('scope', metadata.scopes_supported.join(' '));
    }

    const callback = waitForCallback(server, state);
    const opened = await coreBridge.systemAction('open_path', { path: authorizeUrl.href });
    if (!opened.ok) {
      throw new Error(opened.detail ?? 'could not open the browser');
    }
    const code = await callback;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
      resource: serverUrl
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    const tokenResponse = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed (${tokenResponse.status}).`);
    }
    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokens.access_token) {
      throw new Error('The server did not return an access token.');
    }

    const stored: OAuthTokenSet = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
      token_endpoint: metadata.token_endpoint,
      client_id: clientId,
      client_secret: clientSecret
    };
    await coreBridge.storeSecret(secretRef, JSON.stringify(stored));
  } finally {
    server.close();
  }
}

/**
 * Resolve the Bearer value for a connector secret. Plain strings (PATs,
 * API keys) pass through; OAuth token sets are refreshed when expired
 * and the refreshed set is written back to the keychain.
 */
export async function resolveBearerToken(secretRef: string): Promise<string | null> {
  const raw = await coreBridge.getSecret(secretRef).catch(() => null);
  if (!raw) return null;
  if (!raw.trimStart().startsWith('{')) return raw;

  let tokens: OAuthTokenSet;
  try {
    tokens = JSON.parse(raw) as OAuthTokenSet;
  } catch {
    return raw;
  }
  if (!tokens.access_token) return raw;

  const needsRefresh =
    tokens.expires_at !== undefined && Date.now() > tokens.expires_at - 60_000;
  if (!needsRefresh || !tokens.refresh_token) return tokens.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: tokens.client_id
  });
  if (tokens.client_secret) body.set('client_secret', tokens.client_secret);
  const response = await fetch(tokens.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  }).catch(() => null);
  if (!response?.ok) {
    console.error(`oauth: refresh for ${secretRef} failed; using the stale token`);
    return tokens.access_token;
  }
  const refreshed = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  tokens.access_token = refreshed.access_token;
  if (refreshed.refresh_token) tokens.refresh_token = refreshed.refresh_token;
  tokens.expires_at = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : undefined;
  await coreBridge.storeSecret(secretRef, JSON.stringify(tokens)).catch(() => undefined);
  return tokens.access_token;
}
