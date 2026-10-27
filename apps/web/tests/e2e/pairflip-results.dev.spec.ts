// apps/web/tests/e2e/pairflip-results.dev.spec.ts
// PairFlip 결과 화면 계정 경계 — 실제 PairFlipResultsGate · PairFlipResultScreen · /dev/pairflip-results 하네스(합성 결과 · 주입 신원).
// 결과(학습한 단어 · 뜻)는 저장 주인과 지금 브라우저 신원이 같을 때만 보인다. 주인 미상 결과는 보류(지우지 · 채택하지 않음).
// 개발 서버 전용 — CI 대상 아님. 실제 Auth 는 증명하지 않는다(같은 경로의 실제 로그인 확인은 runtime/game-identity-pc).
import { expect, test, type Page } from '@playwright/test'

const WORD = 'priorownerprivateword'
const WIDTHS = [1280, 1440]

async function open(page: Page, qs: string) {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/pairflip-results${qs}`)
  await page.waitForTimeout(500)
  return writes
}
const word = (page: Page) => page.getByText(WORD)
const notice = (page: Page, s: string) => page.locator(`[data-game-private="${s}"]`)

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('같은 A: 결과(단어)가 보인다 · B 로 바뀌면 감춘다 · A→B→A 되살리지 않음', async ({ page }) => {
      const writes = await open(page, '?owner=a&browser=a')
      await expect(word(page).first()).toBeVisible()
      await page.getByTestId('pfr-to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(word(page)).toHaveCount(0)
      await page.getByTestId('pfr-to-a').click()
      await page.waitForTimeout(300)
      await expect(word(page)).toHaveCount(0)
      expect(writes).toEqual([])
    })

    test('A 의 결과를 B 브라우저가 열면 보이지 않는다 · 로그아웃도 감춘다', async ({ page }) => {
      await open(page, '?owner=a&browser=b')
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(word(page)).toHaveCount(0)
      await open(page, '?owner=a&browser=a')
      await expect(word(page).first()).toBeVisible()
      await page.getByTestId('pfr-signout').click()
      await expect(word(page)).toHaveCount(0)
    })

    test('주인 미상(예전) 결과는 보류 — 새 판 시작 안내 · 44px · 보이는 focus', async ({ page }) => {
      await open(page, '?owner=legacy&browser=b')
      await expect(notice(page, 'unowned')).toBeVisible()
      await expect(word(page)).toHaveCount(0)
      const start = page.locator('[data-game-reopen]')
      await expect(start).toHaveAttribute('href', '/pairflip')
      expect((await start.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 20 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await start.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await start.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
    })

    test('로그인 없이 한 판(owner=null)은 로그인 없는 브라우저에서만 · 재확인 중에는 감춘다', async ({ page }) => {
      await open(page, '?owner=none&browser=none')
      await expect(word(page).first()).toBeVisible()
      await open(page, '?owner=none&browser=a')
      await expect(word(page)).toHaveCount(0)
      await open(page, '?owner=a&browser=a&slow=1500')
      await expect(word(page).first()).toBeVisible()
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
      await expect(notice(page, 'checking')).toBeVisible()
      await expect(word(page)).toHaveCount(0)
      await expect(word(page).first()).toBeVisible({ timeout: 4000 })
    })
  })
}
