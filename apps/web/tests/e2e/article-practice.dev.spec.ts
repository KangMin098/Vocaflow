// apps/web/tests/e2e/article-practice.dev.spec.ts
// R0 같은 기사 발췌 연습 — 실제 ArticlePracticeBridge + /dev/article-practice(합성 문항 · 합성 채점 · 조작 신원).
// 선택 → 피드백 → 근거 짚기 · 다른 선택지 견주기 → 완료 → 읽던 글로 · 계정 전환 뒤 문항 숨김 · 늦은 결과 폐기 · 쓰기 없음.
// 개발 서버 전용 — CI 대상 아님. 실제 기사 개봉 · 서버 채점 · 시도 저장 · 사람 사용성은 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, query = '') {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/article-practice${query}`)
  return writes
}

async function answer(page: Page, n: number) {
  const choices = page.getByRole('radio')
  await expect(choices.first()).toBeVisible()
  await choices.nth(n - 1).click()
  await page.getByRole('button', { name: /제출|확인/ }).first().click()
}

for (const width of [1280, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('발췌 연습 → 피드백 · 근거 짚기 · 견주기 → 완료 → 읽던 글로', async ({ page }) => {
      const writes = await open(page)
      await answer(page, 1)
      await expect(page.getByText('정확해요! 고른 답이 맞았어요.')).toBeVisible()
      await expect(page.getByTestId('meaning-evidence-stem')).toContainText('제목으로 가장 적절한 것은?')
      await page.getByRole('group', { name: '근거 문장 후보' }).getByRole('button').nth(1).click()
      await expect(page.getByTestId('meaning-evidence-compare')).toContainText('조용한 집에서 생각하고')
      await page.getByTestId('meaning-compare-toggle').click()
      await page.getByRole('group', { name: '견줄 선택지' }).getByRole('button').first().click()
      await expect(page.getByTestId('meaning-compare-task')).toBeVisible()
      await page.screenshot({ path: `test-results/article-practice-feedback-${width}.png`, fullPage: true })
      await page.getByRole('button', { name: /다음/ }).click()
      await answer(page, 3) // 틀린 주제
      await expect(page.getByTestId('meaning-evidence-chosen')).toContainText('(정답과 다름)')
      await page.getByRole('button', { name: /다음|마치기|결과/ }).first().click()
      await expect(page.getByText('2문제 중 1문제를 맞혔어요')).toBeVisible()
      const back = page.getByRole('link', { name: /읽던 글로/ })
      await expect(back).toHaveAttribute('href', '/text/dev-text-a')
      expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 20 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await back.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await back.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
      expect(await page.content()).not.toContain('dev-user-a')
      await page.screenshot({ path: `test-results/article-practice-done-${width}.png`, fullPage: true })
      expect(writes).toEqual([])
    })

    test('계정이 바뀌면 문항을 숨긴다', async ({ page }) => {
      await open(page)
      await expect(page.getByRole('radio').first()).toBeVisible()
      await page.getByTestId('as-b').click()
      await expect(page.getByTestId('article-practice-identity')).toContainText('로그인 상태가 바뀌었어요')
      await expect(page.getByRole('radio')).toHaveCount(0)
    })

    test('제출 뒤 응답 전에 계정이 바뀌면 그 결과를 보이지 않는다', async ({ page }) => {
      await open(page, '?delay=1500')
      const choices = page.getByRole('radio')
      await expect(choices.first()).toBeVisible()
      await choices.first().click()
      await page.getByRole('button', { name: /제출|확인/ }).first().click()
      await page.getByTestId('as-b').click()
      await page.waitForTimeout(2000)
      await expect(page.getByText('정확해요!')).toHaveCount(0)
      await expect(page.getByText('조용한 집에서 생각하고')).toHaveCount(0)
      await expect(page.getByTestId('article-practice-identity')).toBeVisible()
    })
  })
}
