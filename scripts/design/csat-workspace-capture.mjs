// scripts/design/csat-workspace-capture.mjs
//
// **기출 탐구 작업공간 실화면 캡처 · 기하 측정** (W0 기준 화면 · W4 전후 대조)
// PC 1280/1440 × 메뉴 레일 접힘(64)/펼침(220) 네 조건에서 `/csat/item/<slug>` 를 열고 캡처한다.
// 측정: 레일 · 원문 열 · 두 판 · 하단 도크 · 도크 요소 · 아이콘 상자 · 가로 넘침 · 44px 미만 조작 영역.
// 로그인은 런타임 계정(환경변수) — 비밀값을 출력하지 않는다. 결과 JSON 은 출력 폴더에만 쓴다.
//
// 실행: node --env-file=<메인 apps/web/.env.local> scripts/design/csat-workspace-capture.mjs <출력 폴더> [base=http://localhost:3219] [slug=2026-34]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const req = createRequire(path.resolve('apps/web/package.json'))
const { chromium } = req('@playwright/test')

const OUT = process.argv[2]
const BASE = process.argv[3] || 'http://localhost:3219'
const SLUG = process.argv[4] || '2026-34'
if (!OUT) throw new Error('출력 폴더를 주세요')
fs.mkdirSync(OUT, { recursive: true })
const email = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다')

const browser = await chromium.launch()
const results = []
for (const width of [1280, 1440]) {
  for (const railOpen of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/analytics/event', (r) => r.fulfill({ json: { ok: true } }))
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
    await page.evaluate((open) => { try { localStorage.setItem('csat-rail', open ? 'open' : 'collapsed') } catch {} }, railOpen)
    await page.goto(`${BASE}/csat/item/${SLUG}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('analysis-theater').waitFor({ timeout: 120_000 })
    await page.locator('[data-testid="item-paper"], [data-testid="item-paper-crop"], [data-testid="item-paper-missing"]').first().waitFor({ timeout: 90_000 }).catch(() => {})
    await page.waitForTimeout(800)
    // 레일 상태를 저장값이 아니라 실제 토글로 맞춘다
    const rail = page.getByTestId('csat-rail')
    const collapsed = (await rail.getAttribute('data-collapsed')) === 'true'
    if (collapsed === railOpen) { await page.getByTestId('rail-toggle').click(); await page.waitForTimeout(500) }
    const m = await page.evaluate(() => {
      const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
      const all = (sel) => [...document.querySelectorAll(sel)].map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
      const small = [...document.querySelectorAll('[data-csat-theater] button, [data-csat-theater] a, [data-csat-theater] [role="separator"]')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) })
        .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 16)}] ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rail: box('[data-testid="csat-rail"]'),
        paper: box('[data-testid="workspace-paper"]') ?? box('[aria-label="기출문제 원본"]'),
        frame: box('[data-testid="workspace-frame"]'),
        frameHead: box('[data-testid="workspace-head"]'),
        evidencePane: box('[data-testid="pane-evidence"]') ?? box('[aria-label="지문 지도"]'),
        explainPane: box('[data-testid="pane-explain"]') ?? box('[aria-label="해설"]'),
        dock: box('[data-testid="inquiry-dock"]'),
        dockItems: all('[data-testid="dock-group"]'),
        dockIcons: all('[data-testid="dock-scene"]'),
        small44: small,
      }
    })
    const name = `${width}-${railOpen ? 'rail220' : 'rail64'}`
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    results.push({ width, railOpen, errors, ...m })
    await ctx.close()
  }
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(results, null, 2))
for (const r of results) console.log(JSON.stringify({ w: r.width, rail: r.railOpen ? 220 : 64, railW: r.rail?.w, paper: r.paper?.w, ev: r.evidencePane?.w, ex: r.explainPane?.w, dock: r.dock?.h, items: r.dockItems.map((x) => x.h), overflow: r.overflowX, small44: r.small44.length, errors: r.errors.length }))
