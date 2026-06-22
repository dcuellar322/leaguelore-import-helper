import { z } from 'zod';
import type { HelperSettings } from '../shared/ipc.js';

const PRODUCTION_API_HOSTS = new Set(['leagueloreapp.com', 'www.leagueloreapp.com']);
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEEP_LINK_PROTOCOL = 'leaguelore-import:';

type UrlValidationOptions = {
  allowLocalhost: boolean;
};

export const SeasonSchema = z.coerce.number().int().min(2000).max(2100);

export const EspnLeagueIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/, 'ESPN league ID must be numeric.');

const MockLeagueIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Mock league ID can only contain letters, numbers, underscores, and hyphens.');

const ImportSessionIdSchema = z.string().trim().min(1).max(128).optional();

const ImportTokenSchema = z.string().trim().min(1).max(4096);
const OptionalImportTokenSchema = z.string().trim().max(4096);

export function normalizeApiBaseUrl(input: string, options: UrlValidationOptions): string {
  const parsed = new URL(input.trim());

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('LeagueLore API URL must not contain credentials, query parameters, or fragments.');
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  const normalized = `${parsed.origin}${path}`;

  if (parsed.protocol === 'https:' && PRODUCTION_API_HOSTS.has(parsed.hostname)) {
    return normalized;
  }

  if (options.allowLocalhost && (parsed.protocol === 'http:' || parsed.protocol === 'https:') && LOCAL_API_HOSTS.has(parsed.hostname)) {
    return normalized;
  }

  throw new Error('LeagueLore API URL must be https://www.leagueloreapp.com or a local development URL.');
}

export function isAllowedLocalRendererUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' && LOCAL_API_HOSTS.has(parsed.hostname) && parsed.port === '5173';
  } catch {
    return false;
  }
}

export function findDeepLinkArg(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(DEEP_LINK_PROTOCOL));
}

export function createSettingsSchema(options: UrlValidationOptions) {
  return z.object({
    apiBaseUrl: z.string().transform((value) => normalizeApiBaseUrl(value, options)),
    importToken: OptionalImportTokenSchema,
    leagueId: z.string().trim().max(64),
    season: SeasonSchema
  });
}

export const EspnOpenLoginParamsSchema = z.object({
  leagueId: EspnLeagueIdSchema.optional(),
  season: SeasonSchema.optional()
});

export const EspnImportParamsSchema = z.object({
  leagueId: EspnLeagueIdSchema,
  season: SeasonSchema,
  importSessionId: ImportSessionIdSchema
});

export const MockImportParamsSchema = z.object({
  leagueId: MockLeagueIdSchema,
  season: SeasonSchema,
  importSessionId: ImportSessionIdSchema
});

export function createUploadParamsSchema(options: UrlValidationOptions) {
  return z.object({
    apiBaseUrl: z.string().transform((value) => normalizeApiBaseUrl(value, options)),
    importToken: ImportTokenSchema,
    bundle: z.unknown()
  });
}

export function parseDeepLinkSettings(input: string, options: UrlValidationOptions): Partial<HelperSettings> | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== DEEP_LINK_PROTOCOL) return null;

    const settings: Partial<HelperSettings> = {};
    const apiBaseUrl = parsed.searchParams.get('apiBase');
    const importToken = parsed.searchParams.get('token');
    const leagueId = parsed.searchParams.get('leagueId');
    const season = parsed.searchParams.get('season');

    if (apiBaseUrl) settings.apiBaseUrl = normalizeApiBaseUrl(apiBaseUrl, options);
    if (importToken) settings.importToken = ImportTokenSchema.parse(importToken);
    if (leagueId) settings.leagueId = EspnLeagueIdSchema.parse(leagueId);
    if (season) settings.season = SeasonSchema.parse(season);

    return settings;
  } catch {
    return null;
  }
}
