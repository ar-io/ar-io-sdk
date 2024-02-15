module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  testMatch: ['**/src/**/*.test.ts', '**/tests/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', 'tests/**/*.ts'],
  testEnvironment: 'node',
  testTimeout: 60_000,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
