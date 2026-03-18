import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'security/index': 'src/security/index.ts',
    'shell/index': 'src/shell/index.tsx',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  jsx: 'react',
  shims: true,
  esbuildOptions(options, context) {
    if (context.format === 'esm') {
      options.platform = 'node';
    }
  },
});
