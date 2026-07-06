# Contributing to Vox

Thanks for your interest. Vox is an Apache-2.0, local-first voice agent for desktop — see [PRD-v1.1-prototype.md](PRD-v1.1-prototype.md) for scope and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the roadmap.

## Prerequisites

- Rust stable (rustup), pnpm ≥10, Node ≥20
- macOS: Xcode Command Line Tools
- Windows: MSVC build tools + WebView2

## Setup

```sh
pnpm install
pnpm dev          # tauri dev (starts Vite + Rust)
```

Useful scripts: `pnpm typecheck`, `pnpm lint`, `cargo test --manifest-path src-tauri/Cargo.toml`.

## Project layout

- `frontend/` — React webview (UI only; never touches OS APIs or secrets)
- `src-tauri/` — Rust core (hotkey, mic, STT, keychain, text insertion)
- `sidecar/` — TypeScript agent (LangGraph + MCP; never renders UI)
- `packages/protocol/` — shared WebSocket message schemas
- `docs/` — living documentation (see AGENTS.md for rules)

## Conventions

- Conventional commits (`feat:`, `fix:`, `docs:`, …) — enforced by commitlint.
- Update `docs/` with any significant change; add a `docs/changelog/YYYY-MM-DD.md` entry per completed task.
- Secrets never in code, config, or logs — OS keychain only.
- UI copy follows the design-system voice: sentence case, no exclamation marks, no emoji.

## Pull requests

CI builds macOS + Windows on every PR; both must pass. Keep PRs scoped to one milestone/feature where possible.
