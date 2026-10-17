// apps/web/playwright.r5-read-only.config.ts
// pnpm --filter web test:e2e:r5 — existing account read-only regression.
import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'
import { r5ReadOnlyBase } from './tests/e2e/utils/r5-read-only-base'

const baseURL = r5ReadOnlyBase(process.env)
export default defineConfig({
  ...base,
  testMatch: '40-csat-practice.spec.ts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  retries: 0,
  use: { ...base.use, baseURL, navigationTimeout: 120_000 },
  webServer: process.env.PLAYWRIGHT_BASE_URL || process.env.R5_READ_ONLY_BASE_URL ? undefined : {
    command: 'node ../../scripts/csat/map/v62/r5-read-only-server.cjs',
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
