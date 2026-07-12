# TODO

Upcoming work, in priority order. Mirrors `docs/tasks/todo.md`.

## Needs the user (blocking exit tests)
- [ ] **Paste a Groq API key** (Settings → Reasoning, or env `GROQ_API_KEY`) → unlocks S2 eval + live agent
- [ ] **Hold ⌥Space while another app is focused** and speak → confirms M1/M2 exit tests on this machine (app runs, logs buffer + transcription)
- [ ] Grant mic / Accessibility / notifications from Onboarding or Settings → Permissions
- [ ] **Google connectors live test** — create the GCP OAuth client, enable the MCP APIs, connect Gmail from the directory, say "check my latest five emails"
- [ ] **Merge `feat/google-workspace-connectors` into main** (direct main-push blocked in this environment)
- [ ] **Enable GitHub Pages** — repo Settings → Pages → Source: "GitHub Actions" (one click; the `deploy-pages` workflow then publishes `site/` on every push to main)

## M5 — remaining
- [ ] S3 live validation (needs GitHub PAT)

## M7 — remaining
- [ ] S5 live test in a third-party editor (needs Accessibility grant)

## M8 — remaining
- [ ] S1 latency measurement end-to-end by voice; S7 Groq side (needs key; Ollama side verified)
- [x] Re-introduce strict CSP (2026-07-11)
- [ ] Sidecar release packaging (bun compile vs bundled Node); produce unsigned builds

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full milestone detail.
