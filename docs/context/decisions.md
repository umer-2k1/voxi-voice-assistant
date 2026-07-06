# Technical decisions

Running log; larger ones get an ADR in `docs/decisions/`.

## 2026-07-06 — Planning decisions

| Decision | Reason | Alternatives | Tradeoffs |
|---|---|---|---|
| STT in Rust via `whisper-rs` | Matches PRD dataflow (mic→STT→agent in one process); audio never crosses the WS; removes whisper from Bun-compat risk | Node/Bun whisper bindings in sidecar | Rust build times; metal feature flag per-OS |
| Config as JSON via `tauri-plugin-store` | PRD allows JSON; hand-editable (satisfies S7 config toggle); no native sqlite dependency | SQLite | No queryability — acceptable, nothing needs querying |
| Sidecar as separate workspace package, spawned by Rust with env-injected token | PRD §5.3; isolates secrets + stdio MCP spawning | Agent in webview (impossible: no process spawn) | Process lifecycle management (respawn on crash) |
| Rust core connects to sidecar WS as second client (`role: "core"`) | Clean channel for `get_secret` and `system_action` without exposing secrets to webview | Tauri IPC proxying via webview | One extra WS client; strictly better isolation |
| Two windows, one Vite app (routes `/` and `/overlay`) | Single build, shared components/stores | Separate overlay bundle | Each window has its own JS context; both talk WS directly |
| Default-deny side-effect classifier | S6 requires 100% gate coverage; unknown tools must confirm | Allowlist-of-side-effects (default-allow) | Occasional unnecessary confirms — safe direction |
| `insert_text` exempt from confirm gate | It IS the explicitly requested dictation intent (P6/S5); gating it would break dictation flow | Gate everything | Documented in ADR-001 |
| Light theme only | Design system is "Halcyon · Light · v1.0" | Keep boilerplate dark mode | Dark infra left dormant, not removed |
| Self-hosted fonts (@fontsource) | Desktop app must not load network fonts | Google Fonts CDN | +~300KB bundle |

## Week-1 risk gate outcomes (M0)

- **Gate A — Bun vs Node:** _pending_
- **Gate B — enigo sanity (macOS):** _pending_
- **Gate C — global-shortcut key-release while unfocused:** _pending_
- **Gate D — whisper-rs `small` latency:** _pending_
