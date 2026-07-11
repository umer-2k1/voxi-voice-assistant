# PENDING

Blocked items, open issues, and items needing user input.

## Needs user input
- **Groq API key** — required by M4 (agent loop). Paste into Settings → Reasoning; free tier acceptable.
- **GitHub PAT** — required by M5 (GitHub connector test, S3).
- **macOS permissions** — mic + Accessibility + notifications can now be granted from Onboarding or Settings → Permissions; the actual grants are interactive.
- **Google connectors** — need a user-created GCP OAuth client (Desktop app) + the MCP APIs enabled; then Connectors → Browse directory → Gmail/Drive/Calendar/Chat.
- **Windows validation** — no Windows machine in this environment; Windows exit tests run via CI builds + manual user checks.
- **Merge to main** — work is pushed to `feat/google-workspace-connectors` (direct pushes to main are blocked in this environment); merge the branch or grant main-push.

## Open technical questions — all resolved 2026-07-12 (see docs/context/decisions.md)
- ~~Bun vs Node for sidecar~~ → **Node**: esbuild single-file bundle shipped as a Tauri resource, run by system Node ≥20 (`find_node()` scans PATH + common dirs; actionable error when missing).
- ~~Silero VAD via `ort` vs fallback~~ → **whisper.cpp built-in Silero VAD**, shipped since M2; no extra deps.
- ~~Filesystem MCP npx vs vendored~~ → **npx on the user machine** (user decision); consistent with the sidecar's Node requirement.

## Deferred hardening
- ~~Strict CSP~~ — done 2026-07-11: production CSP locked to self + loopback WS + Ollama; `devCsp: null` keeps HMR working.
- ~~Sidecar release packaging~~ — done 2026-07-12: bundle + resource + release launch path. Unsigned builds (Gatekeeper warnings) remain an accepted risk; signing/notarization/auto-update deliberately skipped for now.

## Accepted risks (PRD §9.5)
- Unsigned builds (Gatekeeper/SmartScreen warnings)
- Transcripts in memory only, unencrypted
- No sandboxing of stdio MCP processes
