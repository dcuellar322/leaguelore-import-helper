import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { LeagueLoreImportBundleSchema, LeagueLoreImportPreviewSchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'json-schema');

await mkdir(distDir, { recursive: true });

await writeFile(
  join(distDir, 'leaguelore-import-bundle.schema.json'),
  JSON.stringify(zodToJsonSchema(LeagueLoreImportBundleSchema, 'LeagueLoreImportBundle'), null, 2),
  'utf-8'
);

await writeFile(
  join(distDir, 'leaguelore-import-preview.schema.json'),
  JSON.stringify(zodToJsonSchema(LeagueLoreImportPreviewSchema, 'LeagueLoreImportPreview'), null, 2),
  'utf-8'
);
