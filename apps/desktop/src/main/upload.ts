import { app } from 'electron';
import { validateImportBundle } from '@leaguelore/import-contract';
import type { UploadParams, UploadResult } from '../shared/ipc.js';
import { createUploadParamsSchema, normalizeLeagueLoreNavigationUrl } from './validation.js';

export async function uploadBundle(params: UploadParams, signal?: AbortSignal): Promise<UploadResult> {
  const parsedParams = createUploadParamsSchema({ allowLocalhost: !app.isPackaged }).parse(params);
  const bundle = validateImportBundle(parsedParams.bundle);
  const baseUrl = parsedParams.apiBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/import-helper/espn/preview`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-leaguelore-import-token': parsedParams.importToken
      },
      body: JSON.stringify(bundle),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000)
    });

    const bodyText = (await response.text()).slice(0, 100_000);
    let parsed: unknown = bodyText;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      // keep text
    }

    const continuationUrl = response.ok ? findContinuationUrl(parsed, !app.isPackaged) : undefined;
    return {
      ok: response.ok,
      status: response.status,
      code: response.ok ? 'ok' : response.status === 401 ? 'unauthorized' : response.status === 403 ? 'expired' : response.status >= 500 ? 'unavailable' : 'rejected',
      message: response.ok ? 'Bundle uploaded for LeagueLore preview.' : `LeagueLore returned ${response.status}.`,
      retryable: response.status === 429 || response.status >= 500,
      continuationUrl,
      response: response.ok ? parsed : undefined
    };
  } catch (error) {
    const canceled = signal?.aborted ?? false;
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout'));
    return {
      ok: false,
      status: 0,
      code: canceled ? 'canceled' : timeout ? 'timeout' : 'offline',
      message: canceled ? 'Upload canceled.' : timeout ? 'LeagueLore took too long to respond.' : 'Unable to reach LeagueLore. Check your connection and retry.',
      retryable: !canceled
    };
  }
}

function findContinuationUrl(response: unknown, allowLocalhost: boolean): string | undefined {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return undefined;
  const record = response as Record<string, unknown>;
  const candidate = record.continuationUrl ?? record.previewUrl ?? record.url;
  if (typeof candidate !== 'string') return undefined;
  try {
    return normalizeLeagueLoreNavigationUrl(candidate, { allowLocalhost });
  } catch {
    return undefined;
  }
}
