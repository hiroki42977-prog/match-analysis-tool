import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: process.env.PW_BASE ?? 'http://localhost:5199/' },
  projects: [
    { name: 'ipad', use: { browserName: 'webkit', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.PW_BASE
    ? { command: 'npx vite preview --port 5200 --strictPort', port: 5200, reuseExistingServer: true }
    : { command: 'npm run dev -- --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
});
