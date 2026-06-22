import { app } from 'electron';
import { validateImportBundle } from '@leaguelore/import-contract';
import type { UploadParams, UploadResult } from '../shared/ipc.js';
import { createUploadParamsSchema } from './validation.js';

export async function uploadBundle(params: UploadParams): Promise<UploadResult> {
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
      signal: AbortSignal.timeout(30_000)
    });

    const bodyText = await response.text();
    let parsed: unknown = bodyText;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      // keep text
    }

    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Bundle uploaded for LeagueLore preview.' : `LeagueLore returned ${response.status}.`,
      response: parsed
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'Unable to reach LeagueLore API.'
    };
  }
}
