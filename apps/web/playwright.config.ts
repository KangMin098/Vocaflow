// apps/web/playwright.config.ts
// Lexicon Unification Phase 1 — e2e 회귀 베이스라인용
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // headless-shell 사용 명시 (Playwright 1.49+ 기본동작이지만 명시화).
    // channel 옵션 의도적 생략 — 'chrome'/'chromium' 지정 시 풀 Chromium 다운로드 필요.
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // `PLAYWRIGHT_BASE_URL` 을 주면 **서버를 우리가 띄우지 않는다.**
  // 이 워크스페이스는 여러 세션이 공유하므로 3000 의 dev 서버를 함부로 죽이면 남의 실행이 깨진다.
  // 프로덕션 빌드로 재고 싶을 때는 `next start -p 3100` 을 따로 띄우고 이 변수로 가리킨다.
  webServer: process.env.CI || process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
