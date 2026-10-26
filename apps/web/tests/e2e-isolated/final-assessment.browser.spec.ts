// apps/web/tests/e2e-isolated/final-assessment.browser.spec.ts
// Actual FinalAssessment (+ goalLearning/finalAttainment) in Chromium with synthetic state, on the goal-outcome harness.
// The API is a double here; the real writer/SQL run in final-assessment.pglite.test.ts. Not a shared DB end-to-end claim.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

const harness = path.resolve('output/goal-outcome-harness.html')
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()

for (const width of [1440, 1280]) {
  test(`final assessment bind · judge at ${width}`, async ({ page }) => {
    expect(fs.existsSync(harness), 'Build the goal outcome harness first').toBe(true)
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('https://goal-outcome.test/', (route) => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(harness, 'utf8') }))
    const posts: unknown[] = []
    let reply = { status: 503, body: { error: '최종 평가 저장 구조가 아직 적용되지 않았어요 — 저장하지 않았어요', code: 'final_assessment_not_installed' } as unknown }
    await page.route('https://goal-outcome.test/api/csat/diagnosis/map/goal/final-assessment', async (route) => {
      posts.push(route.request().postDataJSON())
      await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
    })
    await page.goto('https://goal-outcome.test/')
    const card = page.getByTestId('final-assessment')

    // 리더가 없는 옛 응답 = 미설치(미확인) — 결속 안 됨 · 판정으로 보이지 않는다
    await expect(card).toHaveAttribute('data-status', 'not_installed')
    await expect(card).toContainText('미확인')
    await expect(page.getByTestId('goal-attainment')).toHaveCount(1)

    // 미결속 — 판정에 쓰는/안 쓰는 기록 대조 → 응시일 선택(목표 다음 날 ~ 목표일)
    await pick(page, 'final_unbound')
    await expect(card).toHaveAttribute('data-status', 'unbound')
    await expect(page.getByTestId('final-counts')).toContainText('고른 날 응시한 9월 모의평가 기록 하나')
    await expect(page.getByTestId('final-excluded')).toContainText('TASK 활동 · 계획 수행량')
    const date = page.getByTestId('final-date')
    await expect(date).toHaveValue('2026-11-19')
    await expect(date).toHaveAttribute('min', '2026-09-02')
    await expect(date).toHaveAttribute('max', '2026-11-19')
    // 9월 기록이 목표 점수를 넘어도 결속 전에는 최종 달성이라 하지 않는다
    await expect(page.locator('body')).not.toContainText('최종 평가 기록이 목표 기준을 충족했어요')
    await page.screenshot({ path: `output/final-assessment-unbound-${width}.png`, fullPage: true })

    // 미설치 서버(503) — 저장된 것처럼 보이지 않는다
    await page.keyboard.press('Shift')
    await date.fill('2026-11-18')
    await page.getByTestId('final-bind').focus()
    expect(await page.getByTestId('final-bind').evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('final-error')).toContainText('저장하지 않았어요')
    expect(await page.evaluate(() => (window as unknown as { __refreshes?: number }).__refreshes ?? 0)).toBe(0)
    // 같은 선택의 재시도는 같은 요청 키 · 성공하면 서버 값으로 다시 읽는다
    reply = { status: 200, body: { binding: { id: 1, goalVersionId: 2, date: '2026-11-18', createdAt: '2026-10-23T01:00:00Z' }, reused: false } }
    await page.getByTestId('final-bind').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __refreshes?: number }).__refreshes ?? 0)).toBe(1)
    expect(posts).toHaveLength(2)
    const [a, b] = posts as { goalVersionId: number; date: string; clientKey: string }[]
    expect(a).toMatchObject({ goalVersionId: 2, date: '2026-11-18' })
    expect(b.clientKey).toBe(a.clientKey)

    // 응시일 전 — 다른 기록으로 대신하지 않는다
    await pick(page, 'final_wait')
    await expect(card).toHaveAttribute('data-status', 'scheduled')
    await expect(page.getByTestId('final-wait')).toContainText('2026-11-19 9월 모의평가 응시 뒤 그날 기록')

    // 결속일 첫 풀이 기록 — 목표 기준 ↔ 기록 대조 · 한계 문구
    await pick(page, 'final_met')
    await expect(card).toHaveAttribute('data-status', 'met')
    await expect(page.getByTestId('final-record')).toContainText('86점 · 2등급')
    await expect(page.getByTestId('final-limit')).toContainText('학습 효과나 다른 시험의 결과를 보장하지 않아요')
    await expect(page.locator('body')).not.toContainText(/\d+%/)
    await page.screenshot({ path: `output/final-assessment-met-${width}.png`, fullPage: true })
    const box = await card.boundingBox()
    const rec = await page.getByTestId('final-record').boundingBox()
    expect(rec!.x + rec!.width).toBeLessThanOrEqual(box!.x + box!.width) // 비교 2열이 카드 밖으로 넘치지 않는다

    // 등급 미기록 — 점수로 등급을 만들지 않고 판정 불가
    await pick(page, 'final_ungraded')
    await expect(card).toHaveAttribute('data-status', 'not_judgeable')
    await expect(page.getByTestId('final-reason')).toContainText('기록에 등급이 없어')
    expect(errors).toEqual([])
  })
}
