// apps/web/tests/e2e/dictation-return.dev.spec.ts
// 받아쓰기 결과 행동 — 실제 DictationResultActions + /dev/dictation-return(합성 좌표). from 이 있을 때만 복귀 링크 · 재시도에 from ·
// 불량 from 은 버림 · 붙여넣기/오늘은 허브. 키보드 · 보이는 focus · 44px · 쓰기 없음.
// 개발 서버 전용 — CI 대상 아님. 실제 세션 시작 · 완료 · 점수 · SRS · 음성은 증명하지 않는다.
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
  await page.goto(`/dev/dictation-return${query}`)
  return writes
}

for (const width of [1280, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('읽던 글 from — 복귀 링크 · 같은 글 재시도에 from', async ({ page }) => {
      const writes = await open(page, '?from=%2Ftext%2Fdev-text%3Fmode%3Dread')
      const back = page.getByTestId('dictation-return-from')
      await expect(back).toHaveAttribute('href', '/text/dev-text?mode=read')
      await expect(back).toHaveText(/하던 학습으로 돌아가기/)
      await expect(page.getByRole('link', { name: /한 번 더/ })).toHaveAttribute('href', '/dictate/setup?text=dev-text&from=%2Ftext%2Fdev-text%3Fmode%3Dread')
      await expect(page.getByRole('link', { name: /받아쓰기 홈/ })).toHaveAttribute('href', '/dictate')
      await expect(page.getByRole('link', { name: /통계/ })).toHaveAttribute('href', '/dashboard')
      expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      let reached = false
      for (let i = 0; i < 15 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await back.evaluate((el) => el === document.activeElement)
      }
      expect(reached).toBe(true)
      expect(await back.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
      await page.screenshot({ path: `test-results/dictation-return-${width}.png` })
      // 실제 /text 는 열지 않는다(레이아웃 GET 이 DB 를 쓴다) — Enter 가 그 주소로 이동을 시작하는지만 보고 막는다
      await page.route('**/text/dev-text**', (route) => route.abort())
      const nav = page.waitForRequest((r) => r.url().includes('/text/dev-text?mode=read') && r.isNavigationRequest())
      await page.keyboard.press('Enter')
      await nav
      expect(writes.filter((w) => !w.startsWith('GET'))).toEqual([])
    })

    test('묶음 · 장 재시도에 from · 붙여넣기는 허브 · 불량 from 은 버림', async ({ page }) => {
      await open(page, '?kind=set&from=%2Flibrary%2Fbooks%2Fb1')
      await expect(page.getByRole('link', { name: /한 번 더/ })).toHaveAttribute('href', '/dictate/setup?set=dev-set&chapter=2&from=%2Flibrary%2Fbooks%2Fb1')
      await open(page, '?kind=custom&from=%2Ftext%2Fdev-text')
      await expect(page.getByRole('link', { name: /한 번 더/ })).toHaveAttribute('href', '/dictate')
      for (const bad of ['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2F%5Cevil.example']) {
        await open(page, `?from=${bad}`)
        await expect(page.getByTestId('dictation-return-from')).toHaveCount(0)
        await expect(page.getByRole('link', { name: /한 번 더/ })).toHaveAttribute('href', '/dictate/setup?text=dev-text')
      }
      await open(page, '')
      await expect(page.getByTestId('dictation-return-from')).toHaveCount(0)
    })
  })
}
