import { useCallback, useEffect, useState } from 'react';

import type { OllamaStatus, PullProgress } from '@/lib/ollama';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getOllamaStatus, pullModel, RECOMMENDED_MODEL } from '@/lib/ollama';

/**
 * Self-service local model setup: live Ollama status, a dropdown of
 * installed models, and a one-click in-app pull of the recommended
 * tool-calling model — no terminal required. Used by Settings and the
 * first-run onboarding wizard.
 */
export default function OllamaModelPicker({
  value,
  onChange
}: Readonly<{ value: string; onChange: (model: string) => void }>) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [pull, setPull] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getOllamaStatus().then(setStatus);
  }, []);

  useEffect(refresh, [refresh]);

  const download = async () => {
    setPullError(null);
    setPull({ status: 'starting…', percent: null });
    try {
      await pullModel(RECOMMENDED_MODEL, setPull);
      onChange(RECOMMENDED_MODEL);
      refresh();
    } catch (error) {
      setPullError(error instanceof Error ? error.message : String(error));
    } finally {
      setPull(null);
    }
  };

  if (status === null) {
    return null;
  }

  if (!status.running) {
    return (
      <div className='border-caution-line bg-caution-bg flex max-w-sm items-center justify-between gap-3 rounded-md border px-3 py-2'>
        <p className='text-sm text-gray-700'>
          Ollama isn&apos;t running — start the Ollama app, then re-check.
        </p>
        <Button size='sm' variant='outline' onClick={refresh}>
          Re-check
        </Button>
      </div>
    );
  }

  const installed = status.models;

  return (
    <div className='flex max-w-sm flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <span className='bg-success size-2 rounded-full' aria-hidden />
        <span className='mono-label text-gray-500'>
          ollama running · {installed.length} model{installed.length === 1 ? '' : 's'} installed
        </span>
      </div>

      {installed.length > 0 ? (
        <InstalledModelSelect value={value} installed={installed} onChange={onChange} />
      ) : (
        <p className='text-sm text-gray-700'>No models installed yet.</p>
      )}

      {installed.includes(RECOMMENDED_MODEL) ? null : (
        <div className='flex flex-col gap-1.5'>
          {pull === null ? (
            <Button size='sm' variant='outline' className='w-fit' onClick={() => void download()}>
              Download {RECOMMENDED_MODEL} (recommended, ~5 GB)
            </Button>
          ) : (
            <p className='mono-label text-vox-700'>
              {pull.status}
              {pull.percent === null ? '' : ` · ${pull.percent}%`}
            </p>
          )}
          {pullError === null ? null : <p className='text-danger text-xs'>{pullError}</p>}
        </div>
      )}
    </div>
  );
}

function InstalledModelSelect({
  value,
  installed,
  onChange
}: Readonly<{ value: string; installed: string[]; onChange: (model: string) => void }>) {
  const missing = !installed.includes(value);
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor='ollama-model'>Model</Label>
      <select
        id='ollama-model'
        className='h-9 rounded-md border border-gray-300 bg-white px-2.5 font-mono text-xs text-gray-700'
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {missing ? <option value={value}>{value} (not installed)</option> : null}
        {installed.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      {missing ? (
        <p className='text-caution-text text-xs'>
          {value} isn&apos;t installed — Vox will use the closest installed model until you pick
          one.
        </p>
      ) : null}
    </div>
  );
}
