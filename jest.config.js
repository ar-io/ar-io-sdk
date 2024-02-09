module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  setupFilesAfterEnv: ['./tests/mocks.jest.ts'],
  testMatch: ['**/src/**/*.test.ts', '**/tests/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', 'tests/**/*.ts'],
  testEnvironment: 'node',
  testTimeout: 5000,
  transform: {
    '^.+\\.(ts|js)$': 'ts-jest',
  },
};
