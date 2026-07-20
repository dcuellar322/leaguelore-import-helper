import { describe, expect, it, vi } from 'vitest';
import type { DeepLinkSettings, LeagueLoreBridge } from '../shared/ipc.js';

const electron = vi.hoisted(() => {
  let bridge: LeagueLoreBridge | undefined;
  const invoke = vi.fn(async (_channel: string, ..._args: unknown[]) => undefined);
  const on = vi.fn((_channel: string, _listener: (event: unknown, settings: DeepLinkSettings) => void) => undefined);
  const removeListener = vi.fn(
    (_channel: string, _listener: (event: unknown, settings: DeepLinkSettings) => void) => undefined
  );
  return {
    contextBridge: {
      exposeInMainWorld: vi.fn((_name: string, value: LeagueLoreBridge) => {
        bridge = value;
      })
    },
    ipcRenderer: { invoke, on, removeListener },
    getBridge: () => bridge
  };
});

vi.mock('electron', () => ({
  contextBridge: electron.contextBridge,
  ipcRenderer: electron.ipcRenderer
}));

import './preload.js';

describe('preload bridge', () => {
  it('exposes only the typed IPC methods and forwards their arguments', async () => {
    const bridge = electron.getBridge();
    expect(bridge).toBeDefined();
    if (!bridge) return;

    await bridge.appVersion();
    await bridge.runtimeConfig();
    await bridge.rendererReady();
    await bridge.getSettings();
    await bridge.saveSettings({ apiBaseUrl: 'http://localhost:15173', importToken: '', leagueId: '123' });
    await bridge.openEspnLogin({ leagueId: '123', season: 2025 });
    await bridge.getEspnSessionStatus();
    await bridge.clearEspnSession();
    await bridge.importFromEspn({ leagueId: '123', season: 2025 });
    await bridge.cancelEspnImport();
    await bridge.createMockImport({ leagueId: 'mock', season: 2025 });
    await bridge.saveBundleToDisk({} as never);
    await bridge.uploadBundle({} as never);
    await bridge.cancelUpload();
    await bridge.openLeagueLoreUrl('https://www.leagueloreapp.com/imports/1');
    await bridge.openUpdateUrl('https://github.com/dcuellar322/leaguelore-import-helper/releases/1');
    await bridge.openProjectUrl('https://github.com/dcuellar322/leaguelore-import-helper/');
    await bridge.checkForUpdates();
    await bridge.saveDiagnostics();

    expect(electron.ipcRenderer.invoke.mock.calls.map(([channel]) => channel)).toEqual([
      'app:version',
      'app:runtime-config',
      'app:renderer-ready',
      'settings:get',
      'settings:save',
      'espn:open-login',
      'espn:session-status',
      'espn:clear-session',
      'espn:import',
      'espn:cancel-import',
      'mock:import',
      'bundle:save-to-disk',
      'bundle:upload',
      'bundle:cancel-upload',
      'app:open-leaguelore-url',
      'app:open-update-url',
      'app:open-project-url',
      'app:check-for-updates',
      'diagnostics:save'
    ]);
  });

  it('subscribes and unsubscribes deep-link callbacks without exposing ipcRenderer', () => {
    const bridge = electron.getBridge();
    if (!bridge) throw new Error('Bridge was not exposed.');
    const callback = vi.fn();
    const unsubscribe = bridge.onDeepLink(callback);
    const listener = electron.ipcRenderer.on.mock.calls.at(-1)?.[1] as
      ((event: unknown, settings: DeepLinkSettings) => void) | undefined;
    const settings = { leagueId: '123', season: 2025 };
    listener?.({}, settings);
    expect(callback).toHaveBeenCalledWith(settings);

    unsubscribe();
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith('app:deep-link', listener);
  });
});
