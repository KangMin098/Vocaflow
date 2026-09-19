// apps/web/tests/visual/checks.ts
import { expect, type Page } from '@playwright/test'

/** A redirect or error document must never become a design baseline. */
export async function assertScreen(page: Page, pathname: string, heading: string | RegExp) {
  expect(new URL(page.url()).pathname, '다른 화면으로 이동함').toBe(pathname)
  // 헤딩이 데이터로 바뀌는 화면(오늘의 단어 등)은 정규식으로 받는다 — 그래도 h1 은 반드시 있어야 한다.
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: typeof heading === 'string' })).toBeVisible()
}

export async function measureOverflow(page: Page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  }))
}

export async function assertNoOverflow(page: Page) {
  const metrics = await measureOverflow(page)
  expect(metrics.overflow, `가로 넘침: ${metrics.overflow}px (${metrics.viewport}px 화면)`).toBeLessThanOrEqual(1)
}
