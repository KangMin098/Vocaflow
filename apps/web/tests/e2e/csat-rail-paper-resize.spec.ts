// apps/web/tests/e2e/csat-rail-paper-resize.spec.ts
//
// 기출분석공간 — 메뉴 최소 축소(왼쪽 위 표지로 펼침/접힘) · 기출 원문 열 폭 조절(끌기 · ←/→). PC 1440.
//   PLAYWRIGHT_BASE_URL=http://localhost:3218 pnpm --filter web exec playwright test csat-rail-paper-resize
import path from 'node:path'
import { expect, test } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/rail-resize')

test.setTimeout(240_000)

test('메뉴는 접힌 채 시작하고 표지로 펼친다 · 기출 원문 폭을 끌고 키보드로 바꾼다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
  await page.evaluate(() => { localStorage.removeItem('csat-rail'); localStorage.removeItem('csat-paper-w') })

  await page.goto('/csat/item/2026-38?scene=compare', { waitUntil: 'domcontentloaded' })
  const rail = page.getByTestId('csat-rail')
  await expect(rail).toHaveAttribute('data-collapsed', 'true')
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeLessThan(80)
  await page.screenshot({ path: path.join(SHOTS, 'collapsed.png') })

  await page.getByTestId('rail-toggle').click()
  await expect(rail).toHaveAttribute('data-collapsed', 'false')
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeGreaterThan(200)
  expect(new URL(page.url()).pathname).toBe('/csat/item/2026-38') // 표지를 눌러도 홈으로 가지 않는다
  await page.screenshot({ path: path.join(SHOTS, 'expanded.png') })
  await page.getByTestId('rail-toggle').click()
  await expect(rail).toHaveAttribute('data-collapsed', 'true')
  await page.waitForTimeout(500) // 레일 폭 전환이 끝난 뒤 손잡이 위치를 잰다

  const paper = page.getByRole('complementary', { name: '기출문제 원본' })
  const handle = page.getByTestId('paper-resizer')
  const w0 = (await paper.boundingBox())!.width
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + 200)
  await page.mouse.down()
  await page.mouse.move(hb.x + hb.width / 2 + 160, hb.y + 200, { steps: 8 })
  await page.mouse.up()
  const w1 = (await paper.boundingBox())!.width
  expect(w1).toBeGreaterThan(w0 + 120)

  await handle.focus()
  const step = await page.evaluate(() => document.querySelector('[data-testid="analysis-theater"]')?.textContent?.length ?? 0)
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  const w2 = (await paper.boundingBox())!.width
  expect(w2).toBeLessThan(w1 - 40)
  expect(step).toBeGreaterThan(0)
  await page.screenshot({ path: path.join(SHOTS, 'resized.png') })

  // 고른 폭과 메뉴 상태는 다시 열어도 남는다
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(async () => Math.round((await paper.boundingBox())?.width ?? 0)).toBe(Math.round(w2))
})
