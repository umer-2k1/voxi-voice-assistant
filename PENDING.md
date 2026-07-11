# PENDING

Blocked items, open issues, and items needing user input.

## Needs user input
- **Groq API key** — required by M4 (agent loop). Paste into Settings → Reasoning; free tier acceptable.
- **GitHub PAT** — required by M5 (GitHub connector test, S3).
- **macOS permissions** — mic + Accessibility + notifications can now be granted from Onboarding or Settings → Permissions; the actual grants are interactive.
- **Google connectors** — need a user-created GCP OAuth client (Desktop app) + the MCP APIs enabled; then Connectors → Browse directory → Gmail/Drive/Calendar/Chat.
- **Windows validation** — no Windows machine in this environment; Windows exit tests run via CI builds + manual user checks.
- **Merge to main** — work is pushed to `feat/google-workspace-connectors` (direct pushes to main are blocked in this environment); merge the branch or grant main-push.

## Open technical questions
- Bun vs Node for sidecar — week-1 gate (M0/M3). Bun not installed yet; will be evaluated during the gate spike.
- Silero VAD via `ort` vs pure-Rust fallback (`earshot`/energy gate) — decide in M2 based on build friction.
- Filesystem MCP: `npx @modelcontextprotocol/server-filesystem` (requires Node on user machine) vs vendored server — decide in M4.

## Deferred hardening
- ~~Strict CSP~~ — done 2026-07-11: production CSP locked to self + loopback WS + Ollama; `devCsp: null` keeps HMR working.
- Sidecar release packaging (bun compile vs bundled Node) and unsigned builds remain.

## Accepted risks (PRD §9.5)
- Unsigned builds (Gatekeeper/SmartScreen warnings)
- Transcripts in memory only, unencrypted
- No sandboxing of stdio MCP processes
