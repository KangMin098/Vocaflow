// scripts/design/shelf-check.mjs
//
// 서가(/library/books) 「전체 탐색」의 핵심 동작을 실제로 실행한다 — learner-tines-audit S3 서가의 I 근거.
// 레일 검색 → 결과 수 변화 · 조건 칩 → 결과 수 변화 + 묶음이 열린 채 · 초기화 · 접힌 묶음 펼치기 ·
// 스크롤해도 레일이 보이는가(고정) · 결과 격자 카드 → 상세 시트 열림 → Esc 닫힘.
// 사용: node scripts/design/shelf-check.mjs --base http://localhost:3041 --sha <커밋> --out <dir> [--width 1440]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3041')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/shelf-check'))
const width = Number(arg('width', '1440'))
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

const count = (p) => p.evaluate(() => {
  const t = document.querySelector('aside[aria-label="도서 조건"]')?.textContent ?? ''
  const m = t.match(/(\d+)\s*(?:\/\s*(\d+))?\s*권/)
  return m ? Number(m[1]) : null
})
const gridCards = (p) => p.locator('section[aria-label="전체 도서 탐색"] [role="listitem"]').count()

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const p = await ctx.newPage()
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ok: r.ok, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  await p.goto(`${BASE}/library/books`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await p.waitForTimeout(5000)
  const rail = p.locator('aside[aria-label="도서 조건"]')
  // 머리 판의 「전체 탐색 ↓」 — 추천 선반을 지나 조건 레일로 바로 간다(2026-10-19 S4)
  await step('머리 링크 → 전체 탐색 구획이 첫 화면 위쪽에', async () => {
    const link = p.getByRole('link', { name: /전체 탐색 ↓/ })
    const linkY = (await link.boundingBox())?.y ?? null
    await link.click()
    await p.waitForTimeout(900)
    const r = await rail.boundingBox()
    const head = await p.locator('section#browse h2').boundingBox()
    await p.screenshot({ path: path.join(outDir, `jump@${width}.png`) })
    return { ok: linkY !== null && linkY < 900 && Boolean(head && head.y >= 60 && head.y < 200) && Boolean(r && r.y < 300), linkY: linkY && Math.round(linkY), headY: head && Math.round(head.y), railY: r && Math.round(r.y), hash: new URL(p.url()).hash }
  })
  await rail.scrollIntoViewIfNeeded()
  const total = await count(p)

  await step('레일이 결과 왼쪽에 있다', async () => {
    const r = await rail.boundingBox()
    const g = await p.locator('section[aria-label="전체 도서 탐색"] [role="list"]').boundingBox()
    return { ok: Boolean(r && g && r.x + r.width <= g.x), railX: r && Math.round(r.x), railW: r && Math.round(r.width), gridX: g && Math.round(g.x) }
  })
  await step('검색 → 결과 수가 줄고 격자도 줄어든다', async () => {
    await rail.locator('input[type="search"]').fill('hamlet')
    await p.waitForTimeout(800)
    const n = await count(p); const cards = await gridCards(p)
    await p.screenshot({ path: path.join(outDir, `search@${width}.png`) })
    await rail.locator('input[type="search"]').fill('')
    await p.waitForTimeout(600)
    return { ok: n !== null && total !== null && n < total && cards === n, total, after: n, cards }
  })
  await step('조건 칩(레벨) → 결과 수 변화 · 묶음 열린 채 · 선택 점', async () => {
    const chip = rail.locator('details:has(summary:has-text("레벨")) button[aria-pressed]').first()
    await chip.click()
    await p.waitForTimeout(800)
    const n = await count(p)
    const open = await rail.locator('details:has(summary:has-text("레벨"))').evaluate((d) => d.open)
    const dot = await rail.locator('details:has(summary:has-text("레벨")) summary [aria-label="선택됨"]').count()
    await p.screenshot({ path: path.join(outDir, `filter@${width}.png`) })
    return { ok: n !== null && n !== total && open && dot === 1 && (await chip.getAttribute('aria-pressed')) === 'true', after: n, open, dot }
  })
  await step('초기화 → 전체 수로 복귀', async () => {
    await rail.getByRole('button', { name: /초기화/ }).click()
    await p.waitForTimeout(800)
    const n = await count(p)
    return { ok: n === total, after: n }
  })
  await step('접힌 묶음(장르) 펼치기 — 키보드', async () => {
    const sum = rail.locator('details:has(summary:has-text("장르")) summary')
    const before = await rail.locator('details:has(summary:has-text("장르"))').evaluate((d) => d.open)
    await sum.focus()
    await p.keyboard.press('Enter')
    await p.waitForTimeout(300)
    const after = await rail.locator('details:has(summary:has-text("장르"))').evaluate((d) => d.open)
    const h = await sum.boundingBox()
    return { ok: before === false && after === true && (h?.height ?? 0) >= 44, before, after, summaryH: h && Math.round(h.height) }
  })
  await step('아래로 스크롤해도 레일이 보인다(고정)', async () => {
    const g = await p.locator('section[aria-label="전체 도서 탐색"] [role="list"]').boundingBox()
    await p.evaluate((y) => window.scrollTo(0, y), (g?.y ?? 0) + (await p.evaluate(() => scrollY)) + 1200)
    await p.waitForTimeout(500)
    const r = await rail.boundingBox()
    await p.screenshot({ path: path.join(outDir, `sticky@${width}.png`) })
    return { ok: Boolean(r && r.y >= 0 && r.y < 200), railTop: r && Math.round(r.y) }
  })
  await step('격자 카드 → 상세 시트 → Esc 닫힘', async () => {
    const card = p.locator('section[aria-label="전체 도서 탐색"] [role="listitem"]').first()
    await card.scrollIntoViewIfNeeded()
    await card.locator('button, a').first().click()
    await p.waitForTimeout(1000)
    const open = await p.locator('[role="dialog"][aria-modal="true"]').count()
    await p.screenshot({ path: path.join(outDir, `sheet@${width}.png`) })
    await p.keyboard.press('Escape')
    await p.waitForTimeout(600)
    const closed = (await p.locator('[role="dialog"][aria-modal="true"]').count()) === 0
    return { ok: open === 1 && closed, open, closed }
  })
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_shelf@${width}.json`), JSON.stringify({ base: BASE, sha: arg('sha', 'unknown'), width, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
