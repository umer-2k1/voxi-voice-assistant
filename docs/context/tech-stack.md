# Tech stack (prototype)

Per PRD §6, pinned to what's in the repo.

| Layer | Choice | Where |
|---|---|---|
| App shell | Tauri 2 (Rust) — plugins: global-shortcut, store, opener | `src-tauri/` |
| Frontend | React 19.2.5 + Vite 8 + TypeScript 6 | `frontend/` |
| UI kit | shadcn/ui (radix-nova) + Tailwind CSS v4 | `frontend/src/components/ui/` |
| State | zustand 5 | `frontend/src/stores/` |
| Agent runtime | Bun preferred, Node fallback — week-1 gate | `sidecar/` |
| Agent framework | LangGraph.js + `@langchain/mcp-adapters` | `sidecar/src/agent/` |
| LLM | `@langchain/groq` (default) / `@langchain/ollama` (toggle) | `sidecar/src/agent/provider.ts` |
| STT | whisper.cpp via `whisper-rs` — `small` default | `src-tauri/src/audio/stt.rs` |
| VAD | Silero VAD (`voice_activity_detector`) or energy-gate fallback | `src-tauri/src/audio/vad.rs` |
| Mic | `cpal` | `src-tauri/src/audio/capture.rs` |
| Text insertion | `enigo` | `src-tauri/src/commands/system.rs` |
| Secrets | `keyring` crate → OS keychain | `src-tauri/src/commands/secrets.rs` |
| Config | JSON via `tauri-plugin-store` (`settings.json`, `connectors.json`) | appConfigDir |
| Shared protocol | zod schemas | `packages/protocol/` |
| Fonts | @fontsource-variable/hanken-grotesk, @fontsource/ibm-plex-mono | self-hosted |
| Tests | Playwright (UI), eval harness (agent, from M4), cargo test | |
| CI | GitHub Actions — macOS + Windows matrix | `.github/workflows/ci.yml` |

**Prerequisites (user machines):** Groq API key (cloud mode) or Ollama + ≥8B tool-calling model (local mode); Node/npx for stdio MCP servers (decide vendoring in M4). Whisper model downloaded on first run.
