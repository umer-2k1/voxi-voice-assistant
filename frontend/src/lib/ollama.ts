/**
 * Thin client for the local Ollama server, used by Settings to make
 * local-model setup self-service: live status, installed-model list,
 * and in-app pulls with streaming progress.
 */

const OLLAMA_URL = 'http://127.0.0.1:11434';

/** The model Vox recommends for local tool calling (PRD §6). */
export const RECOMMENDED_MODEL = 'qwen3:8b';

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) {
      return { running: false, models: [] };
    }
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return { running: true, models: (data.models ?? []).map((model) => model.name) };
  } catch {
    return { running: false, models: [] };
  }
}

export interface PullProgress {
  /** e.g. "pulling manifest", "downloading", "success" */
  status: string;
  /** 0–100 when known */
  percent: number | null;
}

/**
 * Pull a model through Ollama, reporting NDJSON progress. Resolves on
 * success, throws on failure (server down, unknown model, disk full…).
 */
export async function pullModel(
  model: string,
  onProgress: (progress: PullProgress) => void
): Promise<void> {
  const response = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, stream: true })
  });
  if (!response.ok || !response.body) {
    throw new Error(`Ollama refused the download (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      reportPullLine(line, onProgress);
    }
  }
}

/** Parse one NDJSON progress line from `/api/pull` and report it. */
function reportPullLine(line: string, onProgress: (progress: PullProgress) => void): void {
  if (line.trim() === '') {
    return;
  }
  const event = JSON.parse(line) as {
    status?: string;
    error?: string;
    total?: number;
    completed?: number;
  };
  if (event.error !== undefined && event.error !== '') {
    throw new Error(event.error);
  }
  const percent =
    event.total !== undefined && event.completed !== undefined && event.total > 0
      ? Math.round((event.completed / event.total) * 100)
      : null;
  onProgress({ status: event.status ?? '', percent });
}
