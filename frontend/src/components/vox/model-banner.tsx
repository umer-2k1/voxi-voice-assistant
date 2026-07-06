import { useEffect, useState } from 'react';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DownloadProgress {
  model: string;
  downloaded: number;
  total: number | null;
  done: boolean;
}

type ModelStatus = 'checking' | 'downloading' | 'ready' | 'error';

/** First-run STT model download banner shown on Home until the model is local. */
export default function ModelBanner() {
  const [status, setStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    const unlisten = listen<DownloadProgress>('model-download-progress', (event) => {
      setProgress(event.payload);
    });

    void (async () => {
      try {
        const settings = await invoke<{ stt_model: string }>('get_settings');
        const present = await invoke<boolean>('check_stt_model', { model: settings.stt_model });
        if (present) {
          setStatus('ready');
          return;
        }
        setStatus('downloading');
        await invoke('download_stt_model', { model: settings.stt_model });
        setStatus('ready');
      } catch (error) {
        console.error(error);
        setStatus('error');
      }
    })();

    return () => {
      void unlisten.then((dispose) => {
        dispose();
      });
    };
  }, []);

  if (status === 'ready') {
    return null;
  }

  const pct = progress?.total ? Math.round((progress.downloaded / progress.total) * 100) : null;

  return (
    <div className='border-caution-line bg-caution-bg mx-8 mt-4 flex items-center gap-3 rounded-lg border px-4 py-3'>
      {status === 'checking' && <p className='text-caution-text text-sm'>Checking speech model…</p>}
      {status === 'downloading' && (
        <>
          <p className='text-caution-text shrink-0 text-sm'>
            Downloading speech model{pct === null ? '…' : ` — ${pct}%`}
          </p>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-white'>
            <div
              className='bg-caution h-full rounded-full transition-[width] duration-200'
              style={{ width: `${pct ?? 5}%` }}
            />
          </div>
        </>
      )}
      {status === 'error' && (
        <p className='text-danger text-sm'>Speech model download failed — check your connection.</p>
      )}
    </div>
  );
}
