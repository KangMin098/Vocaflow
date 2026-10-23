// apps/web/tests/e2e-isolated/goal-outcome.browser.spec.ts
// Actual GoalSchedule · GoalOutcome · ReplanPanel in Chromium with synthetic state. Navigation/API are doubles — not a shared DB end-to-end claim.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

const harness = path.resolve('output/goal-outcome-harness.html')
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()

for (const width of [1440, 1280]) {
  test(`goal outcome · replan journeys at ${width}`, async ({ page }) => {
    expect(fs.existsSync(harness), 'Build the goal outcome harness first').toBe(true)
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('https://goal-outcome.test/', (route) => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(harness, 'utf8') }))
    await page.goto('https://goal-outcome.test/')
    const outcome = page.getByTestId('goal-outcome')
    const schedule = page.getByTestId('goal-schedule')

    // 시험 기록 없음 · 재확정 불필요 · 카운트다운 없음
    await expect(outcome).toHaveAttribute('data-verdict', 'no_record')
    await expect(page.getByTestId('replan')).toHaveCount(0)
    await expect(schedule).toContainText('목표일 2026-11-19')
    await expect(page.locator('body')).not.toContainText('일 남음')
    await expect(page.locator('body')).not.toContainText(/\d+%/)

    // 새 시험 미달 + 확인 실패 → 저장 계획과 수정안 비교 · 확정은 Workspace 계획 탭
    await pick(page, 'below')
    await expect(outcome).toHaveAttribute('data-verdict', 'below')
    await expect(outcome).toContainText('현재 평가에서 목표 기준 미달')
    const replan = page.getByTestId('replan')
    await expect(replan).toHaveAttribute('data-reasons', 'check_result new_exam')
    await expect(page.getByTestId('replan-shifts')).toContainText('확인하기 2 → 바로잡기 3')
    await expect(page.getByTestId('replan-week')).toContainText('이번 주 합계0분20분30분') // 지금 배정 · 저장 계획대로 · 수정안
    await expect(page.getByTestId('replan-week-note')).toContainText('아직 배정되지 않아요')
    // 확정 버튼은 카드 안쪽 여백 안(T-0093 UI 확인 ①)
    const card = await page.getByTestId('replan').boundingBox(); const btn = await page.getByTestId('replan-confirm').boundingBox()
    expect(btn!.x - card!.x).toBeGreaterThanOrEqual(12)
    await expect(page.getByTestId('schedule-start')).toHaveCount(0) // 재확정 전에는 실행 링크를 열지 않는다
    await page.screenshot({ path: `output/goal-outcome-below-${width}.png`, fullPage: true })
    await page.keyboard.press('Shift') // 키보드 사용 중일 때의 포커스 표시(:focus-visible)를 본다
    await page.getByTestId('replan-confirm').focus()
    expect(await page.getByTestId('replan-confirm').evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('opened-workspace')).toHaveText('ws.central-meaning:plan')

    // 충족 — 한계 문구와 함께 · 계획은 같으면 변화 없음
    await pick(page, 'met')
    await expect(outcome).toHaveAttribute('data-verdict', 'met')
    await outcome.locator('summary').click()
    await expect(page.getByTestId('goal-outcome-limit')).toContainText('최종 목표 달성이나 학습 효과가 입증된 것은 아니에요')
    await expect(page.getByTestId('replan-unchanged')).toBeVisible()
    await page.screenshot({ path: `output/goal-outcome-met-${width}.png`, fullPage: true })

    // 재풀이 · 다른 시험 = 판정 불가
    await pick(page, 'repeat')
    await expect(outcome).toHaveAttribute('data-score', 'repeated_paper')
    await expect(outcome).toHaveAttribute('data-verdict', 'not_judgeable')
    await pick(page, 'other')
    await expect(outcome).toHaveAttribute('data-score', 'different_exam')

    // 목표 변경
    await pick(page, 'goal')
    await expect(page.getByTestId('replan')).toHaveAttribute('data-reasons', /goal_change/)

    // 저장 계획 조회 실패 — 일정 · 재처방 · 목표 판정을 만들지 않는다
    await pick(page, 'error')
    await expect(schedule).toHaveCount(0)
    await expect(page.getByTestId('replan')).toHaveCount(0)
    await expect(outcome).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
