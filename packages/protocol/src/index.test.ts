import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OAuthPreset, parseInbound } from './index.js';

const frame = (payload: Record<string, unknown>): string =>
  JSON.stringify({ type: 'oauth_start', id: 'abc', payload });

test('oauth_start parses without a preset (backward compatible)', () => {
  const parsed = parseInbound(
    frame({ server_url: 'https://mcp.notion.com/mcp', secret_ref: 'connector_x', name: 'Notion' })
  );
  assert.equal(parsed?.type, 'oauth_start');
  assert.equal(
    parsed?.type === 'oauth_start' ? parsed.payload.preset : 'missing',
    undefined
  );
});

test('oauth_start parses with a full preset', () => {
  const parsed = parseInbound(
    frame({
      server_url: 'https://gmailmcp.googleapis.com/mcp/v1',
      secret_ref: 'google_oauth',
      name: 'Gmail',
      preset: {
        client_id: 'id.apps.googleusercontent.com',
        client_secret: 'shhh',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        extra_auth_params: { access_type: 'offline', prompt: 'consent' }
      }
    })
  );
  assert.equal(parsed?.type, 'oauth_start');
  const preset = parsed?.type === 'oauth_start' ? parsed.payload.preset : undefined;
  assert.equal(preset?.token_endpoint, 'https://oauth2.googleapis.com/token');
  assert.deepEqual(preset?.extra_auth_params, { access_type: 'offline', prompt: 'consent' });
});

test('preset client_id is optional (re-auth reuses stored credentials)', () => {
  const result = OAuthPreset.safeParse({
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    scopes: []
  });
  assert.equal(result.success, true);
});

test('preset without token_endpoint is rejected', () => {
  const parsed = parseInbound(
    frame({
      server_url: 'https://gmailmcp.googleapis.com/mcp/v1',
      secret_ref: 'google_oauth',
      name: 'Gmail',
      preset: {
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: []
      }
    })
  );
  assert.equal(parsed, null);
});
