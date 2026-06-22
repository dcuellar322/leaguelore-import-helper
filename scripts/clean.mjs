import { rm } from 'node:fs/promises';

const paths = [
  'node_modules',
  'apps/desktop/node_modules',
  'packages/import-contract/node_modules',
  'apps/desktop/.vite',
  'apps/desktop/out',
  'apps/desktop/dist',
  'packages/import-contract/dist'
];

for (const path of paths) {
  await rm(path, { recursive: true, force: true });
}
