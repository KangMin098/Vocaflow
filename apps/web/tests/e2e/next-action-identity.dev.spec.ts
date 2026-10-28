// apps/web/tests/e2e/next-action-identity.dev.spec.ts
// 추천 P2 신원 결속 — 실제 useNextAction · useStoryAuthGuard · NextActionCard + /dev/next-action-identity(합성 응답 · 조작 신원).
// A 확인 뒤에만 개인 글 · 확인 전 비표시 · B 전환/로그아웃 뒤 숨김 · B 화면에 늦게 온 A 응답 차단 · 쓰기 없음.
// 개발 서버 전용 — CI 대상 아님. 실제 서버 조회 · 실제 Auth · 실제 개인 글은 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, query: string) {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/next-action-identity${query}`)
  return writes
}

const card = (page: Page) => page.getByRole('region', { name: '다음 추천' })

for (const width of [1280, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('A 확인 뒤 개인 글 → B 전환 · 로그아웃이면 숨김', async ({ page }) => {
      const writes = await open(page, '?delay=50')
      await expect(card(page)).toContainText('My Garden Essay 이어 보기')
      const link = card(page).getByRole('link').first()
      await expect(link).toHaveAttribute('href', '/text/dev-text-a')
      expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 15 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await link.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await link.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
      expect(await page.content()).not.toContain('dev-user-a') // 소유자 uid 는 DOM 에 없다
      await page.screenshot({ path: `test-results/next-action-identity-${width}.png` })
      await page.getByTestId('as-b').click()
      await expect(card(page)).not.toContainText('My Garden Essay')
      await expect(card(page)).toContainText('철자로 다지기')
      await expect(card(page).getByRole('link').first()).not.toHaveAttribute('href', '/text/dev-text-a')
      expect(writes).toEqual([])
    })

    test('로그아웃 뒤 숨김', async ({ page }) => {
      await open(page, '?delay=50')
      await expect(card(page)).toContainText('My Garden Essay 이어 보기')
      await page.getByTestId('sign-out').click()
      await expect(card(page)).not.toContainText('My Garden Essay')
    })

    test('B 화면에 늦게 도착한 A 의 응답은 개인 글을 보이지 않는다', async ({ page }) => {
      await open(page, '?start=b&delay=800')
      await page.waitForTimeout(1200)
      await expect(card(page)).toContainText('철자로 다지기')
      await expect(card(page)).not.toContainText('My Garden Essay')
      expect(await page.content()).not.toContain('dev-text-a')
    })

    test('A 로 시작해도 응답 전 · 전환 뒤 늦게 온 응답은 보이지 않는다', async ({ page }) => {
      await open(page, '?delay=800')
      await expect(card(page)).not.toContainText('My Garden Essay') // 응답 전 기본 추천
      await page.getByTestId('as-b').click()
      await page.waitForTimeout(1200)
      await expect(card(page)).not.toContainText('My Garden Essay')
    })
  })
}
