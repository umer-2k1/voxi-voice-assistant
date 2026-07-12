import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import type { LlmProvider, Settings } from '@vox/protocol';

import { coreBridge } from '../core-bridge.js';
import { resolveOllamaModel } from './ollama.js';

/** Well-known keychain reference for the Groq API key (PRD §8.3). */
export const GROQ_KEY_REF = 'groq_api_key';

export type CloudProvider = Exclude<LlmProvider, 'ollama'>;

/** One keychain entry per cloud provider; the webview only ever sees has/hasn't. */
export const PROVIDER_KEY_REFS: Record<CloudProvider, string> = {
  groq: GROQ_KEY_REF,
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key'
};

/** Dev-convenience env var per provider, checked before the keychain. */
const PROVIDER_ENV_VARS: Record<CloudProvider, string> = {
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY'
};

const PROVIDER_LABELS: Record<CloudProvider, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic'
};

export type ChatModel = ChatGroq | ChatOllama | ChatGoogleGenerativeAI | ChatOpenAI | ChatAnthropic;

/** Env var first (dev convenience), keychain second; actionable error otherwise. */
export async function resolveApiKey(provider: CloudProvider): Promise<string> {
  const key =
    process.env[PROVIDER_ENV_VARS[provider]] ??
    (await coreBridge.getSecret(PROVIDER_KEY_REFS[provider])) ??
    undefined;
  if (!key) {
    throw new Error(
      `No ${PROVIDER_LABELS[provider]} API key found. Paste one in Settings → Reasoning, or switch provider.`
    );
  }
  return key;
}

/**
 * One provider abstraction: the reasoning backend is a settings value,
 * never a code branch elsewhere (PRD P4 / S7). Newer OpenAI and Anthropic
 * models reject sampling parameters, so temperature is only pinned where
 * the API still accepts it.
 */
export async function buildModel(settings: Settings): Promise<ChatModel> {
  if (settings.llm_provider === 'ollama') {
    // Self-healing: fall back to an installed model rather than erroring.
    const model = await resolveOllamaModel(settings.llm_model);
    return new ChatOllama({ model, temperature: 0 });
  }

  if (!settings.llm_model) {
    throw new Error('No model selected. Pick one in Settings → Reasoning.');
  }

  const provider = settings.llm_provider;
  const apiKey = await resolveApiKey(provider);
  switch (provider) {
    case 'groq':
      return new ChatGroq({ model: settings.llm_model, apiKey, temperature: 0 });
    case 'gemini':
      return new ChatGoogleGenerativeAI({ model: settings.llm_model, apiKey, temperature: 0 });
    case 'openai':
      return new ChatOpenAI({ model: settings.llm_model, apiKey });
    case 'anthropic':
      return new ChatAnthropic({ model: settings.llm_model, apiKey });
  }
}
