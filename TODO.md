# TODO

Upcoming work, in priority order. Mirrors `docs/tasks/todo.md`.

## M0 — Foundation (in progress)
- [x] Install Rust toolchain (rustup) and pnpm
- [ ] Docs skeleton + tracking docs
- [ ] Move pnpm workspace to repo root (workspace: frontend, sidecar, packages/*)
- [ ] Tauri 2 scaffold in `src-tauri/` (main + overlay windows, tray, plugins: global-shortcut, store, opener)
- [ ] Halcyon design tokens + fonts into `frontend/src/styles/global.css`; strip demo UI
- [ ] CI workflow (macOS + Windows), Apache-2.0 LICENSE, CONTRIBUTING.md, issue templates
- [ ] Risk gate A: Bun vs Node (MCP stdio spawn + ws server under Bun)
- [ ] Risk gate B: enigo typing sanity (macOS)
- [ ] Risk gate C: global-shortcut key-release while unfocused
- [ ] Risk gate D: whisper-rs `small` latency on this machine
- [ ] Push M0 to GitHub

## M1 — Shell + hotkey + mic capture
- [ ] hotkey.rs (press/release from settings), tray.rs, overlay window
- [ ] cpal capture → 16kHz mono ring buffer while hotkey held
- [ ] mic-state events → overlay pill (idle/listening)

## M2 — STT
- [ ] whisper-rs integration, model path from settings
- [ ] Silero VAD trim (fallback: energy gate)
- [ ] First-run model download (resumable, progress events)

## M3 — Sidecar + WS + transcript UI
- [ ] packages/protocol zod schemas
- [ ] Sidecar (echo agent), token auth, port handshake, respawn
- [ ] core_client.rs (role:"core"), agent-socket.ts, session store, sidebar + Home transcript

## M4 — Agent loop
- [ ] LangGraph graph/tools/provider, MCP manager, open_path built-in
- [ ] Groq key paste → keychain; transcription → user_utterance
- [ ] Eval harness seed (S2)

## M5 — GitHub connector + Connectors tab
## M6 — Confirm-before-acting
## M7 — Text insertion (enigo)
## M8 — Onboarding + settings + Ollama pass

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full milestone detail.
