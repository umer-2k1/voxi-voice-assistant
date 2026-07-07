# Vox — Complete Setup Guide

Everything needed to go from a fresh clone to a working voice agent, for both development and daily use. Windows notes are inline; the primary walkthrough is macOS.

---

## 1. Prerequisites

| Requirement | Version | Why | Install |
|---|---|---|---|
| **Node.js** | ≥ 22 (22.12+ recommended) | Vite 8 / rolldown break on Node 21 and below | `nvm install 22 && nvm alias default 22`, or [nodejs.org](https://nodejs.org) |
| **pnpm** | ≥ 10 | workspace package manager | `npm install -g pnpm@10.5.0` |
| **Rust** | stable | Tauri core (hotkey, mic, STT, keychain) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Xcode CLT** (macOS) | any recent | compiles the Rust core + whisper.cpp | `xcode-select --install` |
| **MSVC Build Tooeels + WebView2** (Windows) | VS 2022 | same | [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) |
| **cmake** | any recent | builds whisper.cpp via whisper-rs | `brew install cmake` (macOS) |

**For the agent's brain — pick one (or both):**

| Mode | Requirement |
|---|---|
| **Cloud (default)** | A [Groq API key](https://console.groq.com/keys) — free tier works |
| **Local** | [Ollama](https://ollama.com) + a tool-calling model ≥8B recommended (`ollama pull qwen3:8b`); ≥16 GB RAM advised. Smaller models (e.g. `qwen3:1.7b`) work for testing but reason poorly. |

**For connectors (optional):**
- Filesystem MCP server runs via `npx` — needs Node on `PATH` (already covered above).
- GitHub connector needs a [Personal Access Token](https://github.com/settings/tokens).

## 2. Install & first run

```sh
git clone https://github.com/umer-2k1/voxi-voice-assistant.git
cd voxi-voice-assistant
pnpm install          # installs frontend, sidecar, protocol packages
pnpm dev              # compiles the Rust core, starts Vite (port 3000), launches the app
```

The first `pnpm dev` compiles ~470 Rust crates including whisper.cpp — expect 5–10 minutes. Subsequent runs are incremental.

**What appears:** the main window (sidebar: Home / Connectors / Settings), a small always-on-top overlay pill at the bottom-center of your screen showing `idle`, and a tray icon (menu: Open Vox / Quit — closing the main window hides it to the tray).

### First-run model download
On first launch, Home shows a banner downloading the speech model for the configured `stt_model` (default `small`, ~466 MB, plus the ~1 MB Silero VAD model). The download is resumable; the app stays usable meanwhile. Models land in:
- macOS: `~/Library/Application Support/dev.vox.app/models/`
- Windows: `%APPDATA%/dev.vox.app/models/`

**Low-end or Intel-Mac hardware:** switch Settings → Speech to text → `base.en` (142 MB, English-only, ~10× faster). On a 2019-class Intel MacBook, `base.en` transcribes a 12s utterance in ~1s; `small` takes ~25s.

## 3. macOS permissions

Vox needs two permissions; the Home screen shows a banner until they're granted:

1. **Microphone** — the prompt appears the first time you hold the hotkey. If you dismissed it: System Settings → Privacy & Security → Microphone → enable Vox (or your terminal, in dev mode).
2. **Accessibility** — required only for dictation (typing text into other apps). Click "Open System Settings" in the banner, add/enable the app, then "Re-check".

Windows: no permissions needed (the banner never appears).

## 4. Configure the agent

Open **Settings**:

- **Push-to-talk** — default `alt+space` (⌥Space). Click the keycap and press a new combination to change it.
- **Reasoning**
  - *Groq (cloud, default):* paste your API key → Save. It's stored in the OS keychain — never in a file.
  - *Ollama (local):* click "Ollama (local)", set the model name (e.g. `qwen3:8b`). Make sure `ollama serve` is running and the model is pulled.
- **Speech to text** — choose `small` (default), `base.en` (fast/English), or `large-v3` (best, 2.9 GB). Selecting one downloads it if missing.

Settings are stored as plain JSON in `…/dev.vox.app/settings.json` — hand-editing works too (the provider toggle is just `"llm_provider": "groq" | "ollama"`).

## 5. Add connectors (optional but recommended)

Open **Connectors → Browse directory** and click **Connect** on any card:

- **No sign-in needed** (Context7, DeepWiki…) — connects instantly.
- **Access token** (GitHub, Stripe, Hugging Face…) — paste one credential; it goes into the OS keychain and is attached as a bearer header.
- **Sign in with your browser** (Notion, Linear, Sentry, Atlassian, Asana, Canva, Figma…) — Vox opens your browser to authorize; approve, come back, and the connector is live. Tokens are stored in the keychain and refreshed automatically.
- **Filesystem** runs locally over stdio — it is added disabled, and the exact command (`npx -y @modelcontextprotocol/server-filesystem ~/`) is shown verbatim before you enable it (deliberate security posture — no auto-start of stdio servers).

Anything not in the directory: **Add custom** takes any stdio command or HTTP MCP endpoint + optional token. Use **Test** on any row to verify the connection and list the tools it exposes.

## 6. Use it

1. **Hold** ⌥Space (from any app — Vox doesn't need focus). The overlay pill pulses and shows the equalizer.
2. **Speak**: *"Open my Documents folder"* / *"Show my most-starred GitHub repos"* / *"Create a markdown file called meeting-notes with today's date as the heading"*.
3. **Release.** The pill shows `thinking…`, then your words appear, then the agent acts.
4. **Anything with side effects pauses first**: a caution-colored card appears in the overlay showing the exact tool and parameters. Nothing executes until you click **Confirm & run**; **Deny** cancels cleanly.
5. Results appear in the Home transcript. For dictation ("type this into my editor…"), the text is inserted at your cursor in whatever app is focused.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find native binding` / rolldown error on `pnpm dev` | You're on Node < 22. `nvm use 22`, delete `node_modules`, `pnpm install`. |
| Hotkey does nothing | Another app may own the shortcut — pick a different one in Settings. macOS: check mic permission was granted. |
| "No Groq API key found" in transcript | Paste a key in Settings (or `export GROQ_API_KEY=…` in dev). |
| Ollama mode errors | Is `ollama serve` running? Is the model pulled (`ollama list`)? |
| Transcription is slow (>3s) | Switch STT model to `base.en`. Intel Macs run whisper on CPU by design (Metal hangs there). |
| Transcription empty / "Didn't catch that" | Speak after fully pressing the hotkey; check input device volume; VAD trims pure silence. |
| Dictation types nothing | Grant Accessibility (macOS). Secure fields (password boxes) block synthetic typing by OS design — the text falls back to the transcript. |
| `agent stopped` in sidebar | The sidecar crashed and respawn gave up. Check `pnpm dev` terminal output; restart the app. |
| Gatekeeper "unidentified developer" on a built app | Prototype builds are unsigned (expected): right-click → Open, or `xattr -d com.apple.quarantine Vox.app`. |

## 8. Developer extras

```sh
pnpm typecheck                                   # all TS packages
cargo test --manifest-path src-tauri/Cargo.toml  # Rust unit tests
pnpm --filter @vox/frontend test                 # Playwright smoke tests (needs `pnpm --filter @vox/frontend test:setup` once)
pnpm --filter @vox/sidecar eval                  # agent evals (needs GROQ_API_KEY, or VOX_EVAL_PROVIDER=ollama)
pnpm build                                       # production bundle + unsigned installers
```

CI builds macOS + Windows on every push/PR. Add a `GROQ_API_KEY` repo secret to activate the agent evals in CI.
