# Vox

Open-source, local-first voice agent for desktop (macOS + Windows). Hold a hotkey, speak, and Vox transcribes on-device, plans with an agent, and acts across your tools — pausing for confirmation before anything with side effects.

> **Status: prototype in active development.** See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the roadmap (M0–M8), [PROGRESS.md](PROGRESS.md) for the latest state, and [PRD-v1.1-prototype.md](PRD-v1.1-prototype.md) for full product scope.

**📖 New here? Start with the [Complete Setup Guide](docs/SETUP.md) and [How Vox Works](docs/HOW-IT-WORKS.md).**

## How it works

Hold hotkey → speak → **whisper.cpp** transcribes locally → **LangGraph** agent plans → calls an **MCP connector** (Filesystem, GitHub) or a system action → **confirm-before-acting** gate for side effects → result in the transcript, or text inserted at your cursor.

- **Private by default** — audio never leaves your machine and is never persisted; STT is on-device.
- **Cloud or local reasoning** — Groq (default) or Ollama, one config value.
- **Secrets in the OS keychain** — never in config files or logs.

## Prerequisites

- **Cloud mode (default):** a [Groq API key](https://console.groq.com) (free tier works)
- **Local mode:** [Ollama](https://ollama.com) with a ≥8B tool-calling model (e.g. `qwen3:8b`); ≥16GB RAM recommended
- The whisper STT model (~466MB) downloads automatically on first run

## Development

```sh
# Rust stable (rustup), pnpm ≥10, Node ≥22 required
pnpm install
pnpm dev        # tauri dev — starts Vite + the Rust core
```

Full walkthrough (permissions, keys, connectors, troubleshooting): [docs/SETUP.md](docs/SETUP.md).

Repo layout: `frontend/` (React webview) · `src-tauri/` (Rust core: hotkey, mic, STT, keychain) · `sidecar/` (TypeScript agent: LangGraph + MCP) · `packages/protocol/` (shared WS schemas) · `docs/` (living docs).

See [CONTRIBUTING.md](CONTRIBUTING.md). Model weight licenses: [MODELS.md](MODELS.md).

## Security posture (prototype)

Confirm-before-acting is the primary control: every side-effecting tool call shows the exact tool and parameters and requires explicit approval. The localhost WebSocket between UI, core, and agent is token-authenticated. Prototype builds are unsigned — expect Gatekeeper/SmartScreen warnings. Details in [PRD §9](PRD-v1.1-prototype.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
