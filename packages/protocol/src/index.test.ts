import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LlmProvider, OAuthPreset, parseInbound, Settings } from './index.js';

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

test('settings accept every provider in the enum', () => {
  for (const provider of LlmProvider.options) {
    const result = Settings.safeParse({
      hotkey: 'alt+space',
      llm_provider: provider,
      llm_model: 'some-model',
      stt_model: 'base.en'
    });
    assert.equal(result.success, true, provider);
  }
});

test('list_models parses for a new provider and rejects unknown ones', () => {
  const ok = parseInbound(
    JSON.stringify({ type: 'list_models', id: 'm1', payload: { provider: 'anthropic' } })
  );
  assert.equal(ok?.type, 'list_models');
  const bad = parseInbound(
    JSON.stringify({ type: 'list_models', id: 'm2', payload: { provider: 'skynet' } })
  );
  assert.equal(bad, null);
});

test('test_llm parses with an empty payload', () => {
  const parsed = parseInbound(JSON.stringify({ type: 'test_llm', id: 't1', payload: {} }));
  assert.equal(parsed?.type, 'test_llm');
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
