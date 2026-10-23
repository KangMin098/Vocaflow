// apps/web/tests/e2e-isolated/goal-schedule.browser.spec.ts
// Actual components in Chromium; navigation/refresh/API transport are explicit doubles. Not a shared DB end-to-end claim.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const harness = path.resolve('output/goal-schedule-harness.html')
const modalSpec = JSON.parse(fs.readFileSync(path.resolve('../../docs/design/refs/3b/access-map/spec.json'), 'utf8')).modal as { w: number; h: number }
for (const width of [1440, 1280]) {
  test(`goal schedule component journeys A/B/C at ${width}`, async ({ page }) => {
    expect(fs.existsSync(harness), 'Build the permanent goal schedule harness first').toBe(true)
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('https://goal-schedule.test/', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(harness, 'utf8') }))
    await page.goto('https://goal-schedule.test/')
    const plan = page.getByTestId('goal-schedule')
    await expect(plan).toHaveAttribute('data-status', 'ready')
    await expect(plan).toContainText('2문항 · 20분 배분')
    const href = await page.getByTestId('schedule-start').getAttribute('href')
    const url = new URL(href!, 'http://goal-schedule.test')
    expect(url.pathname).toBe('/csat/learn/authored-central-meaning')
    expect(url.searchParams.get('from')).toBe('map')
    await page.getByTestId('schedule-start').focus()
    expect(await page.getByTestId('schedule-start').evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none')
    await page.screenshot({ path: `output/goal-schedule-ready-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'repair', exact: true }).click()
    await expect(plan).toContainText('보완이 필요했어요')
    await page.getByRole('button', { name: 'B', exact: true }).click()
    await expect(plan).not.toContainText('보완이 필요했어요')
    await page.getByRole('button', { name: 'C', exact: true }).click()
    await expect(page.getByTestId('schedule-start')).toHaveCount(0)
    await plan.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('schedule-unassigned')).toContainText('재확정 필요')
    await page.getByRole('button', { name: 'Workspace 보기' }).click()
    await expect(page.getByTestId('opened-workspace')).toHaveText('ws.central-meaning:plan')
    await page.getByRole('button', { name: '목표 바꾸기', exact: true }).click()
    await expect(page.getByTestId('goal-dialog')).toBeVisible()
    const modal = await page.getByTestId('goal-dialog').boundingBox()
    expect(modal?.width).toBe(modalSpec.w)
    expect(modal?.height).toBe(modalSpec.h)
    await page.locator('[data-testid="goal-more"] > summary').click()
    await expect(page.getByTestId('goal-weekly-minutes')).toHaveValue('120')
    await page.getByLabel('요일별 시간 직접 정하기', { exact: true }).uncheck()
    await page.getByTestId('goal-weekly-minutes').fill('60')
    let requestBody: Record<string, unknown> = {}
    await page.route('**/api/csat/diagnosis/map/goal', async route => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({ status: 503, json: { error: '시간 예산 저장 구조가 아직 적용되지 않았어요' } })
    })
    await page.getByTestId('goal-apply-all').click()
    await expect(page.getByRole('alert')).toContainText('아직 적용되지 않았어요')
    expect((requestBody.budget as { weeklyMinutes: number }).weeklyMinutes).toBe(60)
    expect(requestBody.expectedGoalVersion).toBe(1)
    await expect(plan).toContainText('주간 상한 120분') // No optimistic persisted display.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
    await page.screenshot({ path: `output/goal-schedule-${width}.png`, fullPage: true })
  })
}
