# Dependencies

## Runtime prerequisites (user machines)
- **Cloud mode (default):** Groq API key
- **Local mode:** Ollama + a ≥8B tool-calling model (e.g. Qwen 3 8B); ≥16GB RAM recommended
- **STT:** whisper.cpp `ggml-small.bin` (~466MB) downloaded on first run
- **stdio MCP servers:** Node/npx (Filesystem MCP) — vendoring decision pending (M4)

## Key libraries
See [tech-stack.md](tech-stack.md). Version policy: bleeding-edge pins (React 19, Vite 8, Tailwind 4) are frozen for the prototype — no upgrades mid-milestone.

## Dev toolchain
- Rust stable (rustup), pnpm 10.5.0, Node ≥20 (v21 on the dev machine), Xcode CLT (macOS)
- Bun — only if week-1 gate selects it for the sidecar
