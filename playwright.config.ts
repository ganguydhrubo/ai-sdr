import { defineConfig, devices } from '@playwright/test';

/**
 * Browser verification for the voice module (Phase V11).
 * Run:  npm run test:e2e        (starts the dev server on E2E_PORT, default 3100, in DEMO_MODE)
 *       npm run test:e2e -- --project=mobile-375
 * Reports: playwright-report/ (npx playwright show-report)
 */
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = `http://localhost:${PORT}`;

// Fake media devices so the talk page's getUserMedia() succeeds headless without a real microphone.
const mediaArgs = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    launchOptions: { args: mediaArgs },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DEMO_MODE: 'true',
      VOICE_PROVIDER: 'demo',
      NEXT_PUBLIC_VOICE_PROVIDER: 'demo',
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
  projects: [
    {
      name: 'mobile-375',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
