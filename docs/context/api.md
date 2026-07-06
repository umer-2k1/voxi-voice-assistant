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
| `assistant_message` | sidecar → ui | `{text}` |
| `tool_running` | sidecar → ui | `{tool, connector}` |
| `confirm_request` | sidecar → ui | `{id, tool, connector, params}` |
| `need_input` | sidecar → ui | `{question}` |
| `error` | sidecar → ui | `{message, recoverable}` |
| `done` | sidecar → ui | `{thread_id}` |

**Core role (privileged):**
| Message | Direction | Payload |
|---|---|---|
| `get_secret` | sidecar → core | `{secret_ref}` |
| `secret_value` | core → sidecar | `{secret_ref, value}` |
| `system_action` | sidecar → core | `{action: "open_path" \| "insert_text", args}` |
| `system_result` | core → sidecar | `{ok, detail?}` |
| `config_updated` | core → sidecar | `{connectors, settings}` — pushed at spawn and on change |

## 2. Control channel — Tauri IPC commands (webview → Rust)

- Connectors: `list_connectors`, `add_server`, `remove_server`, `test_connection`, `list_tools` (last two proxy to sidecar)
- Settings: `get_settings`, `update_settings`
- Secrets: `store_secret`, `delete_secret` — **no `get_secret` exposed to webview**
- System: `open_path`, `insert_text`
- Permissions (macOS): `check_permissions`, `open_system_settings`
- Sidecar: `get_sidecar_info` → `{port, token}`
- STT: `download_stt_model`

**Events (Rust → webview):** `mic-state` (`idle|listening|thinking`), `transcription`, `model-download-progress`, `sidecar-status`.
