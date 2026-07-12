# Progress Log

Session-by-session record of what was implemented. Newest first.

## Session 3 — 2026-07-12: distribution blocker closed, ops floor, conversation UX

- **Sidecar ships**: esbuild single-file bundle (3.1 MB) as a Tauri resource, launched by system Node ≥20 in packaged builds with Node discovery + actionable errors; verified in a debug `.app`. All PENDING open questions resolved (Node over Bun; whisper.cpp built-in VAD; npx filesystem MCP).
- **Ops floor**: rotating file logs (tauri-plugin-log) incl. sidecar stderr, panic hook, restart-agent (tray + sidebar) past the 5-respawn dead end, "Open logs folder" tray item.
- **Conversation UX**: token streaming (`assistant_delta`), new-conversation reset, opt-in transcript persistence (Privacy toggle, default off).
- **Planner**: no fallback to non-tool-capable Ollama models; few-shot examples in the system prompt.
- **Ambient context v1**: frontmost app annotates each utterance (`context_snapshot` system action) — "this app" references resolve.
- **Cleanup/CI**: template leftovers gone; CI gains all-package lint, protocol tests, Playwright smoke.
- Six commits pushed incrementally to `feat/google-workspace-connectors`. Skipped by user decision: signing/notarization/auto-update/telemetry (point 7).

## Session 2 — 2026-07-11: Google connectors, full permissions onboarding, hardening

## Session 2 — 2026-07-11: Google connectors, full permissions onboarding, hardening

- **Google Workspace connectors** — Gmail/Drive/Calendar/Chat via Google's official hosted MCP servers. New OAuth *preset* flow (no DCR): user pastes a one-time GCP OAuth client, sidecar runs PKCE against Google, one consent covers all four via a shared `google_oauth` token set. Reconnect reuses stored client creds; `remove_server` refcounts shared secrets. Protocol `oauth_start.preset` (+ first protocol unit tests, `tsx --test`).
- **Connectors page polish** — passive status probe, status pill, tool-count badge, Reconnect with creds fallback, shared `ClientCredsForm`.
- **Permissions onboarding (production)** — real mic TCC state via AVFoundation, `request_microphone` (fires prompt via brief capture), `request_accessibility` (AX consent prompt), notifications via tauri-plugin-notification with real product use (approval/question notifications while unfocused). Shared `PermissionList` powers the wizard step and a new Settings → Permissions section; every row explains why + when.
- **UI polish** — sidebar icons, live hotkey hint in the transcript empty state, STT radio accent, overlay effect lint fix; workspace is fully lint-clean.
- **Hardening** — strict production CSP re-introduced (PENDING item closed); Playwright fixed (onboarding gate, reuse dev server) — 7/7 chromium, protocol 4/4, cargo build green.
- **Shipped as** three commits on `feat/google-workspace-connectors` (direct main-push blocked in this environment).

## Session 1 (continued) — 2026-07-06/07: M0 done, M1–M4 built

- **M0 complete** — all four risk gates executed and recorded in docs/context/decisions.md. Key findings: Bun and Node both run MCP stdio + ws (14 tools listed); whisper `small` is 25s on this Intel Mac (fails budget) but `base.en` is 1.04s (passes) — dev machine pinned to base.en; Node 22 required (21 breaks rolldown); Metal hangs on Intel → CPU whisper on x86_64.
- **M1** — hotkey press/release → cpal capture → 16kHz resample; tray menu; overlay pill with pulse/equalizer. App smoke-launched successfully.
- **M2** — whisper-rs STT with warm context, whisper.cpp built-in Silero VAD, resumable model download with progress banner.
- **M3** — sidecar with token-auth WS (exit test PASS: bad token rejected, silent connect dropped, echo round-trip); Rust spawn/handshake/respawn; privileged core channel live (config push observed in-app); sidebar + transcript UI.
- **M4** — LangGraph agent (createReactAgent + MemorySaver), Groq/Ollama provider abstraction, open_path/insert_text built-ins over the core channel, MCP manager, keychain secrets, confirm-gate wrapper (default-deny), eval harness + CI step.
- **M5–M8 surfaces** — connectors tab (CRUD + verbatim-command review + test/tool-list + GitHub preset), confirm card in overlay, settings view (hotkey recorder, provider toggle, STT select, Groq key paste), macOS permissions banner; Playwright smoke tests replace boilerplate demos.
- **Live agent validation (Ollama qwen3:1.7b, local):** S2 plumbing PASS (open_path round-trip); S4/S6/S8 deny PASS (every write-ish call individually gated, deny cancels clean, sandbox untouched); S4 approve PASS (file created after explicit approval). Found + fixed: LangGraph rejects `Command({resume: false})` — resume payload is now `{approved}`.
- **Blocked on user:** Groq API key (cloud-mode S2/S3 + evals in CI), GitHub PAT (S3), interactive checks (hold ⌥Space unfocused, mic + Accessibility grants, S5 dictation into an editor, S1 stopwatch).


## Session 1 — 2026-07-06

**Scope:** Planning + M0 foundation.

- Reviewed PRD v1.1 (prototype scope M1–M8, S1–S8) and Vox Design System "Halcyon Light v1.0"; extracted all 119 design tokens to `docs/context/design-tokens.txt`.
- Wrote and got approval for [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
- Created documentation skeleton (root tracking docs + `docs/` structure per AGENTS.md).
- Installed toolchain: pnpm 10.5.0; Rust stable via rustup.
- (in progress) Workspace restructure, Tauri scaffold, design tokens, CI, risk gates.
