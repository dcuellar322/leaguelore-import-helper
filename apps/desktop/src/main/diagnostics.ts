import { app } from 'electron';
import { appendFile, copyFile, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const MAX_LOG_BYTES = 1_000_000;

function diagnosticsPath(): string {
  return join(app.getPath('userData'), 'diagnostics.jsonl');
}

export async function recordDiagnostic(
  event: string,
  details: Record<string, string | number | boolean | undefined> = {}
): Promise<void> {
  try {
    const path = diagnosticsPath();
    await mkdir(dirname(path), { recursive: true });
    const size = await stat(path)
      .then((value) => value.size)
      .catch(() => 0);
    if (size > MAX_LOG_BYTES) {
      await unlink(`${path}.previous`).catch(() => undefined);
      await rename(path, `${path}.previous`).catch(() => undefined);
    }
    const safeDetails = Object.fromEntries(
      Object.entries(details).filter(
        ([key, value]) => value !== undefined && !/(token|cookie|secret|password|header|payload|response)/i.test(key)
      )
    );
    await appendFile(path, `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...safeDetails })}\n`, {
      encoding: 'utf-8',
      mode: 0o600
    });
  } catch {
    // Diagnostics must never interrupt the import flow.
  }
}

export async function exportDiagnostics(destination: string): Promise<void> {
  const path = diagnosticsPath();
  await readFile(path, 'utf-8').catch(async () => {
    await recordDiagnostic('diagnostics_created');
  });
  await copyFile(path, destination);
}
