import { useEffect } from 'react';

import { Outlet, Route, Routes } from 'react-router-dom';

import ModelBanner from '@/components/vox/model-banner';
import PermissionsBanner from '@/components/vox/permissions-banner';
import Sidebar from '@/components/vox/sidebar';
import Transcript from '@/components/vox/transcript';
import { startAgentBridge } from '@/lib/agent-socket';
import ConnectorsView from '@/windows/connectors';
import SettingsView from '@/windows/settings';

/** Main window (route "/"): sidebar shell + Home / Connectors / Settings. */
export default function MainWindow() {
  useEffect(() => {
    startAgentBridge();
  }, []);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path='connectors' element={<ConnectorsView />} />
        <Route path='settings' element={<SettingsView />} />
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
      <PermissionsBanner />
      <ModelBanner />
      <div className='min-h-0 flex-1'>
        <Transcript />
      </div>
    </>
  );
}
