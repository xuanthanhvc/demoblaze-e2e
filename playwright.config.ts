import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { env } from './src/config/env';

const reporters: ReporterDescription[] = env.isCI
  ? [
      ['github'],
      ['blob', { fileName: `report-${env.blobReportName}.zip` }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
    ]
  : [
      ['list'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
    ];

const uiTests = { testDir: './tests/ui' } as const;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/artifacts',
  globalSetup: './src/config/global-setup.ts',
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.retries,
  ...(env.workers === undefined ? {} : { workers: env.workers }),
  timeout: env.timeouts.test,
  expect: { timeout: env.timeouts.expect },
  reporter: reporters,
  use: {
    baseURL: env.baseUrl,
    headless: env.headless,
    actionTimeout: env.timeouts.action,
    navigationTimeout: env.timeouts.navigation,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', ...uiTests, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', ...uiTests, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', ...uiTests, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', ...uiTests, grep: /@smoke/, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', ...uiTests, grep: /@smoke/, use: { ...devices['iPhone 14'] } },
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiUrl },
    },
    {
      name: 'perf',
      testDir: './tests/perf',
      grep: /@perf/,
      retries: 0,
      fullyParallel: false,
      // Timings taken while other perf files run in parallel measure contention, not the site.
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
