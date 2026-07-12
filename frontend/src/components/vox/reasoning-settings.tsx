import { useEffect, useState } from 'react';

import type { LlmTestResult, ModelsListResult } from '@/lib/agent-socket';
import type { LlmProvider, Settings } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OllamaModelPicker from '@/components/vox/ollama-model-picker';
import { listProviderModels, testLlmConnection } from '@/lib/agent-socket';

interface ProviderMeta {
  key: LlmProvider;
  label: string;
  /** Keychain reference for the API key; null = no key needed (local). */
  secretRef: string | null;
  placeholder: string;
  consoleUrl: string;
  consoleHost: string;
  /** Applied when switching to the provider; '' forces a pick from the live list. */
  defaultModel: string;
}

const GROQ_META: ProviderMeta = {
  key: 'groq',
  label: 'Groq',
  secretRef: 'groq_api_key',
  placeholder: 'gsk_…',
  consoleUrl: 'https://console.groq.com/keys',
  consoleHost: 'console.groq.com',
  defaultModel: 'llama-3.1-8b-instant'
};

const PROVIDERS: ProviderMeta[] = [
  GROQ_META,
  {
    key: 'openai',
    label: 'OpenAI',
    secretRef: 'openai_api_key',
    placeholder: 'sk-…',
    consoleUrl: 'https://platform.openai.com/api-keys',
    consoleHost: 'platform.openai.com',
    defaultModel: ''
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    secretRef: 'anthropic_api_key',
    placeholder: 'sk-ant-…',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    consoleHost: 'console.anthropic.com',
    defaultModel: 'claude-opus-4-8'
  },
  {
    key: 'gemini',
    label: 'Gemini',
    secretRef: 'gemini_api_key',
    placeholder: 'AIza…',
    consoleUrl: 'https://aistudio.google.com/apikey',
    consoleHost: 'aistudio.google.com',
    defaultModel: ''
  },
  {
    key: 'ollama',
    label: 'Ollama (local)',
    secretRef: null,
    placeholder: '',
    consoleUrl: '',
    consoleHost: '',
    defaultModel: 'qwen3:8b'
  }
];

/**
 * Settings → Reasoning: provider picker, keychain-backed API key
 * management, a model dropdown fetched live from the provider's own
 * list-models API (nothing hardcoded), and a connection smoke test.
 */
export default function ReasoningSettings({
  settings,
  update
}: Readonly<{ settings: Settings; update: (patch: Partial<Settings>) => Promise<void> }>) {
  const meta = PROVIDERS.find((p) => p.key === settings.llm_provider) ?? GROQ_META;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        {PROVIDERS.map((provider) => (
          <Button
            key={provider.key}
            size='sm'
            variant={settings.llm_provider === provider.key ? 'default' : 'outline'}
            onClick={() => {
              void update({ llm_provider: provider.key, llm_model: provider.defaultModel });
            }}
          >
            {provider.label}
          </Button>
        ))}
      </div>

      {meta.key === 'ollama' ? (
        <OllamaModelPicker
          value={settings.llm_model}
          onChange={(model) => {
            void update({ llm_model: model });
          }}
        />
      ) : (
        <CloudProviderConfig
          key={meta.key}
          meta={meta}
          model={settings.llm_model}
          onModelChange={(model) => {
            void update({ llm_model: model });
          }}
          pushSettings={() => {
            // Same settings, re-pushed: the sidecar rebuilds its provider
            // and picks up the key that just changed in the keychain.
            void invoke('update_settings', { settings });
          }}
        />
      )}

      <TestConnectionRow model={settings.llm_model} />
    </div>
  );
}

/** Everything that only exists for cloud providers: key row + live model list. */
function CloudProviderConfig({
  meta,
  model,
  onModelChange,
  pushSettings
}: Readonly<{
  meta: ProviderMeta;
  model: string;
  onModelChange: (model: string) => void;
  pushSettings: () => void;
}>) {
  // null = still checking the keychain.
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  // Bumped on save/remove/refresh so the model list re-fetches.
  const [keyVersion, setKeyVersion] = useState(0);

  const secretReference = meta.secretRef ?? '';

  useEffect(() => {
    let cancelled = false;
    void invoke<boolean>('has_secret', { secretRef: secretReference }).then((value) => {
      if (!cancelled) {
        setHasKey(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [secretReference, keyVersion]);

  return (
    <>
      <ApiKeyRow
        meta={meta}
        hasKey={hasKey}
        onChanged={() => {
          setKeyVersion((v) => v + 1);
          pushSettings();
        }}
      />
      <CloudModelPicker
        provider={meta.key}
        hasKey={hasKey}
        keyVersion={keyVersion}
        value={model}
        onChange={onModelChange}
        onRefresh={() => {
          setKeyVersion((v) => v + 1);
        }}
      />
    </>
  );
}

/**
 * API key management. The key is write-only by design: it goes straight
 * into the OS keychain and can never be read back into this window —
 * which is why the field clears after saving. Status + remove are the
 * only operations that exist.
 */
function ApiKeyRow({
  meta,
  hasKey,
  onChanged
}: Readonly<{ meta: ProviderMeta; hasKey: boolean | null; onChanged: () => void }>) {
  const [draft, setDraft] = useState('');

  const save = () => {
    void invoke('store_secret', { secretRef: meta.secretRef, value: draft }).then(() => {
      setDraft('');
      onChanged();
    });
  };

  let keyStatus = 'not set';
  if (hasKey === null) {
    keyStatus = 'checking…';
  } else if (hasKey) {
    keyStatus = 'saved · encrypted in the OS keychain';
  }

  return (
    <div className='flex max-w-sm flex-col gap-1.5'>
      <Label htmlFor='provider-key'>
        {meta.label} API key <span className='mono-label ml-1 text-gray-400'>{keyStatus}</span>
      </Label>
      <div className='flex gap-2'>
        <Input
          id='provider-key'
          type='password'
          placeholder={hasKey === true ? 'paste a new key to replace' : meta.placeholder}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <Button disabled={draft === ''} onClick={save}>
          Save
        </Button>
        {hasKey === true ? (
          <Button
            variant='outline'
            onClick={() => {
              void invoke('delete_secret', { secretRef: meta.secretRef }).then(onChanged);
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <p className='text-xs text-gray-500'>
        Stored once in the keychain, never shown again — that&rsquo;s why the field clears. Get a
        key at{' '}
        <a
          className='text-vox-600 underline'
          href={meta.consoleUrl}
          target='_blank'
          rel='noreferrer'
        >
          {meta.consoleHost}
        </a>
        .
      </p>
    </div>
  );
}

/** Model dropdown fed by the provider's live list-models API. */
function CloudModelPicker({
  provider,
  hasKey,
  keyVersion,
  value,
  onChange,
  onRefresh
}: Readonly<{
  provider: LlmProvider;
  hasKey: boolean | null;
  keyVersion: number;
  value: string;
  onChange: (model: string) => void;
  onRefresh: () => void;
}>) {
  const [snapshot, setSnapshot] = useState<{ version: number; result: ModelsListResult } | null>(
    null
  );

  useEffect(() => {
    if (hasKey !== true) {
      return;
    }
    let cancelled = false;
    void listProviderModels(provider).then((result) => {
      if (!cancelled) {
        setSnapshot({ version: keyVersion, result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, hasKey, keyVersion]);

  if (hasKey === false) {
    return (
      <p className='text-caution-text max-w-sm text-xs'>
        Save an API key above and the model list loads automatically.
      </p>
    );
  }

  const loading = hasKey === null || snapshot?.version !== keyVersion;
  if (loading) {
    return <p className='mono-label text-gray-500'>fetching models…</p>;
  }

  const { result } = snapshot;
  if (!result.ok || result.models.length === 0) {
    const detail = result.error === undefined ? '' : ` (${result.error})`;
    return (
      <div className='flex max-w-sm flex-col gap-1.5'>
        <Label htmlFor='llm-model'>Model</Label>
        <ModelTextInput value={value} onChange={onChange} />
        <p className='text-danger text-xs'>
          Couldn&rsquo;t load the model list{detail} — type a model id, or{' '}
          <button type='button' className='underline' onClick={onRefresh}>
            retry
          </button>
          .
        </p>
      </div>
    );
  }

  const missing = value !== '' && !result.models.includes(value);
  return (
    <div className='flex max-w-sm flex-col gap-1.5'>
      <Label htmlFor='llm-model'>Model</Label>
      <div className='flex items-center gap-2'>
        <select
          id='llm-model'
          className='h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 font-mono text-xs text-gray-700'
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          {value === '' ? (
            <option value='' disabled>
              Select a model…
            </option>
          ) : null}
          {missing ? <option value={value}>{value} (custom)</option> : null}
          {result.models.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <Button size='sm' variant='outline' onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      <p className='text-xs text-gray-500'>
        {result.models.length} models available to your key, fetched live.
      </p>
    </div>
  );
}

function ModelTextInput({
  value,
  onChange
}: Readonly<{ value: string; onChange: (model: string) => void }>) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      id='llm-model'
      value={draft}
      placeholder='model id'
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (draft !== value) {
          onChange(draft);
        }
      }}
    />
  );
}

/** One-token round trip through the saved provider/model/key. */
function TestConnectionRow({ model }: Readonly<{ model: string }>) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<LlmTestResult | null>(null);

  const run = async () => {
    setTesting(true);
    setResult(null);
    setResult(await testLlmConnection());
    setTesting(false);
  };

  return (
    <div className='border-gray-150 flex flex-col gap-1.5 border-t pt-3'>
      <div className='flex items-center gap-3'>
        <Button
          size='sm'
          variant='outline'
          disabled={testing || model === ''}
          onClick={() => {
            void run();
          }}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        {result === null ? null : <TestOutcome result={result} />}
      </div>
      <p className='text-xs text-gray-500'>
        Sends one tiny request with the saved key and model to prove the setup works.
      </p>
    </div>
  );
}

function TestOutcome({ result }: Readonly<{ result: LlmTestResult }>) {
  if (!result.ok) {
    return <span className='text-danger max-w-md text-xs'>{result.error}</span>;
  }
  const latency = result.latency_ms === undefined ? '' : ` · ${String(result.latency_ms)} ms`;
  return (
    <span className='mono-label text-success'>
      connected · {result.model}
      {latency}
    </span>
  );
}
