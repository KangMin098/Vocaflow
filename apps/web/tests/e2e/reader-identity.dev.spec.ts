// apps/web/tests/e2e/reader-identity.dev.spec.ts
// 읽기 화면 계정 경계 — 실제 ReaderViewerGate + 실제 tts-controller · /dev/reader-identity 하네스(합성 지문 · 주입 신원 · 음성 대역).
// 글의 주인(A)과 브라우저 신원이 같을 때만 본문 · 제목을 그리고, 바뀌거나 재확인 중이면 감추고 읽던 음성을 멈춘다.
// 개발 서버 전용 — CI 대상 아님. 실제 /text/[id] 경로(레이아웃 GET 기록 쓰기) · 실제 Auth · 실제 음성 장치는 증명하지 않는다.
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1280, 1440]

async function open(page: Page, qs = '') {
  await page.addInitScript(() => {
    const st = { speak: 0, cancel: 0, active: false }
    ;(window as unknown as { __speech: typeof st }).__speech = st
    const fake = {
      speak: () => {
        st.speak += 1
        st.active = true
      },
      cancel: () => {
        st.cancel += 1
        st.active = false
      },
      pause: () => {},
      resume: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      onvoiceschanged: null,
      speaking: false,
      paused: false,
      pending: false,
    }
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
  })
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/reader-identity${qs}`)
  return writes
}
const body = (page: Page) => page.getByTestId('reader-body')
const gate = (page: Page, s: string) => page.locator(`[data-reader-private="${s}"]`)
const speech = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __speech: { speak: number; cancel: number; active: boolean } }).__speech }))

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('같은 A: 본문이 보이고 읽어 주기 · B 로그인이면 본문을 감추고 읽던 음성을 멈춘다', async ({ page }) => {
      const writes = await open(page)
      await expect(body(page)).toBeVisible()
      await page.getByTestId('reader-play').click()
      await expect.poll(async () => (await speech(page)).active).toBe(true)
      await page.getByTestId('rd-to-b').click()
      await expect(gate(page, 'changed')).toBeVisible()
      await expect(page.getByText('prv-title')).toHaveCount(0)
      await expect(page.getByText('My private diary')).toHaveCount(0)
      expect((await speech(page)).active).toBe(false)
      expect(writes).toEqual([])
    })

    test('다시 열기 · 로그인 안내 — 44px · Tab 으로 닿는 보이는 focus', async ({ page }) => {
      await open(page)
      await page.getByTestId('rd-to-b').click()
      const reopen = page.locator('[data-reader-reopen]')
      await expect(reopen).toHaveAttribute('href', '/text/harness-text')
      await expect(page.locator('[data-reader-login]')).toBeVisible()
      expect((await reopen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 20 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await reopen.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await reopen.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
    })

    test('A→B→A 되살리지 않음 · 로그아웃 감춤 · 토큰 갱신 유지 · 브라우저가 처음부터 B', async ({ page }) => {
      await open(page)
      await page.getByTestId('rd-to-b').click()
      await page.getByTestId('rd-to-a').click()
      await page.waitForTimeout(300)
      await expect(gate(page, 'changed')).toBeVisible()
      await open(page)
      await page.getByTestId('rd-refresh-a').click()
      await expect(body(page)).toBeVisible()
      await page.getByTestId('rd-signout').click()
      await expect(gate(page, 'changed')).toBeVisible()
      await open(page, '?browser=b')
      await expect(gate(page, 'changed')).toBeVisible()
      await expect(page.getByText('prv-title')).toHaveCount(0)
    })

    test('재확인 중(checking)이면 감추고 음성을 멈춘다 · 같은 A 로 재확인되면 다시 보인다', async ({ page }) => {
      await open(page, '?slow=1500')
      await expect(body(page)).toBeVisible()
      await page.getByTestId('reader-play').click()
      await expect.poll(async () => (await speech(page)).active).toBe(true)
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
      await expect(gate(page, 'checking')).toBeVisible()
      expect((await speech(page)).active).toBe(false)
      await expect(body(page)).toBeVisible({ timeout: 4000 })
    })
  })
}
