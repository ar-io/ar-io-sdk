export default {
  preset: 'ts-jest',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  testMatch: ['**/tests/unit/**.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node',
  testTimeout: 120_000,
  extensionsToTreatAsEsm: ['.ts'],
  passWithNoTests: true,
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
