/** @type {CodeceptJS.MainConfig} */
exports.config = {
  tests: './tests/e2e/*_test.cjs',
  output: './tests/e2e/output',
  helpers: {
    Playwright: {
      url: 'http://localhost:4173',
      show: false,
      browser: 'chromium',
      waitForTimeout: 5000,
    }
  },
  include: {
    I: './tests/e2e/steps_file.cjs'
  },
  name: 'KobeanREST E2E Automation Suite'
};
