// apps/web/tests/e2e/44-csat-sources-fold.spec.ts
import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import inventory from '../../src/lib/textbook/source-inventory-snapshot.json'

const ROUTE = '/admin/csat/sources'
const SHOTS = 'test-results-csat-learner/sources-redesign'
async function open(page: Page, suffix = '') {
  const response = await page.goto(ROUTE + suffix)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: '원문 적격', exact: true })).toBeVisible()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
}
for (const width of [1280, 1440, 1920]) {
  test(`${width}: actionable source rows above fold and responsive detail`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await open(page)
    const rows = page.locator('#panel-sources tbody tr')
    await expect(rows).toHaveCount(inventory.sources.length)
    const box = await rows.first().boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(900)
    console.log(`[sources ${width}] first row bottom ${Math.round(box!.y + box!.height)}px`)
    await noOverflow(page)
    await page.screenshot({ path: `${SHOTS}/after-${width}.png` })
    await rows.first().getByRole('button').click()
    await expect(page.locator('#source-detail-title')).toBeFocused()
    await expect(page.getByRole('link', { name: '원문 검수하기' })).toHaveAttribute(
      'href',
      /stage=review&status=all&src=/
    )
    await noOverflow(page)
    await page.screenshot({ path: `${SHOTS}/detail-${width}.png` })
  })
}
test('search/filter/sort, empty recovery, URL reload and browser history', async ({ page }) => {
  await open(page)
  await page.getByRole('searchbox', { name: '원천 검색' }).fill('PLOS')
  await expect(page.locator('#panel-sources tbody tr')).toHaveCount(1)
  await page.locator('#panel-sources tbody button').click()
  await expect(page).toHaveURL(/source=plos/)
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('PLOS')
  await expect(page.locator('#source-detail')).toBeVisible()
  const href = new URL(
    (await page.getByRole('link', { name: '원문 검수하기' }).getAttribute('href')) ?? '',
    'http://localhost'
  )
  expect(href.searchParams.get('src')).toBe('plos')
  await page.getByRole('button', { name: '원천 상세 닫기' }).click()
  await page.goBack()
  await expect(page.locator('#source-detail')).toBeVisible()
  await page.getByRole('searchbox').fill('no-matching-source')
  await expect(page.getByText('조건에 맞는 원천이 없습니다')).toBeVisible()
  await page.getByRole('button', { name: '전체 원천 보기' }).click()
  await expect(page.locator('#panel-sources tbody tr')).toHaveCount(inventory.sources.length)
  await page.getByLabel('확인할 항목', { exact: true }).selectOption('failed')
  const failed = inventory.sources.filter(
    (source) =>
      'failed' in source.byStatus &&
      typeof source.byStatus.failed === 'number' &&
      source.byStatus.failed > 0
  )
  await expect(page.locator('#panel-sources tbody tr')).toHaveCount(failed.length)
  await page.getByRole('button', { name: '필터 초기화' }).click()
  await page.getByLabel('정렬', { exact: true }).selectOption('total')
  const most = [...inventory.sources].sort((a, b) => b.total - a.total)[0]
  await expect(page.locator('#panel-sources tbody tr').first()).toHaveAttribute(
    'data-source',
    most.source
  )
})
test('keyboard tabs and detail close restore focus; references stay reachable', async ({
  page,
}) => {
  await open(page)
  const first = page.locator('#panel-sources tbody button').first()
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#source-detail-title')).toBeFocused()
  await page.getByRole('button', { name: '원천 상세 닫기' }).click()
  await expect(first).toBeFocused()
  await page.getByRole('tab', { name: '원천 관리' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '적격 판정' })).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: '적격 판정' })).toBeVisible()
  await page.locator('#panel-eligibility summary').first().click()
  await expect(page.locator('#panel-eligibility details').first()).toHaveAttribute('open', '')
  await page.getByRole('tab', { name: '처리 안내' }).click()
  await expect(page.getByRole('heading', { name: '집계 갱신', exact: true })).toBeVisible()
  await expect(
    page.locator('#panel-operations code').filter({ hasText: 'source-inventory-scan' })
  ).toBeVisible()
})
test('390px and dark mode: all views and accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await noOverflow(page)
  await page.screenshot({ path: `${SHOTS}/after-390-dark.png`, fullPage: true })
  await page.locator('#panel-sources tbody button').first().click()
  await noOverflow(page)
  await page.screenshot({ path: `${SHOTS}/detail-390-dark.png` })
  const detailViolations = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(detailViolations.violations).toEqual([])
  for (const name of ['적격 판정', '처리 안내']) {
    await page.getByRole('tab', { name }).click()
    const panel = page.getByRole('tabpanel', { name })
    for (const summary of await panel.locator(':scope > details > summary').all())
      await summary.click()
    await noOverflow(page)
    await page.screenshot({
      path: `${SHOTS}/${name === '적격 판정' ? 'eligibility' : 'operations'}-390-dark.png`,
    })
  }
})
test('1440 light: main accessibility and help scoped to selected tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.getByRole('tab', { name: '적격 판정' }).click()
  await page.screenshot({ path: `${SHOTS}/eligibility-1440.png` })
  await page.getByRole('tab', { name: '처리 안내' }).click()
  await page.screenshot({ path: `${SHOTS}/operations-1440.png` })
  await page.getByRole('button', { name: /화면 도움말/ }).click()
  await expect(
    page.getByText('이 탭은 명령을 실행하지 않습니다.', { exact: false }).first()
  ).toBeVisible()
})
