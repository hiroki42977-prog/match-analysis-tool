import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://localhost:5199/' },
  projects: [
    { name: 'ipad', use: { browserName: 'webkit', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } },
  ],
  webServer: { command: 'npm run dev -- --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
});
