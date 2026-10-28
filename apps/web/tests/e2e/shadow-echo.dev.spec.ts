// apps/web/tests/e2e/shadow-echo.dev.spec.ts
// 따라읽기 → 같은 글 EchoMatch 링크 — 실제 ShadowReadAlong + /dev/shadow-echo(합성 상태). 키보드 · 보이는 focus · 44px · 쓰기 없음.
// 개발 서버 전용 — CI 대상 아님. 실제 음성 · 마이크 · Echo 녹음 · 사람 사용성은 증명하지 않는다.
import { expect, test } from '@playwright/test'

for (const width of [1280, 1440]) {
  test(`${width}px: 시작 전 · 완료 화면의 녹음 비교 링크`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const writes: string[] = []
    await page.route('**/*', (route) => {
      const r = route.request()
      if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
        writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
        return route.abort()
      }
      return route.continue()
    })
    await page.goto('/dev/shadow-echo')
    const link = page.getByTestId('shadow-echo-link')
    await expect(link).toHaveAttribute('href', '/text/dev-text/echo')
    await expect(link).toHaveText(/내 녹음과 억양 비교/)
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    let reached = false
    for (let i = 0; i < 20 && !reached; i++) {
      await page.keyboard.press('Tab')
      reached = await link.evaluate((el) => el === document.activeElement)
    }
    expect(reached).toBe(true)
    expect(await link.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true)
    await page.screenshot({ path: `test-results/shadow-echo-start-${width}.png` })

    await page.getByRole('button', { name: /시작하기/ }).press('Enter')
    await expect(page.getByText(/따라읽기 연습이 끝났어요/)).toBeVisible()
    await expect(page.getByText(/모두 따라 읽었|또렷하게 남/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /처음부터 다시/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /본문으로/ })).toBeVisible()
    await expect(page.getByTestId('shadow-echo-link')).toHaveAttribute('href', '/text/dev-text/echo')
    await page.screenshot({ path: `test-results/shadow-echo-done-${width}.png` })
    expect(writes).toEqual([])
  })
}
