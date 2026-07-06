# Model licenses

The Vox codebase is Apache-2.0. Model weights carry their own licenses (PRD §12):

| Model | Use | License | Notes |
|---|---|---|---|
| Whisper (`small`, `base.en`, `large-v3` — ggml builds) | Local STT | MIT | Weights fetched on first run from Hugging Face (`ggerganov/whisper.cpp`) |
| Silero VAD | Voice activity detection | MIT | Bundled ONNX model |
| Llama 3.3 70B (via Groq) | Cloud LLM (default) | Meta Llama Community License — **not OSI-open** | Served by Groq; nothing distributed with Vox |
| Qwen (via Groq or Ollama) | Cloud/local LLM option | Check per version (Qwen 2.5/3 are mostly Apache-2.0; some sizes differ) | User-installed via Ollama |

Nothing in this repository redistributes model weights. Users download STT models on first run and install Ollama models themselves.
