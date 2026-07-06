import { useEffect } from 'react';

import { Outlet, Route, Routes } from 'react-router-dom';

import ModelBanner from '@/components/vox/model-banner';
import Sidebar from '@/components/vox/sidebar';
import Transcript from '@/components/vox/transcript';
import { startAgentBridge } from '@/lib/agent-socket';

/** Main window (route "/"): sidebar shell + Home / Connectors / Settings. */
export default function MainWindow() {
  useEffect(() => {
    startAgentBridge();
  }, []);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route
          path='connectors'
          element={
            <Placeholder title='Connectors' hint='Add and manage MCP servers — lands in M5.' />
          }
        />
        <Route
          path='settings'
          element={
            <Placeholder
              title='Settings'
              hint='Hotkey, provider and model settings — lands in M8.'
            />
          }
        />
      </Route>
    </Routes>
  );
}

function Shell() {
  return (
    <div className='bg-background flex h-dvh overflow-hidden'>
      <Sidebar />
      <main className='flex min-w-0 flex-1 flex-col'>
        <Outlet />
      </main>
    </div>
  );
}

function Home() {
  return (
    <>
      <ModelBanner />
      <div className='min-h-0 flex-1'>
        <Transcript />
      </div>
    </>
  );
}

function Placeholder({ title, hint }: Readonly<{ title: string; hint: string }>) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-2'>
      <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>{title}</h1>
      <p className='text-sm text-gray-500'>{hint}</p>
    </div>
  );
}
