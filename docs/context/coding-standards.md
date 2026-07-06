# Coding standards

- **TypeScript** (frontend, sidecar, protocol): strict mode; ESLint + Prettier configs from `frontend/` are the baseline; named exports; zod at every process boundary.
- **Rust**: rustfmt defaults; `cargo clippy` clean; no `unwrap()` outside tests/startup; errors surface to the webview as events, never panic across the FFI boundary.
- **Commits**: conventional commits (enforced by commitlint) — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- **Secrets**: never in code, config, logs, or transcripts. Keychain only, referenced by `secret_ref`.
- **UI copy**: design-system voice — sentence case, no exclamation marks, no emoji; mono font for machine-generated identifiers.
- **Docs**: per AGENTS.md — update `/docs/context/`, add `/docs/changelog/YYYY-MM-DD.md` entry after every completed task, feature docs in `/docs/features/`.
