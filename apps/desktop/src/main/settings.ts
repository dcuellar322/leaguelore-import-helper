import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { HelperSettings } from '../shared/ipc.js';
import { createSettingsSchema } from './validation.js';
import { defaultLeagueLoreApiBaseUrl } from '../shared/environment.js';

const PersistedSettingsSchema = z.object({
  apiBaseUrl: z.string().optional(),
  leagueId: z.string(),
  season: z.number().optional()
});

function defaultSettings(): HelperSettings {
  return {
    apiBaseUrl: process.env.LEAGUELORE_API_BASE ?? defaultLeagueLoreApiBaseUrl(app.isPackaged),
    importToken: process.env.LEAGUELORE_IMPORT_TOKEN ?? '',
    leagueId: ''
  };
}

function settingsSchema() {
  return createSettingsSchema({ allowLocalhost: !app.isPackaged });
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export async function readSettings(): Promise<HelperSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf-8');
    const persisted = PersistedSettingsSchema.parse(JSON.parse(raw));
    const parsed = settingsSchema().parse({
      ...defaultSettings(),
      ...persisted,
      apiBaseUrl: process.env.LEAGUELORE_API_BASE ?? defaultLeagueLoreApiBaseUrl(app.isPackaged),
      importToken: process.env.LEAGUELORE_IMPORT_TOKEN ?? ''
    });
    return parsed;
  } catch {
    return settingsSchema().parse(defaultSettings());
  }
}

export async function saveSettings(settings: HelperSettings): Promise<HelperSettings> {
  const parsed = settingsSchema().parse(settings);
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true });
  const { apiBaseUrl: _apiBaseUrl, importToken: _importToken, ...persisted } = parsed;
  await writeFile(path, JSON.stringify(persisted, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return parsed;
}
