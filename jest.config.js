/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  globalTeardown: "<rootDir>/tests/teardown.js",
  collectCoverageFrom: [
    "utils/**/*.js",
    "!utils/geocoder.js",
    "controllers/**/*.js",
    "models/**/*.js",
    "middleware.js",
  ],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  verbose: true,
};
