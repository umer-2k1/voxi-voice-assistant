/**
 * End-to-end test of the directory OAuth flow with a REAL sidecar:
 * fake OAuth authorization server + fake Rust core over WS.
 * The fake core "opens the browser" by fetching the authorize URL and
 * following the redirect to the sidecar's loopback callback.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

import WebSocket from 'ws';

const TOKEN = 'test-token-oauth';
const SIDECAR_DIR = '/Users/h.benterprise/Documents/Github/voxi-voice-assistant/sidecar';

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// ---------- 1. fake OAuth authorization + resource server ----------
const authServer = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    const origin = `http://127.0.0.1:${(authServer.address() as { port: number }).port}`;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        scopes_supported: ['mcp.read', 'mcp.write']
      })
    );
  } else if (url.pathname === '/register' && request.method === 'POST') {
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ client_id: 'vox-test-client' }));
  } else if (url.pathname === '/authorize') {
    const redirect = new URL(url.searchParams.get('redirect_uri') ?? '');
    if (url.searchParams.get('code_challenge_method') !== 'S256') fail('missing PKCE');
    if (!url.searchParams.get('resource')?.includes('/mcp')) fail('missing resource indicator');
    redirect.searchParams.set('code', 'auth-code-42');
    redirect.searchParams.set('state', url.searchParams.get('state') ?? '');
    response.writeHead(302, { location: redirect.href });
    response.end();
  } else if (url.pathname === '/token' && request.method === 'POST') {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      const params = new URLSearchParams(body);
      if (params.get('code') !== 'auth-code-42') fail('wrong code at token endpoint');
      if (!params.get('code_verifier')) fail('missing code_verifier');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          access_token: 'at-secret-123',
          refresh_token: 'rt-secret-456',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      );
    });
  } else {
    response.writeHead(404).end();
  }
});

await new Promise<void>((resolve) => authServer.listen(0, '127.0.0.1', resolve));
const authPort = (authServer.address() as { port: number }).port;
const mcpServerUrl = `http://127.0.0.1:${authPort}/mcp`;
console.log(`fake auth server on :${authPort}`);

// ---------- 2. real sidecar ----------
const sidecar = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: SIDECAR_DIR,
  env: { ...process.env, VOX_SESSION_TOKEN: TOKEN },
  stdio: ['ignore', 'pipe', 'inherit']
});

const port: number = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('sidecar handshake timeout')), 20_000);
  sidecar.stdout.on('data', (data: Buffer) => {
    try {
      const parsed = JSON.parse(data.toString().trim()) as { port: number };
      clearTimeout(timer);
      resolve(parsed.port);
    } catch {
      /* not the handshake line */
    }
  });
});
console.log(`sidecar on :${port}`);

let storedSecret: { ref: string; value: string } | null = null;

// ---------- 3. fake Rust core ----------
const core = new WebSocket(`ws://127.0.0.1:${port}`);
core.on('open', () => core.send(JSON.stringify({ type: 'auth', payload: { token: TOKEN, role: 'core' } })));
core.on('message', (raw: Buffer) => {
  const message = JSON.parse(raw.toString()) as {
    type: string;
    id?: string;
    payload?: { action?: string; args?: { path?: string }; secret_ref?: string; value?: string };
  };
  if (message.type === 'system_action' && message.payload?.action === 'open_path') {
    const target = message.payload.args?.path ?? '';
    console.log('core: "opening browser" →', target.slice(0, 60), '…');
    // Simulate the user approving in the browser: follow the redirect chain.
    void fetch(target, { redirect: 'follow' }).then(() => {
      core.send(JSON.stringify({ type: 'system_result', id: message.id, payload: { ok: true } }));
    });
  }
  if (message.type === 'store_secret') {
    storedSecret = { ref: message.payload?.secret_ref ?? '', value: message.payload?.value ?? '' };
    core.send(JSON.stringify({ type: 'secret_stored', id: message.id, payload: { ok: true } }));
  }
});

// ---------- 4. fake UI: kick off the flow ----------
await new Promise((r) => setTimeout(r, 500));
const ui = new WebSocket(`ws://127.0.0.1:${port}`);
ui.on('open', () => ui.send(JSON.stringify({ type: 'auth', payload: { token: TOKEN, role: 'ui' } })));
ui.on('message', (raw: Buffer) => {
  const message = JSON.parse(raw.toString()) as {
    type: string;
    payload?: { ok?: boolean; error?: string };
  };
  if (message.type === 'auth_ok') {
    ui.send(
      JSON.stringify({
        type: 'oauth_start',
        id: 'flow-1',
        payload: { server_url: mcpServerUrl, secret_ref: 'connector_test-oauth', name: 'TestSvc' }
      })
    );
  }
  if (message.type === 'oauth_result') {
    if (!message.payload?.ok) fail(`oauth_result not ok: ${message.payload?.error ?? '?'}`);
    if (!storedSecret) fail('no secret was stored before oauth_result');
    if (storedSecret.ref !== 'connector_test-oauth') fail(`wrong secret_ref: ${storedSecret.ref}`);
    const tokens = JSON.parse(storedSecret.value) as Record<string, unknown>;
    if (tokens['access_token'] !== 'at-secret-123') fail('access token mismatch');
    if (tokens['refresh_token'] !== 'rt-secret-456') fail('refresh token mismatch');
    if (typeof tokens['expires_at'] !== 'number') fail('expires_at missing');
    if (typeof tokens['token_endpoint'] !== 'string') fail('token_endpoint missing');
    console.log('stored token set keys:', Object.keys(tokens).join(', '));
    console.log('OAUTH E2E: PASS');
    sidecar.kill();
    process.exit(0);
  }
});

setTimeout(() => {
  sidecar.kill();
  fail('test timed out after 30s');
}, 30_000);
