export function formatError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong.';
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .slice(0, 500);
}
