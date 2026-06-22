import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';

export type SessionStatus = {
  isSignedIn: boolean;
  hasSwid: boolean;
  hasEspnS2: boolean;
  cookieCount: number;
  domains: string[];
  lastCheckedAt: string;
};

export type HelperSettings = {
  apiBaseUrl: string;
  importToken: string;
  leagueId: string;
  season?: number;
};

export type ImportParams = {
  leagueId: string;
  season?: number;
  importSessionId?: string;
};

export type UploadParams = {
  apiBaseUrl: string;
  importToken: string;
  bundle: LeagueLoreImportBundle;
};

export type UploadResult = {
  ok: boolean;
  status: number;
  message: string;
  response?: unknown;
};

export type ImportResult = {
  bundle: LeagueLoreImportBundle;
  warnings: string[];
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  isDevelopment: boolean;
  mockImportsEnabled: boolean;
};

export type DeepLinkSettings = Partial<HelperSettings>;

export type LeagueLoreBridge = {
  appVersion: () => Promise<string>;
  runtimeConfig: () => Promise<RuntimeConfig>;
  rendererReady: () => Promise<DeepLinkSettings | null>;
  getSettings: () => Promise<HelperSettings>;
  saveSettings: (settings: HelperSettings) => Promise<HelperSettings>;
  openEspnLogin: (params: Pick<ImportParams, 'leagueId' | 'season'>) => Promise<void>;
  getEspnSessionStatus: () => Promise<SessionStatus>;
  clearEspnSession: () => Promise<void>;
  importFromEspn: (params: ImportParams) => Promise<ImportResult>;
  createMockImport: (params: ImportParams) => Promise<ImportResult>;
  saveBundleToDisk: (bundle: LeagueLoreImportBundle) => Promise<{ canceled: boolean; filePath?: string }>;
  uploadBundle: (params: UploadParams) => Promise<UploadResult>;
  onDeepLink: (callback: (settings: DeepLinkSettings) => void) => () => void;
};
