# COMPLETED

Finished features and milestones, most recent first. Mirrors `docs/tasks/completed.md`.

## 2026-07-06/07 — M0–M4 (code complete; M4 live test pending Groq key)

### M0 — Foundation ✅
- Toolchains: Rust stable, pnpm 10.5.0, Node 22 (21 breaks Vite 8/rolldown), Bun (for gate), cmake
- Docs skeleton + tracking docs; CI (macOS+Windows matrix); Apache-2.0 LICENSE; CONTRIBUTING; issue templates
- Root pnpm workspace (frontend, sidecar, packages/protocol); husky at root
- Tauri 2 scaffold: main + overlay windows, tray, session-token generation, Vox icon set
- Halcyon design tokens in Tailwind v4 theme + self-hosted fonts
- **All four week-1 risk gates run** — outcomes in `docs/context/decisions.md` (Bun/Node both pass; hotkey press/release API confirmed; enigo compiles; whisper `base.en` 1.04s ≤ budget on dev machine, `small` fails here)

### M1 — Shell + tray + hotkey + mic capture ✅ (code + smoke)
- Push-to-talk: `alt+space` press/release → cpal capture → 16kHz mono resample → buffer logged
- Overlay pill (idle/listening/thinking) with design-system pulse + equalizer
- App runs: tray menu, hide-to-tray, overlay bottom-center. Live keypress-while-unfocused check awaits the user.

### M2 — STT + VAD + model download ✅ (code + spike-verified latency)
- whisper-rs (Metal on Apple Silicon, CPU elsewhere), context kept warm, whisper.cpp built-in Silero VAD
- Resumable model download with progress events; first-run banner in main window
- Empty/garbage transcription → overlay + transcript notice (S8 seed)

### M3 — Sidecar + token-auth WS + transcript UI ✅ (exit test PASSED)
- Sidecar spawn/handshake/respawn-with-backoff, token via env, port via stdout
- **Exit test:** wrong-token connect REJECTED; silent connect dropped; authenticated round-trip renders — verified scripted
- Privileged core channel (config push, get_secret, system_action) working in-app
- Main window: sidebar shell (Home/Connectors/Settings) + transcript with design-system turns

### M4 — LangGraph + Groq + Filesystem MCP ✅ (code; S2 live run needs Groq key)
- createReactAgent + MemorySaver; provider abstraction (Groq↔Ollama = settings value)
- Built-in tools open_path / insert_text round-trip Rust core; MCP manager (stdio + http w/ PAT header)
- Confirm gate wrapper already in place (default-deny classifier) — UI card lands in M6
- Keychain secrets (store/delete/has + core-channel read); eval harness seeded (S2, S4 cases) + CI step

## 2026-07-07 — M5–M8 surfaces (code complete; live validation pending user keys/interaction)

### M5 — Connectors tab + GitHub MCP + PAT ✅ (code)
- Connector CRUD in `connectors.json` (always added disabled; stdio command shown verbatim before enable, PRD §9.4), config pushed to sidecar on change
- Test connection + tool list over the authenticated UI channel; GitHub preset (hosted MCP URL + PAT → keychain)
- Core channel rebuilt on tokio-tungstenite with an on-demand sender (config pushes from any command)

### M6 — Confirm-before-acting UI ✅ (code)
- Caution-styled confirm card in the overlay: exact tool + params, Confirm & run / Deny; overlay resizes to fit
- Deny resumes the interrupt with a clean "cancelled by user" tool message (S8); transcript notes the pending confirmation

### M7 — Text insertion ✅ (code)
- insert_text via enigo (implemented in M4's core channel); secure-input/permission failures surface as a transcript notice (P6)

### M8 — Settings + onboarding ✅ (code)
- Settings: hotkey keycap recorder, Groq/Ollama provider toggle (S7), model field, STT model select with download, Groq key paste → keychain
- macOS permissions banner: AXIsProcessTrusted check, System Settings deep-links, re-check (Windows no-op)
- Playwright smoke tests replaced boilerplate demos; eval harness runs keyless via VOX_EVAL_PROVIDER=ollama

## Planning (2026-07-06)
- PRD v1.1 + design system reviewed; 119 tokens extracted; implementation plan approved

## Prototype success criteria scoreboard (PRD §1.3)

| # | Criterion | Status |
|---|---|---|
| S1 | ≤3s end-to-end latency | ☐ (M8) |
| S2 | "Open my Documents folder" | ✅ plumbing verified live (Ollama qwen3:1.7b): utterance → open_path(~/Documents) → result; voice-in pass on Groq pending key |
| S3 | Most-starred GitHub repos | ☐ (M5) |
| S4 | File creation pauses for confirmation | ✅ plumbing verified live (deny + approve paths, filesystem MCP) |
| S5 | Dictation inserts at cursor | ◐ tool implemented — live test M7 |
| S6 | 100% side-effecting calls gated | ✅ verified live: every write-ish call (write_file, create_directory) interrupted individually |
| S7 | Groq ↔ Ollama config toggle | ◐ Ollama side verified live via config push; Groq side pending key |
| S8 | Clean failure | ✅ deny cancels cleanly (no crash, no file, agent continues); empty-STT notice; provider errors surface |
