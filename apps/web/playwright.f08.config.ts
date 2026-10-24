// apps/web/playwright.f08.config.ts
// F08 후보 비교(대량작업 J) 전용 — 이미 떠 있는 서버(PLAYWRIGHT_BASE_URL)에 1280·1440 두 폭으로 같은 과제를 돌린다.
import { defineConfig, devices } from '@playwright/test'

const viewports = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
]

export default defineConfig({
  testDir: './tests/f08',
  outputDir: './test-results/f08',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/f08/results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: viewports.map((viewport) => ({
    name: `pc-${viewport.width}`,
    use: { ...devices['Desktop Chrome'], viewport },
  })),
})
