export default {
  preset: 'ts-jest',
  // TODO: this should be using globalSetup once this is resolved: https://github.com/kulshekhar/ts-jest/issues/4127
  globalSetup: './tests/integration/jest.setup.ts',
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
