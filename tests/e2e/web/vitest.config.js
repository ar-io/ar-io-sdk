import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 60000,
  },
  resolve: {
    /**
     * Need this since we use 'npm link' to link
     * the locally built sdk to this harnesses dependencies
     */
    preserveSymlinks: true,
  },
});
