# TODO

Upcoming work, in priority order. Mirrors `docs/tasks/todo.md`.

## Needs the user (blocking exit tests)
- [ ] **Paste a Groq API key** (env `GROQ_API_KEY` or Settings once M8 UI lands) → unlocks S2 eval + live agent
- [ ] **Hold ⌥Space while another app is focused** and speak → confirms M1/M2 exit tests on this machine (app runs, logs buffer + transcription)
- [ ] Grant mic permission on first capture; grant Accessibility before M7 dictation test

## M5 — GitHub MCP + PAT + Connectors tab
- [ ] Connectors tab UI: list/add/remove/enable rows (design-system connector rows), stdio command shown verbatim before enable (PRD §9.4)
- [ ] `test_connection` / `list_tools` proxy commands (Rust → core channel → sidecar)
- [ ] Connector CRUD in `connectors.json` store + config push to sidecar on change
- [ ] GitHub MCP connector (remote, PAT in keychain via `secret_ref`)
- [ ] S3 eval case (most-starred repos)

## M6 — Confirm-before-acting UI
- [ ] Confirm card in overlay (caution-styled, tool + params, approve/deny)
- [ ] Overlay window grows/shrinks for card; non-activating click handling (may need tauri-nspanel)
- [ ] Deny → clean cancel note in transcript (S8)
- [ ] S4 + S6 validation via eval harness + live

## M7 — Text insertion
- [ ] Secure-input failure detection → transcript fallback (P6)
- [ ] S5 live test in a third-party editor

## M8 — Onboarding + settings + Ollama + polish
- [ ] macOS permissions onboarding (mic + Accessibility, deep-links, re-check)
- [ ] Settings UI (hotkey recorder, provider/model toggle, STT model select, Groq key paste)
- [ ] Ollama validation pass (S7), S1 latency measurement, S8 failure sweep
- [ ] Re-introduce strict CSP; sidecar packaging decision (bun compile vs bundled Node); unsigned builds; README quickstart

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full milestone detail.
