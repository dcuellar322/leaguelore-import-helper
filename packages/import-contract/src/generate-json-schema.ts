import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { LeagueLoreImportBundleSchema, LeagueLoreImportPreviewSchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'json-schema');

await mkdir(distDir, { recursive: true });

function toNamedJsonSchema(schema: z.ZodType, name: string) {
  const { $schema, ...definition } = z.toJSONSchema(schema, {
    target: 'draft-07',
    io: 'input',
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema instanceof z.ZodObject) {
        jsonSchema.additionalProperties = false;
      }
    }
  });

  return {
    $ref: `#/definitions/${name}`,
    definitions: {
      [name]: definition
    },
    $schema
  };
}

await writeFile(
  join(distDir, 'leaguelore-import-bundle.schema.json'),
  JSON.stringify(toNamedJsonSchema(LeagueLoreImportBundleSchema, 'LeagueLoreImportBundle'), null, 2),
  'utf-8'
);

await writeFile(
  join(distDir, 'leaguelore-import-preview.schema.json'),
  JSON.stringify(toNamedJsonSchema(LeagueLoreImportPreviewSchema, 'LeagueLoreImportPreview'), null, 2),
  'utf-8'
);
