// apps/web/tests/e2e/wordvault-membership.dev.spec.ts
// 기사 단어장 정본 membership — 실제 WordVaultBrowseClient + /dev/wordvault-membership 하네스(합성 자료, DB·Auth·쓰기 없음).
// 칩 전환·늦은 응답·조회 실패·같은 URL 새 서버 prop·매 렌더 새 조회 함수에도 루프 없음·키보드. 개발 서버 전용 — CI(next start) 대상 아님.
// 실제 Auth+DB 종단(본인 세션 정본 조회)은 이 스펙이 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1280, 1440]
const A = '00000000-0000-4000-8000-00000000000a'

async function ids(page: Page) {
  return (await page.getByTestId('word-row').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-id'))))).sort()
}
const chip = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(label) })
const calls = (page: Page) => page.getByTestId('harness-calls')
const failed = (page: Page) => page.getByTestId('vocab-set-membership-failed')

async function open(page: Page, qs = '') {
  // 쓰기성 요청은 보내지 않는다 — 보이면 실패
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${r.url()}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/wordvault-membership${qs}`)
  await expect(page.getByTestId('word-row').first()).toBeVisible()
  return writes
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('전체 → A → B → A: 다른 출처 A 정본 포함, 행 중복 없음, 조회는 칩마다 한 번(매 렌더 새 함수에도 루프 없음)', async ({ page }) => {
      const writes = await open(page)
      await expect.poll(() => ids(page)).toEqual([1, 2, 3, 4])
      await chip(page, '기사 A').click()
      await expect.poll(() => ids(page)).toEqual([1, 2, 3])
      await chip(page, '기사 B').click()
      await expect.poll(() => ids(page)).toEqual([2, 4])
      // B 정본은 origin B 와 같은 행이라 목록으로는 완료가 안 보인다 — 하네스 응답(150ms)이 끝나길 기다린다
      await page.waitForTimeout(600)
      await chip(page, '기사 A').click()
      await expect.poll(() => ids(page)).toEqual([1, 2, 3])
      await page.waitForTimeout(800)
      await expect(calls(page)).toHaveText('A,B,A')
      await expect(failed(page)).toHaveCount(0)
      expect(writes).toEqual([])
    })

    test('늦은 A 응답이 먼저 끝난 B 를 덮지 않는다', async ({ page }) => {
      await open(page, '?slow=A')
      await chip(page, '기사 A').click()
      await chip(page, '기사 B').click()
      await page.waitForTimeout(2200)
      expect(await ids(page)).toEqual([2, 4])
      await expect(chip(page, '기사 B')).toHaveAttribute('aria-selected', 'true')
    })

    test('조회 실패는 안내 + origin 만, 다른 세트로 옮기면 안내가 사라진다', async ({ page }) => {
      await open(page, '?fail=B')
      await chip(page, '기사 A').click()
      await expect.poll(() => ids(page)).toEqual([1, 2, 3])
      await chip(page, '기사 B').click()
      await expect(failed(page)).toBeVisible()
      expect(await ids(page)).toEqual([2, 4])
      await chip(page, '기사 A').click()
      await expect(failed(page)).toHaveCount(0)
    })

    test('같은 URL 의 새 서버 prop 을 반영한다(재조회 없음)', async ({ page }) => {
      await open(page, `?filter=set:${A}&initial=A`)
      await expect.poll(() => ids(page)).toEqual([1, 2, 3])
      await page.getByTestId('harness-prop-a-no-harvest').click()
      await expect.poll(() => ids(page)).toEqual([1, 3])
      await page.getByTestId('harness-prop-a-error').click()
      await expect(failed(page)).toBeVisible()
      expect(await ids(page)).toEqual([1])
      await expect(calls(page)).toHaveText('')
    })

    test('키보드: 칩 Enter 로 선택, 보이는 focus', async ({ page }) => {
      await open(page)
      const a = chip(page, '기사 A')
      await a.focus()
      await page.keyboard.press('Enter')
      await expect(a).toHaveAttribute('aria-selected', 'true')
      await expect.poll(() => ids(page)).toEqual([1, 2, 3])
      expect(await a.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
    })
  })
}
