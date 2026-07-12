# Internal API

No public API (PRD §8). Two internal channels.

## 1. Agent channel — WebSocket (webview ↔ sidecar ↔ core)

Sidecar binds `127.0.0.1:0`, prints `{"port": N}` on stdout. All messages are JSON `{type, id?, payload}` validated by zod schemas in `packages/protocol`.

**Auth (first frame, mandatory):**
| Message | Direction | Payload |
|---|---|---|
| `auth` | client → sidecar | `{token, role: "ui" \| "core"}` — invalid → socket closed |

**UI role:**
| Message | Direction | Payload |
|---|---|---|
| `user_utterance` | ui → sidecar | `{text, thread_id}` |
| `confirm_response` | ui → sidecar | `{id, approved}` |
| `resume` | ui → sidecar | `{thread_id, text}` |
| `assistant_message` | sidecar → ui | `{text}` — authoritative full reply |
| `assistant_delta` | sidecar → ui | `{text}` — token chunk while generating; replaced by the final `assistant_message` |
| `tool_running` | sidecar → ui | `{tool, connector}` |
| `confirm_request` | sidecar → ui | `{id, tool, connector, params}` |
| `need_input` | sidecar → ui | `{question}` |
| `error` | sidecar → ui | `{message, recoverable}` |
| `done` | sidecar → ui | `{thread_id}` |
| `test_connector` | ui → sidecar | `{...connector}` — probe a server, list its tools |
| `connector_test_result` | sidecar → ui | `{ok, tools, error?}` |
| `oauth_start` | ui → sidecar | `{server_url, secret_ref, name, preset?}` — `preset` (`{client_id?, client_secret?, authorization_endpoint, token_endpoint, scopes, extra_auth_params?}`) skips discovery + dynamic registration for providers without it (Google); omitted `client_id` on re-auth reuses the stored client |
| `oauth_result` | sidecar → ui | `{ok, error?}` — token set is already in the keychain when `ok` |
| `list_models` | ui → sidecar | `{provider}` — fetch the provider's live model catalog (Settings → Reasoning); the sidecar reads the key from the keychain, the webview never sees it |
| `models_list` | sidecar → ui | `{ok, models, error?}` |
| `test_llm` | ui → sidecar | `{}` — one-token smoke test of the saved provider + model + key |
| `llm_test_result` | sidecar → ui | `{ok, provider, model, latency_ms?, error?}` |

**Core role (privileged):**
| Message | Direction | Payload |
|---|---|---|
| `get_secret` | sidecar → core | `{secret_ref}` |
| `secret_value` | core → sidecar | `{secret_ref, value}` |
| `system_action` | sidecar → core | `{action: "open_path" \| "insert_text" \| "context_snapshot", args}` — `context_snapshot` returns the frontmost app JSON in `system_result.detail` (planner ambient context) |
| `system_result` | core → sidecar | `{ok, detail?}` |
| `config_updated` | core → sidecar | `{connectors, settings}` — pushed at spawn and on change |

## 2. Control channel — Tauri IPC commands (webview → Rust)

- Connectors: `list_connectors`, `add_server`, `remove_server`, `set_connector_enabled` (removing a server deletes its secret only when no other connector shares the same `secret_ref`)
- Settings: `get_settings`, `update_settings`
- Secrets: `store_secret`, `delete_secret`, `has_secret` — **no `get_secret` exposed to webview**
- System: `open_path`, `insert_text`
- Permissions (macOS): `check_permissions` (mic TCC state + Accessibility), `request_microphone` (fires the TCC prompt via a brief capture), `request_accessibility` (AX consent prompt), `open_system_settings` (accessibility | microphone | notifications). Notification permission/sending goes through `tauri-plugin-notification` from the webview.
- Sidecar: `get_sidecar_info` → `{port, token}`
- STT: `download_stt_model`

**Events (Rust → webview):** `mic-state` (`idle|listening|thinking`), `transcription`, `model-download-progress`, `sidecar-status`.
