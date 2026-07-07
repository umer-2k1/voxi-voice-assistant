# How Vox Works

A walkthrough of what actually happens between "hold the hotkey" and "the thing is done" — the processes, the messages, and the security model. Companion to [SETUP.md](SETUP.md) and the deeper reference docs in [docs/context/](context/).

---

## The three processes

Vox is one app made of three isolated processes, each doing only what it must:

```
┌──────────────────────────  your machine  ─────────────────────────┐
│                                                                    │
│  React webview (frontend/)          Rust core (src-tauri/)         │
│  UI only: transcript, overlay,      OS powers: global hotkey, mic, │
│  connectors, settings.              whisper STT, keychain, typing, │
│  Never touches OS APIs or           tray/windows. Spawns and       │
│  secret *values*.                   supervises the sidecar.        │
│        │                                   │                       │
│        │   ws://127.0.0.1:<port>  +  session token                 │
│        └───────────────┬───────────────────┘                       │
│                        ▼                                           │
│           Agent sidecar (sidecar/, TypeScript)                     │
│           LangGraph agent loop + MCP clients.                      │
│           Talks to Groq or Ollama. Never renders UI.               │
│                        │                                           │
│              MCP servers (filesystem via stdio,                    │
│              GitHub via HTTPS, anything you add)                   │
└────────────────────────────────────────────────────────────────────┘
```

Why the split (see [context/decisions.md](context/decisions.md) for full rationale):
- A webview can't capture the mic while unfocused, register global hotkeys, or type into other apps — that's Rust's job.
- A webview also can't spawn stdio processes or hold credentials safely — so the agent and its MCP clients live in a separate sidecar process.

## Life of a voice command

What happens when you hold ⌥Space and say *"Create a markdown file called meeting-notes"*:

1. **Hotkey press** (Rust) — `tauri-plugin-global-shortcut` fires a *Pressed* event even though another app has focus. The core starts a cpal microphone stream into an in-memory buffer and tells the overlay to show the listening pulse.
2. **Capture** — audio accumulates at the device's native sample rate while you hold the key. Nothing is written to disk, ever.
3. **Release → transcribe** (Rust) — the buffer is downmixed and resampled to 16 kHz mono, whisper.cpp's built-in Silero VAD trims leading/trailing silence, and `whisper_full` produces text (model kept warm in memory after the first run). Empty or garbage audio short-circuits to a "didn't catch that" notice.
4. **Utterance → agent** — the transcription is emitted to the webview, which logs it in the transcript and forwards it to the sidecar over the WebSocket as `user_utterance`.
5. **Plan** (sidecar) — a LangGraph ReAct agent, backed by Groq or Ollama (one config value — same code path), decides what to do with the tools it has: every tool from your enabled MCP connectors, plus two built-ins — `open_path` and `insert_text`.
6. **The confirm gate** — before any *side-effecting* tool executes, the graph pauses on a LangGraph interrupt. Classification is **default-deny**: a tool skips the gate only if it matches a read-only allowlist (`read_*`, `list_*`, `search_*`, `get_*`, …). `write_file` doesn't, so the overlay shows a caution card with the **exact tool name and parameters**.
7. **You decide** — *Confirm & run* resumes the graph and the tool executes; *Deny* injects "the user declined" into the conversation and the agent moves on cleanly — no retry, no crash, no file.
8. **Act & deliver** — tool results flow back into the agent loop until it produces a final message, rendered in the transcript ("Done — created meeting-notes.md"). If the intent was dictation, the built-in `insert_text` tool asks the Rust core to type the text at your cursor via enigo.
9. **Clarify (when needed)** — if the agent needs input, its question appears in the transcript; press the hotkey and answer. The conversation is checkpointed per session thread, so it resumes where it paused.

## The message plumbing

All three processes meet on one WebSocket server owned by the sidecar, bound to `127.0.0.1` on an OS-assigned port. Two client roles (schemas live in [`packages/protocol`](../packages/protocol/src/index.ts)):

**`ui` role (webview windows):**
- in: `user_utterance`, `confirm_response {id, approved}`, `resume`, `test_connector`
- out: `assistant_message`, `tool_running`, `confirm_request {tool, params}`, `need_input`, `error`, `done`, `connector_test_result`

**`core` role (Rust, privileged):**
- `config_updated` — Rust pushes connectors + settings at spawn and on every change; the sidecar rebuilds its MCP clients and provider from it
- `get_secret {secret_ref}` → `secret_value` — the only path secrets travel (see below)
- `system_action {open_path | insert_text}` → `system_result` — how agent tools reach the OS

Separately, the webview calls Rust directly via Tauri IPC commands for everything config-shaped: `get_settings`/`update_settings`, connector CRUD, `store_secret`/`delete_secret`, `check_permissions`, `download_stt_model`, `get_sidecar_info`.

## Security model

1. **Confirm-before-acting is the primary control.** LLMs can be manipulated by content they read (files, tool results, web pages). Vox does not claim injection immunity — instead, *no chain from untrusted content to a side effect can complete without you approving the exact call*. Tool results are additionally framed as data in the prompt, as defense-in-depth.
2. **Token-authenticated localhost socket.** Any local process could try to connect to the sidecar's port. At startup the Rust core generates a random 32-byte session token, hands it to the sidecar via environment and to the webview via IPC on request. The first WebSocket frame must be a valid `auth` or the socket is dropped (unauthenticated sockets are also killed after 3s).
3. **Secrets never touch config or the webview.** API keys and PATs go into the OS keychain (service `vox`) under a generated reference like `connector_github-xyz`; config files store only the reference. The read path is exclusively sidecar → core channel → keychain, and values are never logged.
4. **stdio servers never auto-start.** Adding a connector shows the exact command line verbatim, and it stays disabled until you explicitly enable it.
5. **Audio is ephemeral** — buffered in memory, transcribed on-device, discarded. Nothing leaves your machine in local mode; in cloud mode only the *text* of your command goes to Groq.

Accepted prototype risks (unsigned builds, in-memory-only transcripts, unsandboxed MCP processes) are listed in [PENDING.md](../PENDING.md).

## Where things live on disk

| What | Where (macOS; Windows equivalent under `%APPDATA%`) |
|---|---|
| Settings | `~/Library/Application Support/dev.vox.app/settings.json` |
| Connectors | `~/Library/Application Support/dev.vox.app/connectors.json` |
| STT models | `~/Library/Application Support/dev.vox.app/models/` |
| Secrets | OS keychain, service `vox` — **not** on disk |
| Transcript | nowhere — in-memory for the session only |

## Reading further

- [context/architecture.md](context/architecture.md) — diagram + component reference
- [context/api.md](context/api.md) — full message and command tables
- [context/decisions.md](context/decisions.md) — why each choice was made, incl. week-1 gate measurements
- [context/ui-design.md](context/ui-design.md) — the Halcyon design system rules the UI follows
- [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) — the milestone roadmap this was built against
