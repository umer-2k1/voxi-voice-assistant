# Google Workspace connectors

## Overview
Gmail, Google Drive, Google Calendar, and Google Chat appear in Connectors → Browse directory, backed by Google's official hosted MCP servers (`gmailmcp/drivemcp/calendarmcp/chatmcp.googleapis.com/mcp/v1`). Google does not support OAuth dynamic client registration, so these use the **OAuth preset** flow: fixed endpoints, explicit scopes, and a user-created OAuth client.

## One-time user setup
1. In Google Cloud Console: create/select a project, enable the Gmail/Drive/Calendar/Chat MCP APIs, create an OAuth client of type **Desktop app** (loopback redirects allowed), and add yourself as a test user (or publish the app — testing-mode refresh tokens expire after 7 days).
2. In Vox: Connectors → Browse directory → any Google card → paste client ID + secret → browser consent (one consent covers the scope union for all Google services).

## Flow
- `DirectoryCard` (auth `oauth-preset`) → `has_secret(google_oauth)`? → skip consent, or collect client creds → `startOAuth(url, 'google_oauth', name, preset)` over the sidecar WS.
- Sidecar `runOAuthFlow` with a preset skips RFC 9728 discovery and RFC 7591 registration, runs PKCE against `accounts.google.com`, appends `access_type=offline&prompt=consent`, omits the RFC 8707 `resource` param, exchanges the code at `oauth2.googleapis.com/token`, and stores the token set (including client credentials) in the OS keychain via the core channel.
- All Google connectors carry `secret_ref: "google_oauth"`; `resolveBearerToken` refreshes on expiry unchanged. `remove_server` deletes the shared secret only when the last Google connector is removed.
- Reconnect (row action) re-runs the flow; the sidecar reuses the stored client ID/secret, and the UI falls back to a credentials form when the keychain has none ("client credentials required").

## APIs
- Protocol: `oauth_start.payload.preset` (`client_id?`, `client_secret?`, `authorization_endpoint`, `token_endpoint`, `scopes`, `extra_auth_params?`) — optional, backward compatible.
- Catalog: `CatalogEntry.provider/sharedSecretRef/oauthPreset`, `GOOGLE_SECRET_REF`, `GOOGLE_SCOPES`.

## Failure modes
- Consent succeeded but a service 403s (`accessNotConfigured`): that MCP API is not enabled in the user's GCP project — the per-connector Test surfaces it.
- Unverified-app screen / weekly re-consent: publish the OAuth app or stay a test user knowingly.

## Future improvements
- Map Google error strings to actionable text in the test banner.
- Add Docs/Sheets when Google ships their MCP servers; add `chat.messages.create` scope if send-message is wanted.
