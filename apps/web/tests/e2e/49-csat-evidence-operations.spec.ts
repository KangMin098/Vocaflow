// apps/web/tests/e2e/49-csat-evidence-operations.spec.ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const route = '/admin/csat/evidence'
const shots = 'test-results-csat-learner/evidence-operations'
test.setTimeout(120_000)
async function open(page: Page, query = '') {
  await page.goto(route + query)
  await expect(page.getByTestId('evidence-operations')).toBeVisible()
  await expect(page.getByText('판정 보류 · 데이터를 확인하지 못했습니다')).toHaveCount(0)
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
}

test('overview responsive hierarchy, light/dark and accessibility', async ({ page }) => {
  await open(page)
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute('data-theme', value),
        theme
      )
      await noOverflow(page)
      await expect(page.getByRole('button', { name: '제외 문항 검토' })).toBeVisible()
      await page.screenshot({ path: `${shots}/overview-${width}-${theme}.png` })
      const result = await new AxeBuilder({ page })
        .include('[data-testid="evidence-operations"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(result.violations).toEqual([])
    }
  }
})

test('issue → questions → inspector, history restoration and empty recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await open(page)
  await page.getByRole('button', { name: '처리 방법과 대상 보기' }).click()
  await expect(page).toHaveURL(/view=issues/)
  await page.screenshot({ path: `${shots}/work-queue.png` })
  await page.getByRole('button', { name: /\d+문항 보기/ }).click()
  const question = page.locator('tbody tr td:first-child button').first()
  const name = await question.innerText()
  await question.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('현재 분석과 근거', { exact: true })).toBeVisible({
    timeout: 45_000,
  })
  await expect(page.getByRole('button', { name: '문항 검토 닫기', exact: true })).toBeFocused()
  await page.screenshot({ path: `${shots}/inspector-1280.png` })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
  await page.goBack()
  await expect(dialog).toBeVisible()
  await page.reload()
  await expect(dialog).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await expect(dialog.getByText('현재 분석과 근거', { exact: true })).toBeVisible({
    timeout: 45_000,
  })
  await page.screenshot({ path: `${shots}/inspector-390.png` })
  const result = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('searchbox', { name: '문항 검색' }).fill('no-matching-question')
  await expect(page.getByText('조건에 맞는 문항이 없습니다.')).toBeVisible()
  await page.getByRole('button', { name: '전체 문항 보기' }).click()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)
})

test('matrix cell retains exact defect/type selection, revalidation failure and recovery', async ({
  page,
}) => {
  await open(page, '?view=questions&matrix=1')
  const matrix = page.getByRole('region', { name: '교차 진단' })
  const cell = matrix.locator('tbody td button[aria-disabled="false"]').first()
  const label = await cell.getAttribute('aria-label')
  const count = Number(label!.split('—')[1].trim().replaceAll(',', ''))
  await cell.click()
  const query = new URL(page.url()).searchParams
  expect(query.get('defect')).toBeTruthy()
  expect(query.get('type')).toBeTruthy()
  await expect(
    page.getByRole('heading', {
      name: `문항 탐색 · ${count.toLocaleString('ko-KR')}문항`,
      exact: true,
    })
  ).toBeVisible()
  await page.getByRole('button', { name: '운영 현황', exact: true }).click()
  await page.route('**/api/admin/csat/evidence', (handler) =>
    handler.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ readinessError: '검증 연결 실패' }),
    })
  )
  await page.getByRole('button', { name: '지금 재검증', exact: true }).click()
  await expect(page.getByText('판정 보류 · 데이터를 확인하지 못했습니다')).toBeVisible()
  await expect(page.getByRole('button', { name: '제외 문항 검토' })).toBeDisabled()
  await page.unroute('**/api/admin/csat/evidence')
  await page.getByRole('button', { name: '지금 재검증', exact: true }).click()
  await expect(page.getByText(/재검증 완료 · 학습 준비/)).toBeVisible({ timeout: 95_000 })
  await expect(page.getByRole('button', { name: '제외 문항 검토' })).toBeEnabled()
})
