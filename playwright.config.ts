import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by the real API server, with a mock
// model backend. Build first: npm run build
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', acceptDownloads: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    { command: 'node tests/e2e/mock-llm.mjs', port: 18081, reuseExistingServer: !process.env.CI },
    {
      command: 'node apps/api/dist/server.mjs',
      url: 'http://127.0.0.1:4173/api/health',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '4173', STATIC_DIR: 'apps/web/dist', LLAMA_URL: 'http://127.0.0.1:18081', TUTOR_MODEL: 'mock-model', RATE_LIMIT_MAX: '1000' },
    },
  ],
});
