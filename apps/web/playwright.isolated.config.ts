// apps/web/playwright.isolated.config.ts
// PR 필수 e2e(격리) 전용 설정 — 서버는 CI 단계가 띄운다(로컬 Supabase + next start). 1440px · 재시도 없음(실패를 가리지 않는다).
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-isolated',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-isolated' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
})
