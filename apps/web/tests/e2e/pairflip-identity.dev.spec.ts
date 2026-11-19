// apps/web/tests/e2e/pairflip-identity.dev.spec.ts
// PairFlip 판 계정 경계 — 실제 PairFlipGameScreen + 실제 대기열(srs_pending) · /dev/pairflip-identity 하네스(합성 짝 · 주입 신원 · 점수 대역).
// 판의 주인 = 짝 단어를 읽은 사람(A). 바뀜 · 로그아웃이면 카드를 내리고 중도 점수 · 대기열 평가를 남기지 않는다.
// 개발 서버 전용 — CI 대상 아님. 실제 Auth · scores · SRS DB 는 증명하지 않는다(서버 flush 는 전송 전에 막는다).
import { expect, test, type Page } from '@playwright/test'

const A = 'harness-pf-a'
const PAIRS: Record<string, string> = { harvest: '수확', drought: '가뭄', flooding: '홍수', satellite: '위성', glacier: '빙하' }
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
  await page.goto(`/dev/pairflip-identity${qs}`)
  return writes
}

const cards = (page: Page) => page.getByRole('grid', { name: '짝맞추기 카드 그리드' }).getByRole('button')
const scores = (page: Page) => page.getByTestId('pf-scores')
const queue = (page: Page) => page.getByTestId('pf-queue')
const notice = (page: Page, s: string) => page.locator(`[data-game-private="${s}"]`)

/** 카드 내용 알아내기 — 두 장씩 뒤집어 aria-label 에서 읽는다(맞으면 그대로 맞은 채로 둔다) */
async function learn(page: Page): Promise<string[]> {
  const n = await cards(page).count()
  const content: string[] = new Array(n).fill('')
  const read = async (i: number) => ((await cards(page).nth(i).getAttribute('aria-label')) ?? '').split(',')[0]
  for (let i = 0; i + 1 < n; i += 2) {
    await cards(page).nth(i).click()
    content[i] = await read(i)
    await cards(page).nth(i + 1).click()
    content[i + 1] = await read(i + 1)
    await page.waitForTimeout(1300)
  }
  return content
}

/** 아직 안 맞은 짝 k 개를 맞춘다 */
async function matchPairs(page: Page, content: string[], k: number) {
  let done = 0
  for (const [w, m] of Object.entries(PAIRS)) {
    if (done >= k) break
    const wi = content.indexOf(w)
    const mi = content.indexOf(m)
    if (wi < 0 || mi < 0) continue
    if (((await cards(page).nth(wi).getAttribute('aria-label')) ?? '').includes('매칭 성공')) continue
    await cards(page).nth(wi).click()
    await cards(page).nth(mi).click()
    await page.waitForTimeout(900)
    done++
  }
}

const matchedCount = async (page: Page) => {
  const labels = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  return labels.filter((l) => l.includes('매칭 성공')).length / 2
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('정상 A: 완주하면 A 몫 점수 · A 대기열 5건', async ({ page }) => {
      await open(page)
      await expect(cards(page).first()).toBeVisible()
      const content = await learn(page)
      await matchPairs(page, content, 5)
      await expect(scores(page)).toHaveText(`score:${A}:5`)
      await expect.poll(async () => ((await queue(page).textContent()) ?? '').split(',').filter(Boolean).length).toBe(5)
      expect(((await queue(page).textContent()) ?? '').split(',').every((q) => q.startsWith(`${A}:`))).toBe(true)
    })

    test('A 가 짝을 맞춘 뒤 B 로그인: 카드를 내리고 · 떠나도 중도 점수 · 대기열 없음', async ({ page }) => {
      const writes = await open(page)
      await expect(cards(page).first()).toBeVisible()
      const content = await learn(page)
      await matchPairs(page, content, 1)
      // B 로 바뀌기 전에 A 가 실제로 짝을 맞췄다(중도 점수가 남을 조건)
      expect(await matchedCount(page)).toBeGreaterThanOrEqual(1)
      await page.getByTestId('pf-to-b').click()
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(cards(page)).toHaveCount(0)
      for (const k of ['Enter', 'Space', 'h']) await page.keyboard.press(k)
      await page.getByTestId('pf-leave').click()
      await page.waitForTimeout(400)
      await expect(scores(page)).toHaveText('')
      await expect(queue(page)).toHaveText('')
      expect(writes.filter((w) => !w.startsWith('POST /dev/pairflip-identity'))).toEqual([])
    })

    test('같은 사람의 토큰 갱신은 유지 — 떠나면 A 몫 중도 점수', async ({ page }) => {
      await open(page)
      await expect(cards(page).first()).toBeVisible()
      const content = await learn(page)
      await matchPairs(page, content, 1)
      const got = await matchedCount(page)
      await page.getByTestId('pf-refresh-a').click()
      await expect(cards(page).first()).toBeVisible()
      await page.getByTestId('pf-leave').click()
      await expect(scores(page)).toHaveText(`score:${A}:${got}:partial`)
    })

    test('A→B→A 는 되살리지 않음 · 브라우저가 처음부터 B 면 카드 없음', async ({ page }) => {
      await open(page)
      await expect(cards(page).first()).toBeVisible()
      await page.getByTestId('pf-to-b').click()
      await page.getByTestId('pf-to-a').click()
      await page.waitForTimeout(300)
      await expect(notice(page, 'changed')).toBeVisible()
      await page.goto('/dev/pairflip-identity?browser=b')
      await expect(notice(page, 'changed')).toBeVisible()
      await expect(cards(page)).toHaveCount(0)
    })
  })
}

test.describe('재확인 중(checking) — Codex 반례', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('checking 중 옛 카드 콜백은 판을 바꾸지 않고, 같은 A 로 재확인되면 이어 간다', async ({ page }) => {
    await open(page, '?slow=1500')
    await expect(cards(page).first()).toBeVisible()
    const content = await learn(page)
    const wi = content.indexOf('harvest')
    const mi = content.indexOf(PAIRS.harvest)
    // 옛 콜백 붙잡기 — 화면이 안내로 바뀐 뒤에도 남는 React onClick(실제 카드 버튼의 props)
    await page.evaluate(([a, b]) => {
      const btns = [...document.querySelectorAll('[aria-label="짝맞추기 카드 그리드"] button')]
      const props = (el: Element) => {
        const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))!
        return (el as unknown as Record<string, { onClick?: () => void }>)[k]
      }
      ;(window as unknown as { __old: (() => void)[] }).__old = [props(btns[a]).onClick!, props(btns[b]).onClick!]
    }, [wi, mi])
    const before = await matchedCount(page)
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await expect(notice(page, 'checking')).toBeVisible()
    await page.evaluate(() => (window as unknown as { __old: (() => void)[] }).__old.forEach((f) => f()))
    await page.waitForTimeout(500)
    await expect(cards(page).first()).toBeVisible({ timeout: 4000 })
    await page.waitForTimeout(400)
    expect(await matchedCount(page)).toBe(before)
    // 같은 A 로 재확인 뒤에는 정상 입력이 들어간다
    await matchPairs(page, content, 1)
    expect(await matchedCount(page)).toBeGreaterThan(before)
  })
})
