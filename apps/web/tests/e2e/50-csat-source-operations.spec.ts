// apps/web/tests/e2e/50-csat-source-operations.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('missing cache stays inspectable and never appears eligible before revalidation', async ({ page }) => {
  await page.route('**/api/admin/csat/sources?**', async route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('queue') === 'stale') {
      url.searchParams.set('queue', 'eligible')
      const response = await route.fetch({ url: url.toString() })
      const data = await response.json()
      expect(data.rows.length).toBeGreaterThan(0)
      const row = { ...data.rows[0], cache_state: 'missing', effective_status: 'review', can_use: false, result: null, linked_items: null }
      await route.fulfill({ response, json: { ...data, rows: [row], count: 1 } })
    } else if (url.searchParams.has('id')) {
      const response = await route.fetch()
      const data = await response.json()
      await route.fulfill({ response, json: { ...data, stale: true, row: { ...data.row, measured_at: null } } })
    } else await route.continue()
  })
  await page.goto('/admin/csat/sources')
  const summary = page.getByRole('navigation', { name: '원문 운영 현황' })
  await expect(summary).toBeVisible({ timeout: 30000 })
  await summary.getByRole('button', { name: /캐시 재검증/ }).click()
  const list = page.getByRole('list', { name: '개별 원문 목록' })
  await expect(list.getByText('캐시 재검증 필요 · 사용 대기', { exact: true })).toBeVisible({ timeout: 30000 })
  await expect(list.getByText(/문항 연결 수 확인 필요/)).toBeVisible()
  await list.locator('button').first().click()
  const inspector = page.getByRole('complementary', { name: '원문 검사' })
  await expect(inspector.getByText('캐시 재검증 필요 · 사용 대기', { exact: true })).toBeVisible({ timeout: 30000 })
  await expect(inspector.getByText('적격', { exact: true })).toHaveCount(0)
  await expect(inspector.getByRole('button', { name: '최신 원문으로 재검증' })).toBeEnabled()
})

for (const width of [390, 1280]) {
  test(`${width}: source queue reaches actual body, reasons and linkage`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('/admin/csat/sources')
    const summary = page.getByRole('navigation', { name: '원문 운영 현황' })
    await expect(summary).toBeVisible({ timeout: 30000 })
    await summary.getByRole('button', { name: /반려 · 문항 연결/ }).click()
    const list = page.getByRole('list', { name: '개별 원문 목록' })
    await expect(list.locator('li').first()).toBeVisible({ timeout: 30000 })
    await list.locator('button').first().click()
    const inspector = page.getByRole('complementary', { name: '원문 검사' })
    await expect(inspector.getByRole('heading').first()).toBeVisible({ timeout: 30000 })
    await expect(inspector.getByText('학습·교재 사용 불가', { exact: true })).toBeVisible()
    await inspector.getByText('실제 원문', { exact: true }).click()
    await expect(inspector.locator('[lang=en]').last()).not.toBeEmpty()
    await inspector.getByText('연결 문항 · 교재 · 학습 기록', { exact: true }).click()
    await expect(inspector.getByText(/이전 인쇄·노출 여부는 알 수 없습니다/)).toBeVisible()
    if (width === 390) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const audit = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(audit.violations).toEqual([])
    await page.screenshot({ path: `test-results-csat-learner/source-operations-${width}.png`, fullPage: false })
    await inspector.getByRole('heading').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results-csat-learner/source-inspector-${width}.png`, fullPage: false })
    await inspector.getByRole('button', { name: '원문 검사 닫기' }).click()
    await expect(list.locator('button').first()).toBeFocused()
  })
}
