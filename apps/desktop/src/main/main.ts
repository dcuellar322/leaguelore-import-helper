import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, type IpcMainInvokeEvent } from 'electron';
import started from 'electron-squirrel-startup';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { platform } from 'node:process';
import { pathToFileURL } from 'node:url';
import { createMockImportBundle, validateImportBundle } from '@leaguelore/import-contract';
import type { DeepLinkSettings, HelperSettings, ImportParams, UploadParams } from '../shared/ipc.js';
import { currentSeasonYear, defaultLeagueLoreApiBaseUrl } from '../shared/environment.js';
import { hardenRendererNavigation, openTrustedLeagueLoreUrl, openTrustedProjectUrl, openTrustedUpdateUrl } from './security.js';
import { readSettings, saveSettings } from './settings.js';
import { clearEspnSession, getEspnSession, getEspnSessionStatus } from './espn/cookies.js';
import { closeEspnLoginWindow, openEspnLoginWindow } from './espn/login-window.js';
import { fetchEspnLeaguePayload } from './espn/api.js';
import { transformEspnPayload } from './espn/transform.js';
import { uploadBundle } from './upload.js';
import { exportDiagnostics, recordDiagnostic } from './diagnostics.js';
import { checkForUpdates } from './updates.js';
import {
  EspnImportParamsSchema,
  EspnOpenLoginParamsSchema,
  MockImportParamsSchema,
  findDeepLinkArg,
  isAllowedLocalRendererUrl,
  parseDeepLinkSettings
} from './validation.js';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: DeepLinkSettings | null = null;
let rendererReady = false;
let activeEspnImport: AbortController | null = null;
let activeUpload: AbortController | null = null;

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
  const url = findDeepLinkArg(argv);
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
  rendererReady = false;
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 760,
    minHeight: 620,
    title: 'LeagueLore Import Helper',
    backgroundColor: '#061329',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  hardenRendererNavigation(mainWindow.webContents, isTrustedRendererUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
  mainWindow.webContents.on('did-start-loading', () => {
    rendererReady = false;
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const rendererDevUrl = getRendererDevUrl();
  if (rendererDevUrl) {
    await mainWindow.loadURL(rendererDevUrl);
  } else {
    await mainWindow.loadURL('app://bundle/index.html');
  }

  if (process.argv.includes('--smoke-test')) {
    const rendered = await mainWindow.webContents.executeJavaScript(`(async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !Array.from(document.querySelectorAll('input')).some((input) => input.value === '424242')) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return {
        hasBridge: Boolean(window.leagueLore),
        hasHeading: document.body.textContent.includes('Confirm your league'),
        hasDeepLinkLeague: Array.from(document.querySelectorAll('input')).some((input) => input.value === '424242')
      };
    })()`) as { hasBridge: boolean; hasHeading: boolean; hasDeepLinkLeague: boolean };
    if (!rendered.hasBridge || !rendered.hasHeading || !rendered.hasDeepLinkLeague) {
      throw new Error(`Packaged smoke test failed: ${JSON.stringify(rendered)}`);
    }
    process.stdout.write('PACKAGED_SMOKE_OK\n');
    app.exit(0);
  }

}

function acceptDeepLink(url: string): void {
  const settings = parseDeepLinkSettings(url, { allowLocalhost: !app.isPackaged });
  if (!settings) return;
  void recordDiagnostic('deep_link_accepted', {
    hasToken: Boolean(settings.importToken),
    hasLeagueId: Boolean(settings.leagueId),
    hasSeason: Boolean(settings.season),
    hasImportSessionId: Boolean(settings.importSessionId)
  });
  notifyDeepLink(settings);
}

function notifyDeepLink(settings: DeepLinkSettings): void {
  if (!mainWindow || mainWindow.isDestroyed() || !rendererReady) {
    pendingDeepLink = settings;
    return;
  }
  mainWindow.webContents.send('app:deep-link', settings);
}

app.whenReady().then(async () => {
  if (app.isPackaged) Menu.setApplicationMenu(null);
  protocol.handle('app', handleAppProtocolRequest);
  const espnSession = getEspnSession();
  espnSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  registerIpcHandlers();
  const initialDeepLink = findDeepLinkArg(process.argv);
  if (initialDeepLink) acceptDeepLink(initialDeepLink);
  await createWindow();
  await recordDiagnostic('app_ready', { version: app.getVersion(), platform, packaged: app.isPackaged });
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
  handleTrusted('app:runtime-config', () => ({
    apiBaseUrl: process.env.LEAGUELORE_API_BASE ?? defaultLeagueLoreApiBaseUrl(app.isPackaged),
    isDevelopment: !app.isPackaged,
    mockImportsEnabled: !app.isPackaged
  }));
  handleTrusted('app:renderer-ready', () => {
    rendererReady = true;
    const settings = pendingDeepLink;
    pendingDeepLink = null;
    return settings;
  });
  handleTrusted('settings:get', () => readSettings());
  handleTrusted('settings:save', (settings: HelperSettings) => saveSettings(settings));
  handleTrusted('espn:open-login', (params: Pick<ImportParams, 'leagueId' | 'season'>) => {
    const parsedParams = EspnOpenLoginParamsSchema.parse(params);
    return openEspnLoginWindow(parsedParams);
  });
  handleTrusted('espn:session-status', () => getEspnSessionStatus());
  handleTrusted('espn:clear-session', async () => {
    closeEspnLoginWindow();
    await clearEspnSession();
  });
  handleTrusted('espn:import', async (params: ImportParams) => {
    const parsedParams = EspnImportParamsSchema.parse(params);
    const season = parsedParams.season ?? currentSeasonYear();
    activeEspnImport?.abort();
    const controller = new AbortController();
    activeEspnImport = controller;
    closeEspnLoginWindow();
    await recordDiagnostic('espn_import_started', { season, hasImportSessionId: Boolean(parsedParams.importSessionId) });
    try {
      const payload = await fetchEspnLeaguePayload({ leagueId: parsedParams.leagueId, season }, { signal: controller.signal });
      const bundle = transformEspnPayload(payload, {
        leagueId: parsedParams.leagueId,
        season,
        importSessionId: parsedParams.importSessionId,
        helperVersion: app.getVersion(),
        platform
      });
      await recordDiagnostic('espn_import_completed', { teams: bundle.teams.length, rosters: bundle.rosterEntries.length, matchups: bundle.matchups.length, warnings: bundle.metadata.warnings.length });
      return { bundle, warnings: bundle.metadata.warnings };
    } catch (error) {
      await recordDiagnostic('espn_import_failed', { reason: error instanceof Error && error.message === 'Import canceled.' ? 'canceled' : 'request_or_validation_error' });
      throw error;
    } finally {
      if (activeEspnImport === controller) activeEspnImport = null;
    }
  });
  handleTrusted('espn:cancel-import', () => {
    activeEspnImport?.abort();
  });
  handleTrusted('mock:import', (params: ImportParams) => {
    const parsedParams = MockImportParamsSchema.parse(params);
    const season = parsedParams.season ?? currentSeasonYear();
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
        season,
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
  handleTrusted('bundle:upload', async (params: UploadParams) => {
    activeUpload?.abort();
    const controller = new AbortController();
    activeUpload = controller;
    try {
      const result = await uploadBundle(params, controller.signal);
      await recordDiagnostic('bundle_upload_finished', { ok: result.ok, status: result.status, code: result.code });
      return result;
    } finally {
      if (activeUpload === controller) activeUpload = null;
    }
  });
  handleTrusted('bundle:cancel-upload', () => {
    activeUpload?.abort();
  });
  handleTrusted('app:open-leaguelore-url', (url: string) => openTrustedLeagueLoreUrl(url));
  handleTrusted('app:open-update-url', (url: string) => openTrustedUpdateUrl(url));
  handleTrusted('app:open-project-url', (url: string) => openTrustedProjectUrl(url));
  handleTrusted('app:check-for-updates', () => checkForUpdates());
  handleTrusted('diagnostics:save', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Save privacy-safe diagnostics',
      defaultPath: join(app.getPath('documents'), `leaguelore-import-helper-diagnostics-${new Date().toISOString().slice(0, 10)}.jsonl`),
      filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await exportDiagnostics(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });
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
  if (url === 'app://bundle/index.html') return true;
  return !app.isPackaged && isAllowedLocalRendererUrl(url);
}

function handleAppProtocolRequest(request: Request): Promise<Response> {
  const parsed = new URL(request.url);
  if (parsed.host !== 'bundle') return Promise.resolve(new Response('Not found', { status: 404 }));
  const rendererRoot = resolve(__dirname, '../renderer');
  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '') || 'index.html';
  const filePath = resolve(rendererRoot, relativePath);
  if (filePath !== rendererRoot && !filePath.startsWith(`${rendererRoot}${sep}`)) {
    return Promise.resolve(new Response('Not found', { status: 404 }));
  }
  return net.fetch(pathToFileURL(filePath).toString());
}
