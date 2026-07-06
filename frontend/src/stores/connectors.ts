import type { ConnectorConfig } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';

interface ConnectorsState {
  connectors: ConnectorConfig[];
  loaded: boolean;
  refresh: () => Promise<void>;
  add: (connector: ConnectorConfig, secret?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
}

export const useConnectorsStore = create<ConnectorsState>((set) => ({
  connectors: [],
  loaded: false,

  refresh: async () => {
    const connectors = await invoke<ConnectorConfig[]>('list_connectors');
    set({ connectors, loaded: true });
  },

  add: async (connector, secret) => {
    if (secret !== undefined && secret !== '') {
      const secretReference = `connector_${connector.id}`;
      await invoke('store_secret', { secretRef: secretReference, value: secret });
      connector = { ...connector, secret_ref: secretReference };
    }
    const connectors = await invoke<ConnectorConfig[]>('add_server', { connector });
    set({ connectors });
  },

  remove: async (id) => {
    const connectors = await invoke<ConnectorConfig[]>('remove_server', { id });
    set({ connectors });
  },

  setEnabled: async (id, enabled) => {
    const connectors = await invoke<ConnectorConfig[]>('set_connector_enabled', { id, enabled });
    set({ connectors });
  }
}));
