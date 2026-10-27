// apps/web/tests/e2e/flashcard-identity.dev.spec.ts
// 카드 세션 계정 경계 — 실제 FlashcardSession + FlashcardViewerGate + 실제 대기열(srs_pending) · /dev/flashcard-identity 하네스(합성 단어 · 주입 신원).
// 반례(gate=0): 다른 탭에서 B 로그인 뒤에도 옛 A 카드가 살아 있어 새 평가가 B 주인으로 대기열에 들어간다.
// 경계(gate=1): 바뀜 · 로그아웃이면 카드를 내려 키보드 평가가 큐에 들어가지 않고, A 로 돌아와도 되살리지 않는다. 같은 사람의 토큰 갱신은 유지.
// 개발 서버 전용 — CI(next start) 대상 아님. 실제 Auth · 서버 flush · SRS DB 는 증명하지 않는다(서버로 가는 요청은 막는다).
import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1280, 1440]

async function open(page: Page, gate: '0' | '1') {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/flashcard-identity?gate=${gate}`)
  await expect(page.getByTestId('harness-owner')).toHaveText('harness-viewer-a')
  return writes
}

/** 떠올렸다 판정 → 뒤집기(Space) → Good(3) — 실제 화면 경로 */
async function rate(page: Page) {
  await page.getByRole('button', { name: /떠올랐어요/ }).click()
  await page.locator('body').click({ position: { x: 5, y: 880 } })
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  await page.keyboard.press('3')
  await page.waitForTimeout(500)
}
const queue = (page: Page) => page.getByTestId('harness-queue')

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('반례(경계 없음): B 로그인 뒤 옛 A 카드의 새 평가가 B 주인으로 들어간다', async ({ page }) => {
      await open(page, '0')
      await rate(page)
      await expect(queue(page)).toHaveText('harness-viewer-a:harvest')
      await page.getByTestId('harness-to-b').click()
      await expect(page.getByTestId('harness-owner')).toHaveText('harness-viewer-b')
      await rate(page)
      await expect(queue(page)).toContainText('harness-viewer-b:drought')
    })

    test('경계: B 로 바뀌면 카드를 내리고 평가가 큐에 들어가지 않는다 · A 의 대기 평가는 보존 · 돌아와도 되살리지 않음', async ({ page }) => {
      const writes = await open(page, '1')
      await expect(page.locator('[data-card-private="shown"]')).toBeVisible()
      await rate(page)
      await expect(queue(page)).toHaveText('harness-viewer-a:harvest')

      await page.getByTestId('harness-to-b').click()
      await expect(page.locator('[data-card-private="changed"]')).toBeVisible()
      await expect(page.getByText('drought')).toHaveCount(0)
      for (const k of ['Space', '1', '2', '3', '4']) await page.keyboard.press(k)
      await page.waitForTimeout(500)
      await expect(queue(page)).toHaveText('harness-viewer-a:harvest')

      await page.getByTestId('harness-to-a').click()
      await page.waitForTimeout(300)
      await expect(page.locator('[data-card-private="changed"]')).toBeVisible()
      const reopen = page.locator('[data-card-reopen]')
      await expect(reopen).toHaveAttribute('href', '/dev/flashcard-identity')
      expect((await reopen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      // 키보드(Tab)로 닿았을 때 보이는 focus
      let reached = false
      for (let i = 0; i < 20 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await reopen.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await reopen.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
      // 막힌 쓰기성 요청은 이 페이지로의 Server Action POST 뿐(이탈 flush 로 보이지만 pathname 만으로는 어떤 Action 인지 확정하지 않는다 ·
      // 실제 저장은 실행되지 않았다) — Supabase · API · analytics 로 간 것은 없다
      expect(writes.every((w) => w === 'POST /dev/flashcard-identity')).toBe(true)
    })

    test('경계: 로그아웃도 카드를 내린다', async ({ page }) => {
      await open(page, '1')
      await page.getByTestId('harness-signout').click()
      await expect(page.locator('[data-card-private="changed"]')).toBeVisible()
      await expect(page.locator('[data-card-login]')).toBeVisible()
      await page.keyboard.press('3')
      await expect(queue(page)).toHaveText('')
    })

    test('경계: 같은 사람의 토큰 갱신은 카드를 유지하고 평가는 A 로', async ({ page }) => {
      await open(page, '1')
      await page.getByTestId('harness-refresh-a').click()
      await expect(page.locator('[data-card-private="shown"]')).toBeVisible()
      await rate(page)
      await expect(queue(page)).toHaveText('harness-viewer-a:harvest')
    })
  })
}

test.describe('하네스 표시 범위', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('주인 미상 · 다른 주인의 기존 대기 행은 보이지 않고 그대로 남는다', async ({ page }) => {
    const seed = JSON.stringify([
      { cardId: 'x1', word: 'harvest', cardUpdate: {}, rating: 3, reviewedAt: '2026-01-01T00:00:00.000Z', module: 'flashcard' },
      { cardId: 'x2', word: 'harvest', cardUpdate: {}, rating: 3, reviewedAt: '2026-01-02T00:00:00.000Z', module: 'flashcard', owner: 'someone-real' },
    ])
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('srs_pending', s)
        sessionStorage.setItem('seeded', '1')
      }
    }, seed)
    await open(page, '1')
    await page.waitForTimeout(600)
    await expect(queue(page)).toHaveText('')
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { cardId: string; owner?: string }[])
    expect(kept.map((k) => `${k.cardId}:${k.owner ?? '-'}`)).toEqual(['x1:-', 'x2:someone-real'])
  })
})
