import { ChatGroq } from '@langchain/groq';
import { ChatOllama } from '@langchain/ollama';
import type { Settings } from '@vox/protocol';

import { coreBridge } from '../core-bridge.js';
import { resolveOllamaModel } from './ollama.js';

/** Well-known keychain reference for the Groq API key (PRD §8.3). */
export const GROQ_KEY_REF = 'groq_api_key';

export type ChatModel = ChatGroq | ChatOllama;

/**
 * One OpenAI-compatible provider abstraction: Groq ↔ Ollama is a settings
 * value, never a code branch elsewhere (PRD P4 / S7).
 */
export async function buildModel(settings: Settings): Promise<ChatModel> {
  if (settings.llm_provider === 'ollama') {
    // Self-healing: fall back to an installed model rather than erroring.
    const model = await resolveOllamaModel(settings.llm_model);
    return new ChatOllama({ model, temperature: 0 });
  }

  // Dev convenience first, keychain second.
  const apiKey =
    process.env['GROQ_API_KEY'] ?? (await coreBridge.getSecret(GROQ_KEY_REF)) ?? undefined;
  if (!apiKey) {
    throw new Error('No Groq API key found. Paste one in Settings, or switch to Ollama.');
  }
  return new ChatGroq({ model: settings.llm_model, apiKey, temperature: 0 });
}
