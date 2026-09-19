// apps/web/tests/e2e/51-csat-corpus-coverage.spec.ts
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import report from '../../../../docs/reports/csat-corpus-coverage-20260919.json'

const route = '/admin/csat/sources?view=coverage'
const shots = 'test-results-csat-learner/corpus-coverage'

for (const scenario of [
  { width: 1280, theme: 'light' },
  { width: 390, theme: 'dark' },
]) {
  test(`${scenario.width} ${scenario.theme}: measured coverage and source inspection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    await page.goto(route)
    await page.evaluate(
      (theme) => document.documentElement.setAttribute('data-theme', theme),
      scenario.theme
    )
    const overview = page.getByRole('region', { name: '판정 현황과 측정 시각' })
    await expect(overview).toContainText('현재 스냅샷에서 사용 가능 원문')
    await expect(overview.locator('strong')).toHaveText(
      report.sources.reduce((sum, source) => sum + source.usable, 0).toLocaleString('ko-KR')
    )
    await expect(overview).toContainText(
      '조건부 발췌 ' +
        report.sources
          .reduce((sum, source) => sum + source.conditional, 0)
          .toLocaleString('ko-KR') +
        '편'
    )
    const panel = page.locator('#panel-coverage')
    await expect(
      panel.getByRole('heading', { name: '학생의 읽기 범위에 어떤 주제가 비어 있나요?' })
    ).toBeVisible()
    await expect(panel.getByText('고정 스냅샷', { exact: false })).toBeVisible()
    await panel.getByLabel('영어 수준 · CEFR').selectOption('A1')
    await expect(panel.getByRole('status')).toContainText('사용 가능')
    await expect(panel.locator('[data-empty="true"]').first()).toBeVisible()
    await panel.scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await page.screenshot({
      path: `${shots}/${scenario.width}-${scenario.theme}.png`,
      fullPage: true,
    })
    const results = await new AxeBuilder({ page })
      .include('#panel-coverage')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await panel.getByLabel('영어 수준 · CEFR').selectOption('all')
    await panel.getByLabel('주제 · 키워드 추정').selectOption('과학·자연')
    await expect(panel.getByRole('status')).toContainText('조건부 발췌 미측정')
    await panel.locator('tbody tr').first().getByRole('button').click()
    await expect(page.locator('#coverage-source-title')).toBeFocused()
    const detail = panel.locator('#coverage-source-detail')
    await detail.getByText('역할 추천·권리·수집 건강 근거', { exact: true }).click()
    await expect(detail).toContainText('실패율·응답 시간 미측정')
    await detail.getByText(/사용 가능 원문 표본/).click()
    const sampleLinks = detail.getByRole('link', { name: /적격 판정 열기/ })
    await expect(sampleLinks.first()).toHaveAttribute(
      'href',
      '/admin/csat/sources?view=eligibility'
    )
    await page.screenshot({
      path: `${shots}/detail-${scenario.width}-${scenario.theme}.png`,
      fullPage: true,
    })
    await detail.getByRole('button', { name: '원천 관리에서 검수하기 →' }).click()
    await expect(page.locator('#source-detail-title')).toBeFocused()
    await expect(page.locator('#panel-sources')).toBeVisible()
    await expect(page).toHaveURL(/source=/)
    await page.getByRole('button', { name: '원천 상세 닫기' }).click()
    await expect(page.getByRole('tab', { name: '원천 관리' })).toBeFocused()
    await page.goBack()
    await page.reload()
    await expect(page.locator('#source-detail')).toBeVisible()
  })
}

test('four tabs remain reachable by keyboard and URL reload', async ({ page }) => {
  await page.goto(route)
  const coverage = page.getByRole('tab', { name: '코퍼스 분포' })
  await coverage.focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: '처리 안내' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '원천 관리' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: '처리 안내' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(coverage).toBeFocused()
  await expect(page).toHaveURL(/view=coverage/)
  await page.reload()
  await expect(coverage).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#panel-coverage')).toBeVisible()
})
