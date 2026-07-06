# TODO

Upcoming work, in priority order. Mirrors `docs/tasks/todo.md`.

## Needs the user (blocking exit tests)
- [ ] **Paste a Groq API key** (env `GROQ_API_KEY` or Settings once M8 UI lands) → unlocks S2 eval + live agent
- [ ] **Hold ⌥Space while another app is focused** and speak → confirms M1/M2 exit tests on this machine (app runs, logs buffer + transcription)
- [ ] Grant mic permission on first capture; grant Accessibility before M7 dictation test

## M5 — remaining
- [ ] S3 live validation (needs GitHub PAT)

## M7 — remaining
- [ ] S5 live test in a third-party editor (needs Accessibility grant)

## M8 — remaining
- [ ] S1 latency measurement end-to-end by voice; S7 Groq side (needs key; Ollama side verified)
- [ ] Re-introduce strict CSP; sidecar release packaging (bun compile vs bundled Node); produce unsigned builds

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full milestone detail.
