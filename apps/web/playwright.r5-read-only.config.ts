// apps/web/playwright.r5-read-only.config.ts
// pnpm --filter web test:e2e:r5 — existing account read-only regression.
import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

const port = process.env.R5_READ_ONLY_PORT || '3129'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`
export default defineConfig({
  ...base,
  testMatch: '40-csat-practice.spec.ts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  retries: 0,
  use: { ...base.use, baseURL, navigationTimeout: 120_000 },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'node ../../scripts/csat/map/v62/r5-read-only-server.cjs',
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
