import { contextBridge, ipcRenderer } from 'electron';
import type { DeepLinkSettings, HelperSettings, ImportParams, LeagueLoreBridge, UploadParams } from '../shared/ipc.js';
import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';

const bridge: LeagueLoreBridge = {
  appVersion: () => ipcRenderer.invoke('app:version'),
  runtimeConfig: () => ipcRenderer.invoke('app:runtime-config'),
  rendererReady: () => ipcRenderer.invoke('app:renderer-ready'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: HelperSettings) => ipcRenderer.invoke('settings:save', settings),
  openEspnLogin: (params: Pick<ImportParams, 'leagueId' | 'season'>) => ipcRenderer.invoke('espn:open-login', params),
  getEspnSessionStatus: () => ipcRenderer.invoke('espn:session-status'),
  clearEspnSession: () => ipcRenderer.invoke('espn:clear-session'),
  importFromEspn: (params: ImportParams) => ipcRenderer.invoke('espn:import', params),
  createMockImport: (params: ImportParams) => ipcRenderer.invoke('mock:import', params),
  saveBundleToDisk: (bundle: LeagueLoreImportBundle) => ipcRenderer.invoke('bundle:save-to-disk', bundle),
  uploadBundle: (params: UploadParams) => ipcRenderer.invoke('bundle:upload', params),
  onDeepLink: (callback: (settings: DeepLinkSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: DeepLinkSettings) => callback(settings);
    ipcRenderer.on('app:deep-link', listener);
    return () => ipcRenderer.removeListener('app:deep-link', listener);
  }
};

contextBridge.exposeInMainWorld('leagueLore', bridge);
