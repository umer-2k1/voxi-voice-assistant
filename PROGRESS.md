# Progress Log

Session-by-session record of what was implemented. Newest first.

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
