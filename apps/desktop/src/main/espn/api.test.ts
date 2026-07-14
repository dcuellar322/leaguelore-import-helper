import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cookies.js', () => ({ buildEspnCookieHeader: vi.fn().mockResolvedValue('SWID=redacted; espn_s2=redacted') }));

import { fetchEspnLeaguePayload } from './api.js';

describe('ESPN requests', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns JSON without exposing cookie values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 123 }), { status: 200 })));
    await expect(fetchEspnLeaguePayload({ leagueId: '123', season: 2026 })).resolves.toEqual({ id: 123 });
    const headers = (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.cookie).toContain('redacted');
  });

  it('turns access failures into an actionable sanitized error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('raw upstream account details', { status: 403 })));
    await expect(fetchEspnLeaguePayload({ leagueId: '123', season: 2026 })).rejects.toThrow('ESPN sign-in expired');
    await expect(fetchEspnLeaguePayload({ leagueId: '123', season: 2026 })).rejects.not.toThrow('raw upstream');
  });

  it('classifies missing leagues without retrying', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', request);
    await expect(fetchEspnLeaguePayload({ leagueId: '404', season: 2025 })).rejects.toThrow('could not find that league and season');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retries transient ESPN failures', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 123 }), { status: 200 })));
    await expect(fetchEspnLeaguePayload({ leagueId: '123', season: 2026 })).resolves.toEqual({ id: 123 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('honors cancellation without leaking request details', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private socket details')));
    await expect(fetchEspnLeaguePayload({ leagueId: '123', season: 2026 }, { signal: controller.signal })).rejects.toThrow('Import canceled.');
  });
});
