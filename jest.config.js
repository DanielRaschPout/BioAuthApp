/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  /**
   * Mirror the `@/*` path alias from tsconfig.json so test imports
   * resolve exactly the same way as production imports.
   */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },

  /**
   * Tell Jest where to find our manual mocks for native modules.
   * Files in `src/__mocks__/<module-name>.ts` automatically shadow
   * the real node_modules package of the same name when Jest resolves
   * imports — no per-test `jest.mock()` calls needed for these.
   */
  roots: ['<rootDir>/src'],

  /**
   * Collect coverage from the two core logic directories — the business
   * logic that actually matters for a portfolio demo. Screens are tested
   * at the component level but aren't included in coverage metrics
   * because their value comes from interaction tests, not line coverage.
   */
  collectCoverageFrom: [
    'src/core/**/*.ts',
    '!src/core/**/__tests__/**',
  ],

  /** Increase timeout for CI or slow Simulator machines. */
  testTimeout: 10000,
};
