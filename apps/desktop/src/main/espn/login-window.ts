import { BrowserWindow } from 'electron';
import { getEspnSession } from './cookies.js';
import { hardenWindow, isAllowedEspnAuthUrl } from '../security.js';
import { currentSeasonYear } from '../../shared/environment.js';

type OpenEspnLoginParams = {
  leagueId?: string;
  season?: number;
};

let loginWindow: BrowserWindow | null = null;

export async function openEspnLoginWindow(params: OpenEspnLoginParams): Promise<void> {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  const espnSession = getEspnSession();
  espnSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  loginWindow = new BrowserWindow({
    title: 'Sign in to ESPN - LeagueLore Import Helper',
    width: 1120,
    height: 860,
    minWidth: 900,
    minHeight: 700,
    show: false,
    backgroundColor: '#061329',
    webPreferences: {
      partition: 'leaguelore-espn-import',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !appIsPackaged()
    }
  });

  hardenWindow(loginWindow);

  loginWindow.once('ready-to-show', () => loginWindow?.show());
  loginWindow.on('closed', () => {
    loginWindow = null;
  });

  loginWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedEspnAuthUrl(url)) {
      event.preventDefault();
    }
  });

  const target = buildFantasyUrl(params);
  await loginWindow.loadURL(target);
}

function buildFantasyUrl(params: OpenEspnLoginParams): string {
  const season = params.season ?? currentSeasonYear();
  if (params.leagueId) {
    return `https://fantasy.espn.com/football/league?leagueId=${encodeURIComponent(params.leagueId)}&seasonId=${season}`;
  }
  return `https://fantasy.espn.com/football/`;
}

function appIsPackaged(): boolean {
  // This helper avoids importing app in tests and keeps this module focused.
  return process.defaultApp !== true && process.env.NODE_ENV !== 'development';
}
