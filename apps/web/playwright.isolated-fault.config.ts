// apps/web/playwright.isolated-fault.config.ts
// 게이트 고장(fail-closed) 격리 e2e 전용 — CI job `e2e-gate-faultclosed` 가 서버를 띄운다. 주 격리 설정(playwright.isolated.config.ts)과 폴더가 겹치지 않는다.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-isolated-fault',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['./tests/e2e/utils/secret-redact-reporter.ts'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report-isolated-fault' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
})
