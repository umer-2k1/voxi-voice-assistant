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

## Week-1 risk gate outcomes (M0, run 2026-07-06)

- **Gate A — Bun vs Node: BOTH PASS.** `sidecar/spikes/gate-a-runtime.ts` run under Bun 1.x and Node 22/tsx: `ws` server round-trip PASS on both; `@langchain/mcp-adapters` stdio spawn of the filesystem MCP server PASS on both (14 tools listed). Since whisper + keyring moved to the Rust core, no risky native bindings remain in the sidecar. **Decision: develop runtime-agnostic, run under Node/tsx in dev; final packaging target (`bun build --compile` vs bundled Node) closes at M3 as planned.**
- **Gate B — enigo (macOS): compiles and initializes** (spike crate built against enigo 0.6). Runtime typing test requires an interactive session with Accessibility permission — deferred to the M7 exit test on a focused editor. No API-level blockers found.
- **Gate C — global-shortcut key-release: API CONFIRMED.** `tauri-plugin-global-shortcut` 2.3.2 exposes `ShortcutState::{Pressed, Released}` per shortcut event (re-exported from `global-hotkey`). Runtime while-unfocused verification is the M1 exit test; fallback (`rdev` or press-to-toggle) stays documented but looks unnecessary.
- **Gate D — whisper latency (Intel Mac, CPU, 12.6s spoken utterance): MEASURED.**
  - `small`: 25.4s inference — **fails** the ≤1.5s M2 budget on this machine (~2× real-time). Metal on this Intel Mac hung outright; whisper is CPU-only on x86_64 (Cargo target-specific features: `metal` only on aarch64-apple).
  - `base.en`: **1.04s** inference, 181ms model load — **passes** the budget with usable accuracy.
  - `tiny.en`: 0.55s, accuracy slightly worse.
  - **Decision:** app default stays `small` per PRD P2; on low-end/Intel hardware the documented recommendation is `base.en` (PRD explicitly allows it), and this dev machine uses `base.en` for exit tests. whisper context is kept warm in `SttEngine`, so model load cost is paid once.

## Additional findings

- whisper-rs 0.15 bundles whisper.cpp's native VAD API (`whisper_vad.rs`) — candidate to replace a separate Silero crate in M2 (one less dependency; same Silero model family).
- Node 21 breaks Vite 8/rolldown (native binding resolution) — **Node 22+ required**; nvm default switched to 22, CI uses 22.
