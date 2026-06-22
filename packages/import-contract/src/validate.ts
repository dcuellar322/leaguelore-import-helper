import { LeagueLoreImportBundleSchema, type LeagueLoreImportBundle } from './schema.js';

export function validateImportBundle(input: unknown): LeagueLoreImportBundle {
  return LeagueLoreImportBundleSchema.parse(input);
}

export function safeValidateImportBundle(input: unknown) {
  return LeagueLoreImportBundleSchema.safeParse(input);
}
