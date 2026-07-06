# Data design

No database in the prototype (PRD §7 allows JSON; ADR: tauri-plugin-store).

| Store | File | Contents |
|---|---|---|
| Settings | `appConfigDir/settings.json` | `hotkey`, `llm_provider`, `llm_model`, `stt_model` |
| Connectors | `appConfigDir/connectors.json` | `[{id, name, transport, command/args \| url, enabled, secret_ref}]` |
| Secrets | OS keychain (service `vox`) | Groq key, GitHub PAT, remote tokens — keyed by `secret_ref` |
| Session | in-memory only | transcript turns, action log — not persisted |

Audio is never persisted: buffered → transcribed → discarded.
