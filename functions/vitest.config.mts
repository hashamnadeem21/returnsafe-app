import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// `npm run coverage` runs the unit tests against the compiled lib/ (loaded natively, not through
// Vite) so their V8 coverage maps to src/ exactly like the emulator's, and the two merge cleanly.
const COMPILED = process.env.FUNCTIONS_TEST_COMPILED === '1';

export default defineConfig({
  resolve: COMPILED
    ? {
        alias: [
          {
            find: /^\.\.\/src\/(.*?)(\.js)?$/,
            replacement: `${resolve(import.meta.dirname, 'lib')}/$1.js`,
          },
        ],
      }
    : undefined,
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    server: COMPILED ? { deps: { external: [/\/functions\/lib\//] } } : undefined,
  },
});
