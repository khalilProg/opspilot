import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: process.env.GATEWAY_BASE_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    screenshot: 'only-on-failure',
  },
})
