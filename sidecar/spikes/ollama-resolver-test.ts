import { ollamaStatus, pickModel, resolveOllamaModel } from '../src/agent/ollama.js';

const status = await ollamaStatus();
console.log('status:', JSON.stringify(status));
if (status.running) {
  const resolved = await resolveOllamaModel('qwen3:8b');
  console.log('configured qwen3:8b resolved to:', resolved);
}
console.log('pick with empty:', pickModel('qwen3:8b', []));
console.log('pick exact:', pickModel('a:1', ['b:2', 'a:1']));
console.log('pick family:', pickModel('qwen3:8b', ['mistral:7b', 'qwen3:1.7b']));
console.log('pick tool-capable:', pickModel('nope:1', ['gemma:2b', 'llama3.1:8b']));
