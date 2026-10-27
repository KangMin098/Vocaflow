// apps/web/tests/e2e/meaning-evidence.dev.spec.ts
// 의미 선택 뒤 「본문 근거 짚기 → 해설과 나란히」 — 실제 DcpPlayer + /dev/meaning-evidence(합성 문항 · 로컬 채점).
// 짚은 문장은 판정하지 않는다 · 건너뛰어도 다음으로 · 문항이 바뀌면 새로 · 빈칸 유형에는 없다 · 해설이 없으면 그대로 말한다.
// 개발 서버 전용 — CI 대상 아님. 실제 교재 · 기사 경로 · 서버 채점 · 사람 사용성은 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1280, 1440]

async function open(page: Page) {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto('/dev/meaning-evidence')
  return writes
}

/** n 번째(1부터) 선택지를 고르고 제출 */
async function answer(page: Page, n: number) {
  const choices = page.getByRole('radio')
  await expect(choices.first()).toBeVisible()
  await choices.nth(n - 1).click()
  await page.getByRole('button', { name: /제출|확인/ }).first().click()
}
const box = (page: Page) => page.getByTestId('meaning-evidence')

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('맞힌 제목: 고른 답을 되짚고, 근거 문장을 짚으면 해설과 나란히(판정 없음)', async ({ page }) => {
      const writes = await open(page)
      await answer(page, 1)
      await expect(page.getByText('정확해요! 고른 답이 맞았어요.')).toBeVisible()
      await expect(page.getByText('근거를 잘 찾았어요')).toHaveCount(0)
      await expect(page.getByTestId('meaning-evidence-chosen')).toContainText('A Bakery Loved for Its Slow Bread')
      await expect(page.getByTestId('meaning-evidence-chosen')).toContainText('(정답)')
      const sentences = box(page).getByRole('group', { name: '근거 문장 후보' }).getByRole('button')
      await expect(sentences).toHaveCount(4)
      await sentences.nth(2).click()
      const compare = page.getByTestId('meaning-evidence-compare')
      await expect(compare).toContainText('People line up before sunrise')
      await expect(compare).toContainText('빵을 손으로 천천히 굽는')
      // 판정 문구가 없다
      await expect(compare).not.toContainText(/맞았|틀렸|정답 근거/)
      expect(writes).toEqual([])
    })

    test('틀린 주제: 고른 답(정답과 다름)과 정답 근거 짚기 · 건너뛰어도 다음으로 · 다음 문항은 새로', async ({ page }) => {
      await open(page)
      await answer(page, 1)
      await page.getByRole('button', { name: /다음/ }).click()
      await answer(page, 3)
      await expect(page.getByTestId('meaning-evidence-chosen')).toContainText('(정답과 다름)')
      await expect(page.getByTestId('meaning-evidence-chosen')).toContainText('opening hours of shops')
      await expect(box(page)).toContainText('정답을 받치는')
      await expect(page.getByTestId('meaning-evidence-compare')).toHaveCount(0) // 이전 문항 상태가 넘어오지 않았다
      // 키보드로 건너뛰기 — 포커스가 BODY 로 떨어지지 않고 안내로 이어진다
      await page.getByTestId('meaning-evidence-skip').focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('meaning-evidence-skipped')).toBeVisible()
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('meaning-evidence-skipped')
      await page.getByRole('button', { name: /다음/ }).click()
      // 빈칸 유형에는 근거 짚기가 없다
      await answer(page, 1)
      await expect(box(page)).toHaveCount(0)
      await expect(page.getByTestId('meaning-evidence-skipped')).toHaveCount(0)
    })

    test('해설이 없는 문항은 없다고 말한다 · 키보드로 짚고 보이는 focus', async ({ page }) => {
      await open(page)
      for (const n of [1, 1, 1]) {
        await answer(page, n)
        await page.getByRole('button', { name: /다음/ }).click()
      }
      await answer(page, 1)
      const first = box(page).getByRole('group', { name: '근거 문장 후보' }).getByRole('button').first()
      let reached = false
      for (let i = 0; i < 30 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await first.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await first.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
      expect((await first.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('meaning-evidence-no-explanation')).toBeVisible()
      await page.screenshot({ path: `test-results/meaning-evidence-${width}.png`, fullPage: true })
    })
  })
}
