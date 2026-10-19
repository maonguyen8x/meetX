import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/worker.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @meetx/shared is consumed as TypeScript source, so it must be bundled.
  noExternal: ['@meetx/shared'],
});
