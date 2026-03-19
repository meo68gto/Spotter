module.exports = {
  testTimeout: 180000,
  maxWorkers: 1,
  testMatch: ['**/*.e2e.ts'],
  reporters: ['detox/runners/jest/reporter'],
  testRunner: 'jest-circus/runner',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  setupFilesAfterEnv: ['detox/runners/jest/setup']
};
