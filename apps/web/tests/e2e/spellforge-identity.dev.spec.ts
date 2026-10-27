// apps/web/tests/e2e/spellforge-identity.dev.spec.ts
// SpellForge 계정 경계 — 실제 GameViewerGate + SpellForge + 실제 대기열(srs_pending) · /dev/spellforge-identity 하네스(합성 단어 · 주입 신원 · 음성 대역).
// 연습의 주인 = 서버가 단어를 읽은 사람(A). 화면이 내려간 뒤 남은 옛 확인 · 건너뛰기 · 키보드 콜백, 예약 발음도 B 의 큐 · 발화를 만들지 않는다.
// 개발 서버 전용 — CI 대상 아님. 실제 Auth · SRS DB · 실제 음성은 증명하지 않는다(서버 Action 은 전송 전에 막는다).
import { expect, test, type Page } from '@playwright/test'

const A = 'harness-sf-a'
const WIDTHS = [1280, 1440]

async function open(page: Page, qs = '') {
  const writes: string[] = []
  await page.addInitScript(() => {
    localStorage.setItem('spellforge:mode', 'delayed')
    window.confirm = () => true
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
    }
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
  })
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/spellforge-identity${qs}`)
  return writes
}
const input = (page: Page) => page.getByLabel('단어 입력')
const queue = (page: Page) => page.getByTestId('sf-queue')
const notice = (page: Page, s: string) => page.locator(`[data-game-private="${s}"]`)
const speech = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __speech: { speak: number; cancel: number; active: boolean } }).__speech }))

/** 지금 화면의 단어(뜻을 보고 철자) — 하네스 단어 순서는 섞일 수 있어 뜻으로 고른다 */
async function answer(page: Page) {
  const map: Record<string, string> = { 수확: 'harvest', 가뭄: 'drought', 홍수: 'flooding' }
  const html = await page.content()
  const key = Object.keys(map).find((k) => html.includes(k))!
  await input(page).fill(map[key])
  await page.keyboard.press('Enter')
  return map[key]
}

/** 실제 확인 단추 · 건너뛰기 단추의 React onClick 을 붙잡아 둔다(화면이 내려간 뒤 남은 옛 콜백) */
async function holdCallbacks(page: Page) {
  await page.evaluate(() => {
    const props = (el: Element) => {
      const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))!
      return (el as unknown as Record<string, { onClick?: () => void }>)[k]
    }
    const skip = [...document.querySelectorAll('button')].find((b) => /건너뛰기/.test(b.textContent ?? ''))
    ;(window as unknown as { __oldSkip?: () => void }).__oldSkip = skip ? props(skip).onClick : undefined
  })
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('정상 A: 맞히면 A 큐 · 발음 1회', async ({ page }) => {
      await open(page)
      await expect(input(page)).toBeVisible()
      const w = await answer(page)
      await expect(queue(page)).toHaveText(`${A}:${w}`)
      await expect.poll(async () => (await speech(page)).speak).toBe(1)
    })

    test('A 가 하나 맞힌 뒤 B 로그인: 화면을 내리고 옛 건너뛰기 · 키보드는 B 큐를 만들지 않는다 · A 항목 보존', async ({ page }) => {
      const writes = await open(page)
      const w = await answer(page)
      await expect(queue(page)).toHaveText(`${A}:${w}`)
      // 정답 뒤 잠깐 멈춤 화면(전체 덮개) → Space 로 다음 단어(Enter 는 같은 단어를 다시 확인해 두 번 기록된다 — 별도 결함으로 보고)
      await page.waitForTimeout(1200)
      await page.keyboard.press('Space')
      await expect(input(page)).toBeVisible()
      await holdCallbacks(page)
      await page.getByTestId('sf-to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(input(page)).toHaveCount(0)
      await page.evaluate(() => (window as unknown as { __oldSkip?: () => void }).__oldSkip?.())
      for (const k of ['Enter', 'Tab', 'Escape']) await page.keyboard.press(k)
      await page.waitForTimeout(400)
      await expect(queue(page)).toHaveText(`${A}:${w}`)
      expect(writes.filter((x) => !/^POST \/(dev\/spellforge-identity|api\/srs\/flush)$/.test(x))).toEqual([])
    })

    test('정답 직후(예약 발음 200ms 전) B 로그인: 예약 발음은 읽지 않는다', async ({ page }) => {
      await open(page)
      await expect(input(page)).toBeVisible()
      const map: Record<string, string> = { 수확: 'harvest', 가뭄: 'drought', 홍수: 'flooding' }
      const html = await page.content()
      const key = Object.keys(map).find((k) => html.includes(k))!
      await input(page).fill(map[key])
      // Enter 와 B 전환을 같은 틱에 — 200ms 예약 발음보다 먼저 바뀐다
      await page.evaluate(() => {
        document.querySelector<HTMLInputElement>('input[aria-label="단어 입력"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        ;(document.querySelector('[data-testid="sf-to-b"]') as HTMLButtonElement).click()
      })
      await page.waitForTimeout(600)
      expect((await speech(page)).speak).toBe(0)
    })

    test('재생 중 B 로그인이면 그 발화를 멈춘다 · 재생 없으면 cancel 없음', async ({ page }) => {
      await open(page)
      await expect(input(page)).toBeVisible()
      await answer(page)
      await expect.poll(async () => (await speech(page)).active).toBe(true)
      await page.getByTestId('sf-to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      expect((await speech(page)).active).toBe(false)

      await open(page)
      await expect(input(page)).toBeVisible()
      const s0 = await speech(page)
      await page.getByTestId('sf-to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      expect((await speech(page)).cancel).toBe(s0.cancel)
    })

    test('A→B→A 되살리지 않음 · 로그아웃 · 토큰 갱신 유지 · 브라우저가 처음부터 B', async ({ page }) => {
      await open(page)
      await expect(input(page)).toBeVisible()
      await page.getByTestId('sf-to-b').click()
      await page.getByTestId('sf-to-a').click()
      await page.waitForTimeout(300)
      await expect(notice(page, 'changed')).toBeVisible()
      await open(page)
      await page.getByTestId('sf-refresh-a').click()
      const w = await answer(page)
      await expect(queue(page)).toHaveText(`${A}:${w}`)
      await page.getByTestId('sf-signout').click()
      await expect(notice(page, 'changed')).toBeVisible()
      await open(page, '?browser=b')
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(input(page)).toHaveCount(0)
    })
  })
}
