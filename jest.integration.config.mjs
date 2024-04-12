export default {
  preset: 'ts-jest',
  setupFiles: ['./tests/integration/jest.setup.ts'],
  globalTeardown: './tests/integration/jest.teardown.ts',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node',
  testTimeout: 120_000,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
