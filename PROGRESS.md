# Progress Log

Session-by-session record of what was implemented. Newest first.

## Session 1 (continued) — 2026-07-06/07: M0 done, M1–M4 built

- **M0 complete** — all four risk gates executed and recorded in docs/context/decisions.md. Key findings: Bun and Node both run MCP stdio + ws (14 tools listed); whisper `small` is 25s on this Intel Mac (fails budget) but `base.en` is 1.04s (passes) — dev machine pinned to base.en; Node 22 required (21 breaks rolldown); Metal hangs on Intel → CPU whisper on x86_64.
- **M1** — hotkey press/release → cpal capture → 16kHz resample; tray menu; overlay pill with pulse/equalizer. App smoke-launched successfully.
- **M2** — whisper-rs STT with warm context, whisper.cpp built-in Silero VAD, resumable model download with progress banner.
- **M3** — sidecar with token-auth WS (exit test PASS: bad token rejected, silent connect dropped, echo round-trip); Rust spawn/handshake/respawn; privileged core channel live (config push observed in-app); sidebar + transcript UI.
- **M4** — LangGraph agent (createReactAgent + MemorySaver), Groq/Ollama provider abstraction, open_path/insert_text built-ins over the core channel, MCP manager, keychain secrets, confirm-gate wrapper (default-deny), eval harness + CI step.
- **Blocked on user:** Groq API key (S2 live), interactive hotkey/mic/permission checks.


## Session 1 — 2026-07-06

**Scope:** Planning + M0 foundation.

- Reviewed PRD v1.1 (prototype scope M1–M8, S1–S8) and Vox Design System "Halcyon Light v1.0"; extracted all 119 design tokens to `docs/context/design-tokens.txt`.
- Wrote and got approval for [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
- Created documentation skeleton (root tracking docs + `docs/` structure per AGENTS.md).
- Installed toolchain: pnpm 10.5.0; Rust stable via rustup.
- (in progress) Workspace restructure, Tauri scaffold, design tokens, CI, risk gates.
