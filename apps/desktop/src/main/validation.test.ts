import { describe, expect, it } from 'vitest';
import {
  EspnImportParamsSchema,
  EspnOpenLoginParamsSchema,
  MockImportParamsSchema,
  createSettingsSchema,
  createUploadParamsSchema,
  findDeepLinkArg,
  isAllowedLocalRendererUrl,
  normalizeApiBaseUrl,
  parseDeepLinkSettings
} from './validation.js';

describe('URL and deep-link validation', () => {
  it('normalizes production and local LeagueLore API URLs', () => {
    expect(normalizeApiBaseUrl('https://www.leagueloreapp.com/api/v1///', { allowLocalhost: false })).toBe('https://www.leagueloreapp.com/api/v1');
    expect(normalizeApiBaseUrl('http://127.0.0.1:8000/', { allowLocalhost: true })).toBe('http://127.0.0.1:8000');
  });

  it('rejects unsafe API URL shapes', () => {
    expect(() => normalizeApiBaseUrl('https://user:secret@www.leagueloreapp.com', { allowLocalhost: false })).toThrow('must not contain credentials');
    expect(() => normalizeApiBaseUrl('http://www.leagueloreapp.com', { allowLocalhost: false })).toThrow('must be https://www.leagueloreapp.com');
    expect(() => normalizeApiBaseUrl('http://example.com', { allowLocalhost: true })).toThrow('must be https://www.leagueloreapp.com');
  });

  it('parses LeagueLore import deep links into helper settings', () => {
    const settings = parseDeepLinkSettings(
      'leaguelore-import://session?apiBase=https%3A%2F%2Fwww.leagueloreapp.com&token=session-token&leagueId=123456&season=2026',
      { allowLocalhost: false }
    );

    expect(settings).toEqual({
      apiBaseUrl: 'https://www.leagueloreapp.com',
      importToken: 'session-token',
      leagueId: '123456',
      season: 2026
    });
  });

  it('ignores invalid or unrelated deep links', () => {
    expect(parseDeepLinkSettings('https://www.leagueloreapp.com', { allowLocalhost: false })).toBeNull();
    expect(parseDeepLinkSettings('leaguelore-import://session?leagueId=abc', { allowLocalhost: false })).toBeNull();
  });

  it('finds deep-link argv values from packaged and development invocations', () => {
    expect(findDeepLinkArg(['/Applications/LeagueLore Import Helper.app', 'leaguelore-import://session?leagueId=1'])).toBe('leaguelore-import://session?leagueId=1');
    expect(findDeepLinkArg(['/usr/local/bin/electron', '.', '--flag'])).toBeUndefined();
  });

  it('allows only the local Vite renderer URL in development', () => {
    expect(isAllowedLocalRendererUrl('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedLocalRendererUrl('http://localhost:5173')).toBe(true);
    expect(isAllowedLocalRendererUrl('http://localhost:5174')).toBe(false);
    expect(isAllowedLocalRendererUrl('https://localhost:5173')).toBe(false);
    expect(isAllowedLocalRendererUrl('not-a-url')).toBe(false);
  });

  it('validates persisted settings and upload parameters', () => {
    const settings = createSettingsSchema({ allowLocalhost: true }).parse({
      apiBaseUrl: 'http://localhost:8000/api/',
      importToken: '',
      leagueId: ' 123 ',
      season: '2026'
    });

    expect(settings).toEqual({
      apiBaseUrl: 'http://localhost:8000/api',
      importToken: '',
      leagueId: '123',
      season: 2026
    });

    expect(() => createUploadParamsSchema({ allowLocalhost: false }).parse({
      apiBaseUrl: 'https://www.leagueloreapp.com',
      importToken: '',
      bundle: {}
    })).toThrow();
  });

  it('validates import parameter boundaries', () => {
    expect(EspnOpenLoginParamsSchema.parse({ leagueId: '123', season: '2026' })).toEqual({ leagueId: '123', season: 2026 });
    expect(EspnImportParamsSchema.parse({ leagueId: '123', season: 2026, importSessionId: 'session-1' })).toEqual({
      leagueId: '123',
      season: 2026,
      importSessionId: 'session-1'
    });
    expect(MockImportParamsSchema.parse({ leagueId: 'mock_league-1', season: '2026' })).toEqual({ leagueId: 'mock_league-1', season: 2026 });
    expect(() => EspnImportParamsSchema.parse({ leagueId: 'abc', season: 2026 })).toThrow();
    expect(() => MockImportParamsSchema.parse({ leagueId: 'bad league', season: 2026 })).toThrow();
  });
});
