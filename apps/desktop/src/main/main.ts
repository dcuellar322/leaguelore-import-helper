import { app, BrowserWindow, dialog, ipcMain, protocol, type IpcMainInvokeEvent } from 'electron';
import started from 'electron-squirrel-startup';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';
import { createMockImportBundle, validateImportBundle } from '@leaguelore/import-contract';
import type { DeepLinkSettings, HelperSettings, ImportParams, UploadParams } from '../shared/ipc.js';
import { hardenRendererNavigation } from './security.js';
import { readSettings, saveSettings } from './settings.js';
import { clearEspnSession, getEspnSession, getEspnSessionStatus } from './espn/cookies.js';
import { openEspnLoginWindow } from './espn/login-window.js';
import { fetchEspnLeaguePayload } from './espn/api.js';
import { transformEspnPayload } from './espn/transform.js';
import { uploadBundle } from './upload.js';
import {
  EspnImportParamsSchema,
  EspnOpenLoginParamsSchema,
  MockImportParamsSchema,
  isAllowedLocalRendererUrl,
  parseDeepLinkSettings
} from './validation.js';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: DeepLinkSettings | null = null;

const protocolName = 'leaguelore-import';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(protocolName, process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient(protocolName);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith(`${protocolName}://`));
  if (url) acceptDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  acceptDeepLink(url);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true
    }
  }
]);

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: 'LeagueLore Import Helper',
    backgroundColor: '#07170f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  hardenRendererNavigation(mainWindow.webContents, isTrustedRendererUrl);

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const rendererDevUrl = getRendererDevUrl();
  if (rendererDevUrl) {
    await mainWindow.loadURL(rendererDevUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (pendingDeepLink) {
    notifyDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  }
}

function acceptDeepLink(url: string): void {
  const settings = parseDeepLinkSettings(url, { allowLocalhost: !app.isPackaged });
  if (!settings) return;
  notifyDeepLink(settings);
}

function notifyDeepLink(settings: DeepLinkSettings): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = settings;
    return;
  }
  mainWindow.webContents.send('app:deep-link', settings);
}

app.whenReady().then(async () => {
  const espnSession = getEspnSession();
  espnSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  registerIpcHandlers();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

function registerIpcHandlers(): void {
  handleTrusted('app:version', () => app.getVersion());
  handleTrusted('settings:get', () => readSettings());
  handleTrusted('settings:save', (settings: HelperSettings) => saveSettings(settings));
  handleTrusted('espn:open-login', (params: Pick<ImportParams, 'leagueId' | 'season'>) => {
    const parsedParams = EspnOpenLoginParamsSchema.parse(params);
    return openEspnLoginWindow(parsedParams);
  });
  handleTrusted('espn:session-status', () => getEspnSessionStatus());
  handleTrusted('espn:clear-session', () => clearEspnSession());
  handleTrusted('espn:import', async (params: ImportParams) => {
    const parsedParams = EspnImportParamsSchema.parse(params);
    const payload = await fetchEspnLeaguePayload({ leagueId: parsedParams.leagueId, season: parsedParams.season });
    const bundle = transformEspnPayload(payload, {
      leagueId: parsedParams.leagueId,
      season: parsedParams.season,
      importSessionId: parsedParams.importSessionId,
      helperVersion: app.getVersion(),
      platform
    });
    return { bundle, warnings: bundle.metadata.warnings };
  });
  handleTrusted('mock:import', (params: ImportParams) => {
    const parsedParams = MockImportParamsSchema.parse(params);
    const bundle = createMockImportBundle({
      metadata: {
        contractVersion: '0.1.0',
        source: 'mock',
        generatedAt: new Date().toISOString(),
        helper: {
          name: 'LeagueLore Import Helper',
          version: app.getVersion(),
          platform
        },
        importSessionId: parsedParams.importSessionId,
        warnings: ['Mock import generated locally. No ESPN request was made.']
      },
      league: {
        externalRef: { provider: 'mock', externalId: parsedParams.leagueId },
        name: 'LeagueLore Demo League',
        season: parsedParams.season,
        size: 2,
        visibility: 'private',
        settings: { mode: 'mock' }
      }
    });
    return { bundle, warnings: bundle.metadata.warnings };
  });
  handleTrusted('bundle:save-to-disk', async (input: unknown) => {
    const bundle = validateImportBundle(input);
    const defaultPath = join(app.getPath('documents'), `leaguelore-import-${bundle.league.season}-${bundle.league.externalRef.externalId}.json`);
    const result = await dialog.showSaveDialog({
      title: 'Save LeagueLore Import Bundle',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await mkdir(dirname(result.filePath), { recursive: true }).catch(() => undefined);
    await writeFile(result.filePath, JSON.stringify(bundle, null, 2), 'utf-8');
    return { canceled: false, filePath: result.filePath };
  });
  handleTrusted('bundle:upload', (params: UploadParams) => uploadBundle(params));
}

function handleTrusted<Args extends unknown[]>(channel: string, listener: (...args: Args) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event);
    return listener(...(args as Args));
  });
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url ?? event.sender.getURL();
  if (!isTrustedRendererUrl(frameUrl)) {
    throw new Error('Rejected IPC call from an untrusted renderer.');
  }
}

function getRendererDevUrl(): string | null {
  const url = process.env.ELECTRON_RENDERER_URL;
  if (!url || app.isPackaged || !isAllowedLocalRendererUrl(url)) return null;
  return url;
}

function isTrustedRendererUrl(url: string): boolean {
  if (url.startsWith('file://')) return true;
  return !app.isPackaged && isAllowedLocalRendererUrl(url);
}
