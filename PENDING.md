# PENDING

Blocked items, open issues, and items needing user input.

## Needs user input
- **Groq API key** — required by M4 (agent loop). Paste into Settings once the UI exists; free tier acceptable.
- **GitHub PAT** — required by M5 (GitHub connector test, S3).
- **macOS permissions** — mic + Accessibility prompts must be granted interactively when first exercised (M1/M7).
- **Windows validation** — no Windows machine in this environment; Windows exit tests run via CI builds + manual user checks.

## Open technical questions
- Bun vs Node for sidecar — week-1 gate (M0/M3). Bun not installed yet; will be evaluated during the gate spike.
- Silero VAD via `ort` vs pure-Rust fallback (`earshot`/energy gate) — decide in M2 based on build friction.
- Filesystem MCP: `npx @modelcontextprotocol/server-filesystem` (requires Node on user machine) vs vendored server — decide in M4.

## Accepted risks (PRD §9.5)
- Unsigned builds (Gatekeeper/SmartScreen warnings)
- Transcripts in memory only, unencrypted
- No sandboxing of stdio MCP processes
