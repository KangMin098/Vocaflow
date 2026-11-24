// apps/web/tests/e2e/spellforge-identity.dev.spec.ts
// SpellForge 계정 경계 — 실제 GameViewerGate + SpellForge + 실제 대기열(srs_pending) · /dev/spellforge-identity 하네스(합성 단어 · 주입 신원 · 음성 대역).
// 연습의 주인 = 서버가 단어를 읽은 사람(A). 화면이 내려간 뒤 남은 옛 확인 · 건너뛰기 · 키보드 콜백, 예약 발음도 B 의 큐 · 발화를 만들지 않는다.
// 개발 서버 전용 — CI 대상 아님. 실제 Auth · SRS DB · 실제 음성은 증명하지 않는다(서버 Action 은 전송 전에 막는다).
import { expect, test, type Page } from '@playwright/test'

const A = 'harness-sf-a'
const WIDTHS = [1280, 1440]

async function open(page: Page, qs = '', mode: 'delayed' | 'blind' = 'delayed') {
  const writes: string[] = []
  await page.addInitScript((m) => {
    localStorage.setItem('spellforge:mode', m)
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
  }, mode)
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
  // 입력 칸과 지금 단어의 뜻이 그려진 뒤에 답한다(준비 전에 답하면 undefined 를 적는다 — Codex 지적)
  await expect(input(page)).toBeVisible()
  await expect.poll(async () => {
    const h = await page.content()
    return Object.keys(map).some((k) => h.includes(k))
  }).toBe(true)
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

test.describe('멈춤 화면 Enter — 이중 기록 결함', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  test('정답 뒤 멈춤 화면에서 Enter 로 넘어가도 같은 단어 평가는 1건', async ({ page }) => {
    await open(page)
    await expect(input(page)).toBeVisible()
    const w = await answer(page)
    await page.waitForTimeout(1200)
    await page.keyboard.press('Enter')
    await expect(input(page)).toBeVisible()
    await page.waitForTimeout(400)
    await expect(queue(page)).toHaveText(`${A}:${w}`)
  })
})

test.describe('대기열 주인 해석이 늦을 때 — Codex 반례', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  test('첫 평가 때 주인이 아직 null 이어도 A 몫으로 남는다(주인 없는 보류 · 유실 없음)', async ({ page }) => {
    await open(page, '?ownerDelay=4000')
    const w = await answer(page)
    await expect(queue(page)).toHaveText(`${A}:${w}`)
    const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { word: string; owner?: string }[])
    expect(raw.filter((r) => r.word === w).map((r) => r.owner ?? null)).toEqual([A])
  })
})

test.describe('오답 뒤 학습자 주도 재시도 — 3초 자동 삭제 제거', () => {
  for (const width of WIDTHS) {
    for (const mode of ['delayed', 'blind'] as const) {
      test(`${width}px ${mode}: 고친 입력 유지 · 「다시 입력하기」 44px · 키보드 · 입력 복귀 · 대기열 0→1`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        const writes = await open(page, '', mode)
        await expect(input(page)).toBeVisible()
        await input(page).fill('zzzz')
        await page.keyboard.press('Enter')
        const retry = page.getByRole('button', { name: '다시 입력하기' })
        await expect(retry).toBeVisible()
        // 3초 직전에 고쳐 쓰기 시작 → 3초를 넘겨도 지워지지 않는다
        await page.waitForTimeout(2700)
        await input(page).fill('river')
        await page.waitForTimeout(2600)
        await expect(input(page)).toHaveValue('river')
        await expect(retry).toBeVisible()
        // 단추: 44px · 키보드 포커스 표시 · Enter 는 단추만(같은 오답 재확인 없음) · 입력 칸으로 복귀
        const box = await retry.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        // 실제 키보드 길: 입력 칸에서 Tab 으로 단추까지(오답 중 Tab 은 힌트로 삼키지 않는다)
        await input(page).focus()
        for (let i = 0; i < 4 && !(await retry.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
        await expect(retry).toBeFocused()
        expect(await retry.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
        const outline = await retry.evaluate((el) => getComputedStyle(el).outlineStyle)
        expect(outline).not.toBe('none')
        await page.keyboard.press('Enter')
        await expect(retry).toHaveCount(0)
        await expect(input(page)).toHaveValue('')
        await expect(input(page)).toBeFocused()
        await expect(queue(page)).toHaveText('')
        // 반복 오답 → Space 재시도도 대기열 0
        await input(page).fill('qqqq')
        await page.keyboard.press('Enter')
        await retry.focus()
        await page.keyboard.press('Space')
        await expect(input(page)).toBeFocused()
        await expect(queue(page)).toHaveText('')
        // 정답 1회 → 1건
        const w = await answer(page)
        await expect(queue(page)).toHaveText(`${A}:${w}`)
        expect(writes.filter((x) => !/^POST \/(dev\/spellforge-identity|api\/srs\/flush)$/.test(x))).toEqual([])
      })
    }
  }
})
