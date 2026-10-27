// apps/web/tests/e2e/insert-feedback.dev.spec.ts
// 삽입 해설 후보 번호 ↔ 실제 이음매 — 실제 DcpPlayer + /dev/insert-feedback(합성 문항 · 로컬 채점 · 생성기 해설 그대로).
// 채점 전에는 후보 표시가 없다 · 오답 뒤 정답 키로만 · 7문장(인쇄 후보 부분집합) · 3문장 끝자리 · 다른 writer 는 표시 없음.
// 개발 서버 전용 — CI 대상 아님. 실제 문항 노출 · 서버 채점 · 사람 사용성은 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

/** 화면의 n 번째(0부터) 자리를 고르고 제출 */
async function answerSlot(page: Page, n: number) {
  const slots = page.getByRole('button', { name: /번째 위치에 삽입/ })
  await expect(slots.first()).toBeVisible()
  await slots.nth(n).click()
  await page.getByRole('button', { name: /제출|확인/ }).first().click()
}

for (const width of [1280, 1440]) {
  test(`${width}px: 해설 번호가 실제 이음매를 가리킨다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    const writes: string[] = []
    await page.route('**/*', (route) => {
      const r = route.request()
      if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
        writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
        return route.abort()
      }
      return route.continue()
    })
    await page.goto('/dev/insert-feedback')

    // 7문장 — 채점 전에는 후보 표시 없음
    await expect(page.getByRole('button', { name: /번째 위치에 삽입/ })).toHaveCount(8)
    await expect(page.getByTestId('insert-seam-mark')).toHaveCount(0)
    await expect(page.getByTestId('insert-seam-legend')).toHaveCount(0)
    await answerSlot(page, 0) // 오답
    await expect(page.getByTestId('insert-seam-legend')).toBeVisible()
    const marks = page.getByTestId('insert-seam-mark')
    await expect(marks).toHaveCount(3)
    await expect(marks.nth(0)).toHaveAttribute('aria-label', /해설 ①/)
    await expect(marks.nth(1)).toHaveAttribute('aria-label', /해설 ②/)
    await expect(marks.nth(2)).toHaveAttribute('aria-label', /해설 ④/)
    const answer = page.getByTestId('insert-seam-answer')
    await expect(answer).toContainText('해설 ③ · 정답 자리')
    // ② 는 화면 셋째 자리(이음매 3) — "the gym to the garden." 바로 뒤에 놓인다
    const order = await page.locator('ol li').allTextContents()
    const gymIdx = order.findIndex((t) => t.includes('from the gym to the garden.'))
    expect(order[gymIdx + 1]).toContain('해설 ②')
    const fenceIdx = order.findIndex((t) => t.includes('taller than the fence'))
    expect(order[fenceIdx + 1]).toContain('해설 ③')
    expect((await marks.first().locator('span').first().boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: `test-results/insert-feedback-7-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: /다음/ }).click()

    // 3문장 · 끝자리 정답 — 키보드로 고른다
    await expect(page.getByRole('button', { name: /번째 위치에 삽입/ })).toHaveCount(4)
    await page.getByRole('button', { name: /번째 위치에 삽입/ }).first().focus()
    await page.keyboard.press('Space')
    await page.getByRole('button', { name: /제출|확인/ }).first().press('Enter')
    await expect(page.getByTestId('insert-seam-answer')).toContainText('해설 ③ · 정답 자리')
    await expect(page.getByTestId('insert-seam-mark')).toHaveCount(2)
    await page.getByRole('button', { name: /다음/ }).click()

    // 4문장 — 맞히면 키가 없어 후보 표시도 없다(새 조회 없음)
    await answerSlot(page, 2)
    await expect(page.getByTestId('insert-seam-legend')).toHaveCount(0)
    await page.getByRole('button', { name: /다음/ }).click()

    // 다른 writer — 오답이어도 후보 표시 없이 해설만
    await answerSlot(page, 0)
    await expect(page.getByText(/손가락이 아팠다는 어려움/)).toBeVisible()
    await expect(page.getByTestId('insert-seam-mark')).toHaveCount(0)
    await expect(page.getByTestId('insert-seam-legend')).toHaveCount(0)
    expect(writes).toEqual([])
  })
}
