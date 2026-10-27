// apps/web/tests/e2e/game-identity.dev.spec.ts
// 게임 판 계정 경계 — 실제 useGameSessionRecorder + GameIdentityNotice · /dev/game-identity 하네스(합성 신원 · 기록 대역).
// 판의 주인 = 단어를 읽은 사람(scope.viewerId = A). recorder 가 따로 읽은 신원으로 주인을 정하지 않는다.
// (a)(c) A 가 집계한 뒤 B 로 바뀌면 게임을 내리고 · 옛 화면 입력 · 떠날 때 적재 없음
// (b) 기준선이 늦게 와도 그 전에 본 바뀜으로 무효 (d) 같은 사람 토큰 갱신은 A 몫으로 적재 (e) A→B→A 되살리지 않음
// (f) A 의 자료를 읽었는데 브라우저가 이미 B 면 게임을 그리지 않는다(Codex 설계 검토 반례 1)
// 개발 서버 전용 — CI 대상 아님. 실제 Auth · scores · SRS DB 는 증명하지 않는다(기록 함수는 대역).
import { expect, test, type Page } from '@playwright/test'

const A = 'harness-player-a'
const WIDTHS = [1280, 1440]

async function open(page: Page, qs = '') {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/game-identity${qs}`)
  return writes
}
const log = (page: Page) => page.getByTestId('harness-log')
const game = (page: Page) => page.getByTestId('game')
const notice = (page: Page, status: string) => page.locator(`[data-game-private="${status}"]`)

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('(a)(c) A 2개 집계 → B 로그인: 게임을 내리고, 옛 입력 · 떠나기 모두 기록 없음', async ({ page }) => {
      const writes = await open(page)
      await expect(game(page)).toBeVisible()
      await page.getByTestId('answer-correct').click()
      await page.getByTestId('answer-wrong').click()
      await expect(log(page)).toHaveText(`result:${A}:harvest,result:${A}:drought`)
      await page.getByTestId('to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(game(page)).toHaveCount(0)
      // 옛 화면 키보드 — 게임 버튼이 없다
      for (const k of ['Enter', 'Space', '1', '2']) await page.keyboard.press(k)
      await page.getByTestId('leave').click()
      await page.waitForTimeout(300)
      await expect(log(page)).toHaveText(`result:${A}:harvest,result:${A}:drought`)
      expect(writes).toEqual([])
      // 안내: 다시 열기 · 로그인 · 44px · Tab 으로 닿는 focus
      const reopen = page.locator('[data-game-reopen]')
      await expect(reopen).toHaveCount(0) // 떠난 뒤라 안내도 내려갔다
    })

    test('(a′) 바뀐 화면의 안내 — 다시 열기 · 로그인 링크 · 44px · 보이는 focus', async ({ page }) => {
      await open(page)
      await page.getByTestId('to-b').click()
      const reopen = page.locator('[data-game-reopen]')
      await expect(reopen).toHaveAttribute('href', '/dev/game-identity')
      await expect(page.locator('[data-game-login]')).toBeVisible()
      expect((await reopen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 20 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await reopen.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await reopen.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
    })

    test('(b) 기준선이 늦게 오면 확인 중 — 그 사이 B 로그인이면 게임을 그리지 않고 기록 없음', async ({ page }) => {
      await open(page, '?slow=1500')
      await expect(notice(page, 'checking')).toBeVisible()
      await expect(game(page)).toHaveCount(0)
      await page.getByTestId('to-b').click()
      await page.waitForTimeout(1800)
      await expect(notice(page, 'changed')).toBeVisible()
      await page.getByTestId('leave').click()
      await page.waitForTimeout(300)
      await expect(log(page)).toHaveText('')
    })

    test('(d) 같은 사람의 토큰 갱신은 유지 — A 몫으로 적재', async ({ page }) => {
      await open(page)
      await page.getByTestId('answer-correct').click()
      await page.getByTestId('refresh-a').click()
      await expect(game(page)).toBeVisible()
      await page.getByTestId('answer-correct').click()
      await page.getByTestId('leave').click()
      await expect(log(page)).toHaveText(`result:${A}:harvest,result:${A}:harvest,score:${A}:2/2`)
    })

    test('(e) A→B→A 는 되살리지 않음', async ({ page }) => {
      await open(page)
      await page.getByTestId('answer-correct').click()
      await page.getByTestId('to-b').click()
      await page.getByTestId('to-a').click()
      await page.waitForTimeout(300)
      await expect(notice(page, 'changed')).toBeVisible()
      await page.getByTestId('leave').click()
      await page.waitForTimeout(300)
      await expect(log(page)).toHaveText(`result:${A}:harvest`)
    })

    test('(f) A 의 자료인데 브라우저가 이미 B — 게임 없음 · 기록 없음', async ({ page }) => {
      await open(page, '?browser=b')
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(game(page)).toHaveCount(0)
      await page.getByTestId('leave').click()
      await page.waitForTimeout(300)
      await expect(log(page)).toHaveText('')
    })
  })
}

test.describe('로그아웃', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  test('로그아웃 뒤 떠나면 점수 적재 없음', async ({ page }) => {
    await open(page)
    await page.getByTestId('answer-correct').click()
    await page.getByTestId('signout').click()
    await expect(notice(page, 'changed')).toBeVisible()
    await page.getByTestId('leave').click()
    await page.waitForTimeout(300)
    await expect(log(page)).toHaveText(`result:${A}:harvest`)
  })
})
