/**
 * Live model catalogs + connection smoke test (Settings → Reasoning).
 *
 * Nothing here is hardcoded per model: every provider exposes a
 * list-models endpoint, so the dropdown in Settings always reflects what
 * the user's key can actually reach. Runs in the sidecar because only it
 * can read keys (via the core bridge) — the webview never sees them.
 */
import type { LlmProvider, Settings } from '@vox/protocol';

import { ollamaStatus } from './ollama.js';
import { buildModel, resolveApiKey } from './provider.js';

const FETCH_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 30_000;

/** Model ids that can never drive the agent (audio, embeddings, safety, images). */
const NON_CHAT_PATTERN =
  /whisper|tts|audio|embed|moderation|guard|image|dall-e|realtime|transcribe|veo|imagen|aqa/i;

interface OpenAiStyleList {
  data?: Array<{ id: string }>;
}

interface GeminiList {
  models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const hint =
      response.status === 401 || response.status === 403
        ? ' — check the API key in Settings'
        : '';
    throw new Error(`HTTP ${String(response.status)}${hint}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return (await response.json()) as T;
}

async function listOpenAiStyle(url: string, apiKey: string): Promise<string[]> {
  const data = await getJson<OpenAiStyleList>(url, { Authorization: `Bearer ${apiKey}` });
  return (data.data ?? []).map((m) => m.id).filter((id) => !NON_CHAT_PATTERN.test(id));
}

async function listGemini(apiKey: string): Promise<string[]> {
  const data = await getJson<GeminiList>(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
    {}
  );
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') === true)
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => !NON_CHAT_PATTERN.test(id));
}

async function listAnthropic(apiKey: string): Promise<string[]> {
  const data = await getJson<OpenAiStyleList>('https://api.anthropic.com/v1/models?limit=100', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  });
  return (data.data ?? []).map((m) => m.id);
}

/** Fetch the chat-capable model ids the configured key can use, sorted. */
export async function listModels(provider: LlmProvider): Promise<string[]> {
  if (provider === 'ollama') {
    const status = await ollamaStatus();
    if (!status.running) {
      throw new Error("Ollama isn't running. Start the Ollama app (or run `ollama serve`).");
    }
    return status.models.sort();
  }

  const apiKey = await resolveApiKey(provider);
  switch (provider) {
    case 'groq':
      return (await listOpenAiStyle('https://api.groq.com/openai/v1/models', apiKey)).sort();
    case 'openai':
      return (await listOpenAiStyle('https://api.openai.com/v1/models', apiKey)).sort();
    case 'gemini':
      return (await listGemini(apiKey)).sort();
    case 'anthropic':
      // The API returns newest-first; keep that order.
      return listAnthropic(apiKey);
  }
}

export interface LlmTestResult {
  ok: boolean;
  provider: string;
  model: string;
  latency_ms?: number;
  error?: string;
}

/** One-token round trip through the configured provider — proves key + model + network. */
export async function testLlm(settings: Settings): Promise<LlmTestResult> {
  const base = { provider: settings.llm_provider, model: settings.llm_model };
  try {
    const model = await buildModel(settings);
    const started = Date.now();
    await model.invoke('Reply with the single word: ok', {
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS)
    });
    return { ...base, ok: true, latency_ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, ok: false, error: message };
  }
}
