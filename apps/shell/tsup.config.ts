import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/config/define.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  outDir: 'dist',
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'react';
  },
});
