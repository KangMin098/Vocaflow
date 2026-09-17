// apps/web/tests/visual/checks.ts
import { expect, type Page } from '@playwright/test'

/** A redirect or error document must never become a design baseline. */
export async function assertScreen(page: Page, pathname: string, heading: string) {
  expect(new URL(page.url()).pathname, '다른 화면으로 이동함').toBe(pathname)
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
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
