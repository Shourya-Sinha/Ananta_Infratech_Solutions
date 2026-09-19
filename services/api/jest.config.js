/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@ananta/shared-types$": "<rootDir>/../../packages/shared-types/src/index.js",
    "^@ananta/constants$": "<rootDir>/../../packages/constants/src/index.js",
    "^@ananta/utils$": "<rootDir>/../../packages/utils/src/index.js",
    "^@ananta/validation$": "<rootDir>/../../packages/validation/src/index.js",
  },
  testTimeout: 30000,
};
