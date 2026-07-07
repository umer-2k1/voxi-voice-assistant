/**
 * Ollama preflight — Hermes-style "never make the user do plumbing".
 *
 * Instead of handing the raw API error ("model 'x' not found") to the
 * transcript, Vox checks what is actually installed and uses it: exact
 * match first, same-family tag next, then the best installed
 * tool-calling model. Only genuinely unrecoverable states (server down,
 * zero models) surface as errors — with instructions, not stack traces.
 */

export const OLLAMA_URL = process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434';

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export async function ollamaStatus(): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return { running: false, models: [] };
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return { running: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { running: false, models: [] };
  }
}

/** Families known to handle tool calling well, in preference order. */
const TOOL_CAPABLE = [
  /^qwen3/i,
  /^hermes3/i,
  /^llama3\.[123]/i,
  /^qwen2\.5/i,
  /^mistral/i,
  /^granite/i,
  /^gpt-oss/i
];

/** Pick the model to actually run given what the user configured. */
export function pickModel(configured: string, installed: string[]): string | null {
  if (installed.length === 0) return null;
  if (installed.includes(configured)) return configured;

  // Same family, different tag: configured "qwen3:8b" ↔ installed "qwen3:latest".
  const family = configured.split(':')[0]?.toLowerCase();
  const sameFamily = installed.find((name) => name.split(':')[0]?.toLowerCase() === family);
  if (sameFamily) return sameFamily;

  for (const pattern of TOOL_CAPABLE) {
    const match = installed.find((name) => pattern.test(name));
    if (match) return match;
  }
  return installed[0] ?? null;
}

/**
 * Resolve the Ollama model to use, or throw a plain-language, actionable
 * error. Returns the resolved name (may differ from what is configured).
 */
export async function resolveOllamaModel(configured: string): Promise<string> {
  const status = await ollamaStatus();
  if (!status.running) {
    throw new Error(
      "Ollama isn't running. Start the Ollama app (or run `ollama serve`), then try again — or switch to Groq in Settings."
    );
  }
  const model = pickModel(configured, status.models);
  if (!model) {
    throw new Error(
      'Ollama is running but has no models installed. Open Settings → Reasoning to download one, or run `ollama pull qwen3:8b`.'
    );
  }
  if (model !== configured) {
    console.error(`ollama: '${configured}' is not installed — using '${model}' instead`);
  }
  return model;
}
