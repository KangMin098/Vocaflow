// scripts/design/modepills-check.mjs
//
// 읽기 화면 활동 선택(ModePills)을 실제로 잰다 — learner-tines-audit S4.
//   · 한 줄인가(조작 요소들의 top 이 하나) · 조작 높이 ≥ 44 · 화살표(▸) 없음
//   · 목적지 주소 집합이 기준선과 같은가(자료 스코프 ?set/?text · from= 복귀 보존)
//   · 현재 활동 표시 · 그룹 메뉴 열기 → 항목 · Esc 닫힘 + 연 단추로 포커스 복귀
// 사용: node scripts/design/modepills-check.mjs --base http://localhost:3041 --baseline http://localhost:3000 --text <id> --out <dir> [--width 1440]

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
const BASELINE = arg('baseline', null)
const TEXT = arg('text', '859e0b09-6dcc-4c70-97ee-7563341bf8d4')
const MODE = arg('mode', 'read')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s4/modepills'))
const width = Number(arg('width', '1440'))
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const NAV = 'nav[aria-label="학습 단계 선택"]'

const hrefsOf = async (browser, base) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const p = await ctx.newPage()
  await p.goto(`${base}/text/${TEXT}?mode=${MODE}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await p.waitForSelector(NAV, { timeout: 60_000 })
  await p.waitForTimeout(2000)
  const hrefs = await p.locator(`${NAV} a`).evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))].sort())
  await ctx.close()
  return hrefs
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/text/${TEXT}?mode=${MODE}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await p.waitForSelector(NAV, { timeout: 60_000 })
  await p.waitForTimeout(2500)
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  await p.locator(NAV).screenshot({ path: path.join(outDir, `nav@${width}.png`) })

  await step('한 줄 · 조작 높이 44 · 화살표 없음', async () => {
    const r = await p.evaluate((sel) => {
      const nav = document.querySelector(sel)
      const ctrls = [...nav.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().width > 0 && e.offsetParent !== null)
      const tops = [...new Set(ctrls.map((e) => Math.round(e.getBoundingClientRect().top)))]
      return { navH: Math.round(nav.getBoundingClientRect().height), rows: tops.length, minH: Math.min(...ctrls.map((e) => Math.round(e.getBoundingClientRect().height))), visible: ctrls.length, chevronRight: nav.querySelectorAll('svg.lucide-chevron-right').length }
    }, NAV)
    return { ok: r.rows === 1 && r.minH >= 44 && r.chevronRight === 0, ...r }
  })
  await step('현재 활동 표시(aria-current) — 늘 보이는 알약', async () => {
    const cur = await p.locator(`${NAV} > div > a[aria-current="page"]`).first().textContent()
    return { ok: Boolean(cur?.trim()), current: cur?.trim() }
  })
  if (BASELINE) await step('목적지 주소 집합 = 기준선(스코프 · from= 보존)', async () => {
    const after = await p.locator(`${NAV} a`).evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))].sort())
    const before = await hrefsOf(browser, BASELINE)
    const missing = before.filter((h) => !after.includes(h))
    const extra = after.filter((h) => !before.includes(h))
    return { ok: missing.length === 0 && extra.length === 0 && before.length === 12, count: { before: before.length, after: after.length }, missing, extra }
  })
  for (const g of ['읽기·듣기', '단어', '연습']) {
    await step(`「${g}」 메뉴 열기 → 항목 · Esc · 포커스 복귀`, async () => {
      const btn = p.locator(NAV).getByRole('button', { name: new RegExp(g) })
      await btn.click()
      await p.waitForTimeout(400)
      const expanded = await btn.getAttribute('aria-expanded')
      const items = await p.locator(`${NAV} [id]:not([hidden]) a`).evaluateAll((els) => els.map((e) => ({ label: e.textContent.trim().replace(/\s+/g, ' '), h: Math.round(e.getBoundingClientRect().height) })))
      const panel = await p.locator(`${NAV} [id]:not([hidden])`).first().evaluate((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, shadow: cs.boxShadow } })
      await p.screenshot({ path: path.join(outDir, `menu-${g.replace(/[^가-힣a-z]/gi, '')}@${width}.png`) })
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
      const closed = (await btn.getAttribute('aria-expanded')) === 'false'
      const focusBack = await btn.evaluate((e) => document.activeElement === e)
      return { ok: expanded === 'true' && items.length > 0 && items.every((i) => i.h >= 44) && closed && focusBack, items, panel, closed, focusBack }
    })
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_modepills@${width}.json`), JSON.stringify({ base: BASE, baseline: BASELINE, width, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
