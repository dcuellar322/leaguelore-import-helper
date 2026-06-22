import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { HelperSettings } from '../shared/ipc.js';
import { createSettingsSchema } from './validation.js';

const PersistedSettingsSchema = z.object({
  apiBaseUrl: z.string(),
  leagueId: z.string(),
  season: z.number()
});

const DEFAULT_SETTINGS: HelperSettings = {
  apiBaseUrl: process.env.LEAGUELORE_API_BASE ?? (app.isPackaged ? 'https://www.leagueloreapp.com' : 'http://localhost:8000'),
  importToken: process.env.LEAGUELORE_IMPORT_TOKEN ?? '',
  leagueId: '',
  season: new Date().getFullYear()
};

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
      ...persisted,
      importToken: process.env.LEAGUELORE_IMPORT_TOKEN ?? ''
    });
    return parsed;
  } catch {
    return settingsSchema().parse(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: HelperSettings): Promise<HelperSettings> {
  const parsed = settingsSchema().parse(settings);
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true });
  const { importToken: _importToken, ...persisted } = parsed;
  await writeFile(path, JSON.stringify(persisted, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return parsed;
}
