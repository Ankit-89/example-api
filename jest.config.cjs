
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: [
    "**/*.test.ts",
    "**/*.test.tsx"
  ],
  clearMocks: true,
  restoreMocks: true
};
