# Vox — Prototype Implementation Plan

## Context

Build the v1.1 prototype of **Vox**, an open-source, local-first desktop voice agent (macOS + Windows), per [PRD-v1.1-prototype.md](PRD-v1.1-prototype.md). The loop to prove: **hold hotkey → speak → local whisper.cpp STT → LangGraph agent → MCP connector (Filesystem/GitHub) → confirm-before-acting → transcript / text-insertion**. Success = S1–S8 (§1.3), built in the PRD's milestone order M1–M8 (§10), styled per the **Vox "Halcyon Light v1.0"** design system.

The user explicitly asked to: (1) plan first, code second; (2) create and continuously maintain tracking docs (Implementation Plan, Progress Log, TODO, COMPLETED, PENDING, CHANGELOG); (3) build on the existing Vite boilerplate in `frontend/`; (4) use Tauri; (5) implement one milestone at a time, each fully functional before the next.

**What exists:** `frontend/` boilerplate (React 19.2.5, Vite 8, TS 6, Tailwind v4 CSS-variable theme in `src/styles/global.css`, shadcn/ui radix-nova with 33+ components in `src/components/ui/`, zustand 5 unused, react-router 7, Playwright, husky/commitlint, pnpm@10.5.0). No Tauri anywhere. `docs/` empty. `AGENTS.md` mandates a `/docs` structure (context/, features/, decisions, tasks, changelog/YYYY-MM-DD.md).

**Design tokens extracted** from `Vox Design System.html` (saved at docs/context/design-tokens.txt, 119 vars): Hanken Grotesk (human text) + IBM Plex Mono (machine text); Vox Blue #4B57E8 (blue-50→800), ink #1A1C22 + cool grays, success #22A366 / caution #E0A32E (confirm gate) / danger #DC4B43; 4px grid; radius sm6/md9/lg12/xl16/window18/pill; borders-first elevation (shadow only popovers/dialogs/mic glow); motion only on voice elements (equalizer .95s, pulse 2.1s, ease-out cubic-bezier(.2,.7,.2,1), 120/200/320ms); voice&tone: calm, sentence case, no exclamations, no emoji.

**Environment (checked):** Node v21.7.3 ✓, Xcode CLT ✓, Ollama client 0.30.11 (not running). **Missing: Rust/cargo, Bun, pnpm, cmake** — install rustup + corepack-pnpm in M0 (Bun only for the week-1 gate spike).

## Repo layout (target)

```
voxi-voice-assistant/
├── package.json + pnpm-workspace.yaml   # NEW root workspace: [frontend, sidecar, packages/*]
├── src-tauri/                           # NEW Tauri 2 Rust core (single crate)
│   ├── tauri.conf.json                  # devUrl → :5173, frontendDist → ../frontend/dist
│   ├── capabilities/                    # per-window permissions (main vs overlay)
│   └── src/
│       ├── hotkey.rs · tray.rs · windows.rs
│       ├── sidecar.rs                   # token gen + spawn + port handshake + respawn
│       ├── core_client.rs               # WS client, role:"core" privileged channel
│       ├── audio/{capture,vad,stt,download}.rs
│       └── commands/{connectors,settings,secrets,system,permissions}.rs
├── sidecar/                             # NEW TS agent (Bun preferred, Node fallback — week-1 gate)
│   └── src/{index,server,auth}.ts · agent/{graph,tools,provider}.ts · mcp/manager.ts
├── packages/protocol/                   # NEW shared zod schemas for WS messages (frontend + sidecar)
├── frontend/                            # EXISTING — kept, tooling untouched
├── docs/                                # per AGENTS.md + user tracking docs (see Documentation)
├── IMPLEMENTATION_PLAN.md · TODO.md · COMPLETED.md · PENDING.md · CHANGELOG.md · MODELS.md  # root
└── .github/workflows/ci.yml             # macOS + Windows matrix
```

Rationale: `src-tauri/` at root keeps the Rust core a peer of UI and sidecar; Tauri natively points at `../frontend`. Workspace migration: move `pnpm-workspace.yaml` (currently only `onlyBuiltDependencies`) + lockfile + husky from `frontend/` to root; change frontend's `postinstall: playwright install` to an explicit script so root installs don't pull browsers in CI.

## Key technical decisions

1. **STT in Rust via `whisper-rs`** (metal on macOS, CPU on Windows) — matches PRD diagram (mic→STT→agent, audio never crosses the WS, never persisted). Removes whisper from the Bun risk surface. Model `ggml-small.bin` (~466MB) downloaded on first run to appData with progress events, resumable + checksummed.
2. **Silero VAD in Rust** (`voice_activity_detector` crate / ort, 512-sample chunks @16kHz) inside the capture task; fallback to WebRTC-VAD (`earshot`) or energy gating if ort packaging fights Windows CI. VAD is an optimization — must not block M2.
3. **Audio pipeline:** cpal input → resample to 16kHz mono f32 → ring buffer while hotkey held → VAD trim on release → `whisper_full` → text.
4. **WS protocol:** sidecar binds `127.0.0.1:0`, prints port on stdout; token = 32 random bytes from Rust, env-injected (`VOX_SESSION_TOKEN`); webview gets `{port, token}` via `get_sidecar_info` command. First frame must be `auth {token, role: ui|core}` or socket dropped. Messages `{type, id, payload}` zod-validated in `packages/protocol`: PRD §8.1 events + privileged core channel (`get_secret`/`secret_value`, `system_action` for open_path/insert_text, `config_updated` push). Rust connects as a second `role:"core"` client — secrets never touch the webview.
5. **Config: JSON via `tauri-plugin-store`** (`settings.json`, `connectors.json` in appConfigDir) — PRD allows it; hand-editing satisfies S7's config toggle; no sqlite binding anywhere. Rust pushes config to sidecar at spawn/change.
6. **Secrets:** `store_secret` → `keyring` crate (service "vox", account = generated ref e.g. `github_pat_a1b2`) → only `secret_ref` in config. Read path is core-channel only; no `get_secret` IPC exposed to webview. Deleting a connector deletes its keychain entry.
7. **LangGraph:** `StateGraph(MessagesAnnotation)` + `MemorySaver`, thread_id = session (enables text-clarify → resume). Agent node = Groq/Ollama chat model from `provider.ts` (S7 = config value) with tools = enabled MCP tools (`MultiServerMCPClient`) + built-ins `open_path`, `insert_text`. Side-effect gate is **default-deny**: read-only only if MCP `readOnlyHint === true` or matches allowlist (`read_*, list_*, search_*, get_*`); everything else calls `interrupt({tool, params})` → `confirm_request` → resume/deny (deny injects "cancelled by user" ToolMessage, clean end, S8). `insert_text` exempt from confirm (it IS the explicit dictation intent, P6/S5) — recorded as an ADR.
8. **Two windows, one Vite app:** overlay route `/overlay` (frameless, transparent, always-on-top, non-activating, bottom-center: mic pill idle/listening/thinking — the only animated elements — live transcription line in mono, confirm card caution-styled) + main window `/` (18px radius, sidebar: Home=transcript, Connectors, Settings, onboarding route for macOS permissions). Tray = state icon + Open/Settings/Quit; close hides to tray.
9. **Tokens → Tailwind v4:** extend `@theme` in `frontend/src/styles/global.css` with the Halcyon palette, remap shadcn semantic vars (`--primary: #4B57E8`, radius scale, borders-first), self-hosted fonts via `@fontsource-variable/hanken-grotesk` + `@fontsource/ibm-plex-mono`. Light theme only (design system is Light v1.0); keep dark infra dormant.
10. **State:** zustand stores (`useSessionStore` transcript/mic/pending-confirm, `useConnectorsStore`, `useSettingsStore`); WS + Tauri-event bridge in `frontend/src/lib/agent-socket.ts`. Each window has its own JS context — both subscribe to the sidecar WS directly.

## Milestones

**M0 — Foundation, docs, week-1 risk gates**
1. Docs skeleton (see Documentation below); seed architecture.md (PRD §5), decisions.md (ADRs for choices above), MODELS.md.
2. Install prerequisites: rustup, corepack-pnpm; workspace restructure to root.
3. Tauri 2 scaffold in `src-tauri/` (plugins: global-shortcut, store, opener, shell; `@tauri-apps/api` in frontend; two windows + tray + capabilities).
4. Design tokens into global.css + fonts; strip demo Counter/Navbar/Footer from app.tsx.
5. CI (macOS+Windows: install, typecheck, cargo check, debug build), CONTRIBUTING.md, issue templates, Apache-2.0 LICENSE at root.
6. **Risk gates** (spikes, outcomes → decisions.md): (a) Bun vs Node — MCP stdio spawn + ws under Bun; (b) enigo typing sanity both OSes; (c) **global-shortcut key-RELEASE while unfocused** (most load-bearing assumption; fallback `rdev` or press-to-toggle); (d) whisper-rs small-model latency on target laptop.
   Exit: empty Tauri window builds on both OSes in CI; 4 gate outcomes written.

**M1 — Shell + tray + hotkey + mic capture (Rust).** hotkey.rs press/release, tray, overlay window, cpal ring buffer, mic-state events → overlay pill. Exit: hold hotkey while another app focused → buffer length logged, both OSes.

**M2 — whisper.cpp + VAD + model download.** stt.rs, vad.rs, download.rs (progress events), overlay thinking→transcription; empty/garbage → transcript notice (S8 seed). Exit: 10 commands → ≥9 usable; ≤1.5s for 10s utterance.

**M3 — Sidecar + token-auth WS + transcript UI** (parallel-capable with M2; **Bun/Node gate closes**). Echo-agent sidecar, protocol package, spawn/handshake/respawn, core client, agent-socket.ts, session store, sidebar shell + Home transcript. Exit: round-trip message renders; unauthenticated connect rejected.

**M4 — LangGraph + Groq + Filesystem MCP.** graph/tools/provider, mcp/manager, built-in open_path → core channel → system.rs, Groq key paste → keychain, transcription → user_utterance. Seed **eval harness** (`sidecar/evals/`, text-in, assert tool calls; CI from here on, PRD §12). Exit: **S2** by voice, both OSes.

**M5 — GitHub MCP + PAT + Connectors tab.** Connectors UI (add/remove/enable, stdio command shown verbatim before enable per §9.4, test connection + tool list), PAT → keychain. Exit: **S3**.

**M6 — Confirm-before-acting.** Interrupt wrapper + default-deny classifier, confirm card in overlay, deny → clean cancel. Test non-activating overlay click-through semantics early (may need tauri-nspanel on macOS). Exit: **S4 + S6**.

**M7 — Text insertion (enigo).** insert_text command + tool, secure-input failure → transcript fallback (P6), dictation routing. Exit: **S5** both OSes.

**M8 — Onboarding + settings + Ollama pass.** permissions.rs (AXIsProcessTrusted + mic, deep-links, re-check; Windows no-op), onboarding route, full Settings (hotkey keycap recorder, provider/model toggle, STT model select), Ollama validation with ≥8B tool-calling model, S1 latency tuning, S8 failure sweep, README quickstart, unsigned builds. Exit: **S1, S7, S8**; fresh machine reaches S2 unaided.

## Documentation (created in M0, updated every milestone)

- Root tracking (user-requested): `IMPLEMENTATION_PLAN.md` (this roadmap), `TODO.md`, `COMPLETED.md`, `PENDING.md` (blockers/open issues), `CHANGELOG.md`.
- Per AGENTS.md: `docs/context/{product,vision,architecture,coding-standards,tech-stack,dependencies,database,api,ui-design}.md`, `docs/features/<feature>.md` per shipped feature, `docs/context/decisions.md` + `docs/decisions/ADR-*.md`, `docs/tasks/{todo,in-progress,completed}.md` (mirror of root trackers), `docs/changelog/YYYY-MM-DD.md` per task, `docs/bugs/`.
- Progress Log = dated entries in `docs/changelog/` + a `PROGRESS.md` session log at root.

## Risks

1. Global-shortcut key-release while unfocused — gated in M0; fallback rdev/toggle-mode.
2. Tailwind v4 radix-nova vs Halcyon tokens — budget token audit in M0; pin bleeding-edge versions (React 19/Vite 8), no upgrades mid-prototype.
3. enigo secure-input fields — detect + transcript fallback only (PRD accepts); Accessibility permission must precede M7 demos.
4. Unsigned builds: Gatekeeper/SmartScreen friction; keep stable bundle identifier so macOS permission grants survive rebuilds.
5. 466MB model first-run download — resumable, non-blocking (text path usable while downloading).
6. ort/onnxruntime on Windows CI → VAD fallback path defined.
7. Groq free-tier rate limits can fake S1 failures — measure with retry-aware client.
8. Filesystem MCP via npx requires Node on user machines — document as prerequisite or vendor a server into the sidecar (decide in M4).
9. **User-side needs:** Groq API key (by M4), GitHub PAT (by M5) — tracked in PENDING.md.

## Verification

- Per milestone: the PRD exit test (listed above) run on macOS (primary dev machine) — Windows via CI build + user-assisted manual checks.
- From M4: eval harness runs S2→S5 as scripted text-in assertions in CI on every PR.
- UI: Playwright against the Vite dev server for transcript/connectors/settings flows; `pnpm typecheck` + `cargo check` + `tauri build --debug` in CI both OSes.
- Final: S1–S8 checklist pass recorded in COMPLETED.md.

## Execution order after approval

Start with M0 (docs + prerequisites + scaffold + tokens + risk gates), then proceed milestone-by-milestone in order (M2/M3 may interleave), updating the tracking docs after each milestone per the user's process requirements.
