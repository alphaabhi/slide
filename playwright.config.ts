import { defineConfig, devices } from '@playwright/test'

const port = 4173
// Use a system Chrome when Playwright's bundled browser isn't installed (e.g. sandboxes).
const executablePath = process.env.PW_CHROME_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'mobile-small',
      use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    env: { VITE_ENABLE_STYLEGUIDE: 'true' },
    timeout: 120_000,
  },
})
