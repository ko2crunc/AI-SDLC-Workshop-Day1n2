import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';

function resolveChromiumExecutable() {
  const browsersRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(browsersRoot)) {
    return undefined;
  }

  const candidates = fs
    .readdirSync(browsersRoot)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((entry) => path.join(browsersRoot, entry, 'chrome-linux64', 'chrome'))
    .filter((candidate) => fs.existsSync(candidate));

  return candidates[0];
}

/**
 * Playwright configuration for Todo App E2E tests
 * Based on USER_GUIDE.md feature documentation
 */
export default defineConfig({
  testDir: './tests',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3000',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Browser context options
    locale: 'en-US',
    timezoneId: 'Asia/Singapore',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable WebAuthn virtual authenticator
        launchOptions: {
          executablePath: resolveChromiumExecutable(),
          args: ['--enable-features=WebAuthenticationTesting']
        }
      },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'PLAYWRIGHT_TEST=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
