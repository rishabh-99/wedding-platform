import { defineConfig } from 'tsup';

// Bundles the server and seed into dist/, inlining the shared workspace package.
// Runtime npm dependencies stay external and are installed in the production image.
export default defineConfig({
  entry: { server: 'src/server.ts', seed: 'prisma/seed.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: ['@wedding/shared'],
});
