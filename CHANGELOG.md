# Changelog

Significant changes, most recent first. Daily task-level entries live in `docs/changelog/`.

## [Unreleased]

### 2026-07-07
- Connector Directory: browsable catalog with click-to-connect; OAuth 2.1 sign-in in the browser (discovery + dynamic registration + PKCE), tokens in the OS keychain with auto-refresh
- Overlay now floats on every desktop/Space and shows agent replies + thinking state — Vox is fully operable without focusing the main window
- M1–M4 implemented: push-to-talk capture, on-device whisper STT + VAD + model downloads, token-authenticated sidecar with LangGraph agent loop (Groq/Ollama), MCP support, keychain secrets, transcript UI, eval harness (see docs/changelog/2026-07-07.md)

### 2026-07-06
- Project planning: PRD v1.1 + design system reviewed, implementation plan approved (M0–M8)
- Documentation skeleton created (root tracking docs + `docs/` per AGENTS.md)
- M0 foundation started: Rust toolchain + pnpm installed
