// apps/web/tests/e2e/csat-v3-screens.spec.ts
//
// v3 탐구 실화면 검수 — 대표 문항 × 일곱 장면을 PC 1280/1440 · 라이트/다크로 찍고,
// 가로 넘침 · 「준비 중」 오표출 · 콘솔 오류를 기록한다(CSAT_V3_IMPLEMENTATION_PLAN §8). 모바일 폭은 대상 아님.
//   PLAYWRIGHT_BASE_URL=http://localhost:3218 pnpm --filter web exec playwright test csat-v3-screens
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type BrowserContext } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/v3-screens')
const SCENES = ['task', 'meaning', 'judgment', 'design', 'compare', 'principle', 'explain'] as const
// 대표: 빈칸(전 장면) · 순서 · 삽입 · 어법 · 도표 · 3차 배치 표본(요지 · 심경)
const ITEMS: { slug: string; scenes: readonly string[] }[] = [
  { slug: '2026-34', scenes: SCENES },
  { slug: '2026-36', scenes: ['meaning', 'judgment', 'design'] },
  { slug: '2026-38', scenes: ['meaning', 'judgment'] },
  { slug: '2026-29', scenes: ['meaning', 'judgment'] },
  { slug: '2026-25', scenes: ['judgment', 'design'] },
  { slug: 'M2306-22', scenes: ['meaning', 'judgment', 'principle'] },
  { slug: '2019-19', scenes: ['judgment'] },
]
const VIEWS = [
  { w: 1280, theme: 'light' },
  { w: 1440, theme: 'dark' },
] as const

let storage: Awaited<ReturnType<BrowserContext['storageState']>>
const report: Record<string, unknown>[] = []

test.describe.configure({ mode: 'serial' })
test.setTimeout(600_000)

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  await ctx.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
  storage = await ctx.storageState()
  await ctx.close()
  mkdirSync(SHOTS, { recursive: true })
})

test.afterAll(() => {
  writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2))
})

for (const v of VIEWS) {
  test(`v3 장면 실화면 ${v.w} ${v.theme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storage, viewport: { width: v.w, height: 900 }, colorScheme: v.theme })
    await ctx.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
    await ctx.addInitScript((t) => localStorage.setItem('vocaflow-theme', t), v.theme)
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const it of ITEMS) {
      for (const scene of it.scenes) {
        errors.length = 0
        await page.goto(`/csat/item/${it.slug}?scene=${scene}`, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
        await page.waitForTimeout(600)
        const m = await page.evaluate(() => ({
          url: location.pathname + location.search,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dataTheme: document.documentElement.getAttribute('data-theme'),
          preparing: /준비 중/.test(document.body.innerText),
          unavailable: /(불러오지 못|오류가 발생)/.test(document.body.innerText),
        }))
        await page.screenshot({ path: path.join(SHOTS, `${it.slug}_${scene}_${v.w}_${v.theme}.png`), fullPage: false })
        report.push({ slug: it.slug, scene, width: v.w, theme: v.theme, ...m, pageErrors: [...errors] })
        expect(m.overflowX, `${it.slug} ${scene} 가로 넘침`).toBeLessThanOrEqual(0)
        expect(m.unavailable, `${it.slug} ${scene} 오류 문구`).toBe(false)
        expect(errors, `${it.slug} ${scene} 페이지 오류`).toEqual([])
      }
    }
    await ctx.close()
  })
}
