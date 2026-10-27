// apps/web/tests/e2e/study-identity.dev.spec.ts
// WordVault 학습 계정 경계 — 실제 WordVaultViewerGate + StudyMode + 실제 대기열(srs_pending) · /dev/study-identity 하네스(합성 단어 · 주입 신원).
// 학습의 주인 = 서버가 단어를 읽은 사람(A). 화면 경계가 내린 뒤 남은 옛 평가 콜백 · 키보드도 B 의 큐를 만들지 않는다.
// 개발 서버 전용 — CI 대상 아님. 실제 Auth · SRS DB · 실제 음성은 증명하지 않는다(서버 flush 는 전송 전에 막는다).
import { expect, test, type Page } from '@playwright/test'

const A = 'harness-study-a'
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
  await page.goto(`/dev/study-identity${qs}`)
  return writes
}
const queue = (page: Page) => page.getByTestId('st-queue')
const shown = (page: Page) => page.locator('[data-vault-private="shown"]')
const gate = (page: Page, s: string) => page.locator(`[data-vault-private="${s}"]`)
const fair = (page: Page) => page.getByRole('button', { name: /Fair/ })

/** 뜻 보기(단추) → 예문 공개(Space) 뒤 평가 단추가 보인다 */
async function reveal(page: Page) {
  await page.getByRole('button', { name: '뜻 보기' }).click()
  await page.keyboard.press('Space')
  await expect(fair(page)).toBeVisible()
}

/** 평가 단추의 React onClick 을 붙잡아 둔다 — 화면이 내려간 뒤 남은 옛 콜백 */
async function holdFair(page: Page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Fair/.test(b.textContent ?? ''))!
    const k = Object.keys(btn).find((x) => x.startsWith('__reactProps$'))!
    ;(window as unknown as { __oldFair: () => void }).__oldFair = (btn as unknown as Record<string, { onClick: () => void }>)[k].onClick
  })
}
const callOldFair = (page: Page) => page.evaluate(() => (window as unknown as { __oldFair: () => void }).__oldFair())

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('정상 A: 평가(키보드 3)는 A 큐로', async ({ page }) => {
      await open(page)
      await expect(shown(page)).toBeVisible()
      await reveal(page)
      await page.keyboard.press('3')
      await expect(queue(page)).toHaveText(`${A}:harvest`)
    })

    test('A 평가가 있는 상태에서 B 로그인: 화면을 내리고 옛 평가 콜백 · 키보드는 B 큐를 만들지 않는다 · A 항목 보존', async ({ page }) => {
      const writes = await open(page)
      await reveal(page)
      await page.keyboard.press('3')
      await expect(queue(page)).toHaveText(`${A}:harvest`)
      await reveal(page)
      await holdFair(page)
      await page.getByTestId('st-to-b').click()
      await expect(gate(page, 'changed')).toBeVisible()
      await expect(page.getByText('drought')).toHaveCount(0)
      await callOldFair(page)
      for (const k of ['Space', '3', '5']) await page.keyboard.press(k)
      await page.waitForTimeout(500)
      await expect(queue(page)).toHaveText(`${A}:harvest`)
      // 막힌 것은 기존 flush 경로뿐(서버 Action · /api/srs/flush — 전송 전 차단 · 주인 필터는 T-0172) — 그 밖의 쓰기 시도 없음
      expect(writes.filter((w) => w !== 'POST /dev/study-identity' && w !== 'POST /api/srs/flush')).toEqual([])
    })

    test('로그아웃 · A→B→A 는 되살리지 않음', async ({ page }) => {
      await open(page)
      await expect(shown(page)).toBeVisible()
      await page.getByTestId('st-to-b').click()
      await page.getByTestId('st-to-a').click()
      await page.waitForTimeout(300)
      await expect(gate(page, 'changed')).toBeVisible()
      await page.goto('/dev/study-identity')
      await expect(shown(page)).toBeVisible()
      await page.getByTestId('st-signout').click()
      await expect(gate(page, 'changed')).toBeVisible()
      await expect(page.locator('[data-vault-login]')).toBeVisible()
    })

    test('같은 사람의 토큰 갱신은 유지 · 브라우저가 처음부터 B 면 단어 없음', async ({ page }) => {
      await open(page)
      await expect(shown(page)).toBeVisible()
      await page.getByTestId('st-refresh-a').click()
      await reveal(page)
      await page.keyboard.press('3')
      await expect(queue(page)).toHaveText(`${A}:harvest`)
      await page.goto('/dev/study-identity?browser=b')
      await expect(gate(page, 'changed')).toBeVisible()
      await expect(page.getByText('harvest')).toHaveCount(0)
    })

    test('재확인 중(checking) 옛 콜백은 큐를 만들지 않고, 같은 A 로 재확인되면 이어 간다', async ({ page }) => {
      await open(page, '?slow=1500')
      await reveal(page)
      await holdFair(page)
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
      await expect(gate(page, 'checking')).toBeVisible()
      await callOldFair(page)
      await page.waitForTimeout(300)
      await expect(queue(page)).toHaveText('')
      await expect(shown(page)).toBeVisible({ timeout: 5000 })
      // 다시 그려진 StudyMode 의 자체 경계도 (하네스의 늦은 기준선으로) 한 번 더 확인한다
      await page.waitForTimeout(1800)
      await reveal(page)
      await page.keyboard.press('3')
      await expect(queue(page)).toHaveText(`${A}:harvest`)
    })
  })
}

test.describe('이미 재생 중인 발화 — Codex 반례', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  /** 브라우저 음성 엔진 대역 — speak 는 끝나지 않는 발화(active), cancel 은 멈춤. 실제 소리 · 장치는 증명하지 않는다. */
  async function stubSpeech(page: Page) {
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
        // 실제 SpeechSynthesisVoice 만 utter.voice 에 넣을 수 있다 — 빈 목록이면 기본 음성으로 speak 를 부른다
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        get speaking() {
          return st.active
        },
      }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
    })
  }
  const speech = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __speech: { speak: number; cancel: number; active: boolean } }).__speech }))

  test('재생 중 B 로그인 · 재확인 중이면 그 발화를 멈춘다 · 같은 A 는 정상 재생', async ({ page }) => {
    await stubSpeech(page)
    await open(page)
    await expect(shown(page)).toBeVisible()
    await page.getByRole('button', { name: '재생' }).click()
    const s1 = await speech(page)
    expect(s1.active).toBe(true)
    await page.getByTestId('st-to-b').click()
    await expect(gate(page, 'changed')).toBeVisible()
    const s2 = await speech(page)
    expect(s2.active).toBe(false)
    expect(s2.cancel).toBeGreaterThan(s1.cancel)

    // 같은 A 의 새 판: 재생 → BFCache 재확인(checking) 중이면 멈춘다
    await page.goto('/dev/study-identity?slow=1500')
    await expect(shown(page)).toBeVisible()
    await page.getByRole('button', { name: '재생' }).click()
    expect((await speech(page)).active).toBe(true)
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await expect(gate(page, 'checking')).toBeVisible()
    expect((await speech(page)).active).toBe(false)
  })
})
