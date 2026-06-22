import { BrowserWindow, shell, type WebContents } from 'electron';

const TRUSTED_EXTERNAL_HOSTS = new Set([
  'www.leagueloreapp.com',
  'leagueloreapp.com',
  'github.com'
]);

const ESPN_AUTH_HOST_SUFFIXES = [
  'espn.com',
  'fantasy.espn.com',
  'lm-api-reads.fantasy.espn.com',
  'lm-api-writes.fantasy.espn.com',
  'disney.com',
  'go.com',
  'bamgrid.com'
];

export function isAllowedEspnAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ESPN_AUTH_HOST_SUFFIXES.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function hardenWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedEspnAuthUrl(url)) {
      void window.loadURL(url);
      return { action: 'deny' };
    }
    openTrustedExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedEspnAuthUrl(url)) return;
    event.preventDefault();
    openTrustedExternal(url);
  });
}

export function hardenRendererNavigation(webContents: WebContents, isAllowedInternalUrl: (url: string) => boolean): void {
  webContents.setWindowOpenHandler(({ url }) => {
    openTrustedExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (isAllowedInternalUrl(url)) return;
    event.preventDefault();
    openTrustedExternal(url);
  });
}

function openTrustedExternal(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return;
    if (TRUSTED_EXTERNAL_HOSTS.has(parsed.hostname)) {
      void shell.openExternal(url);
    }
  } catch {
    // ignore malformed URLs
  }
}
