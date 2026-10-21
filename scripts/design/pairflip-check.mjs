// scripts/design/pairflip-check.mjs
//
// PairFlip 의 Esc 를 **상태별로** 기준선 ↔ 변경 후 비교한다 — learner-tines-audit S4 (S3 의 「미확인」 추적).
// Esc 처리 주체(코드 추적): PairFlip 컴포넌트는 Esc 를 듣지도 `useSessionEscape` 로 등록하지도 않는다 →
// 앱에서 Esc 를 듣는 유일한 곳인 세션 틀(SessionFrame.handleEscape)이 소비자 없음 → `router.push(closeHref)`.
// 상태: initial(모두 덮임) · selected(1장 뒤집힘, 포커스 = 그 카드) · progress(2장 → 성공/실패 피드백 팝업 1.1초 안).
// 각 상태마다 새로 연 뒤 같은 조작 → Esc → 주소 변화를 최대 30초 기다린다. 결과 기록(완주)은 하지 않는다.
// 사용: node scripts/design/pairflip-check.mjs --base <URL> --set <shared_word_sets.id> --out <dir>

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
const SET = arg('set', '6f92ab53-b978-4b08-9c6c-adeab6aeee11')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s4/pairflip'))
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const tag = new URL(BASE).port

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const state of ['initial', 'selected', 'progress']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    const row = { state, base: BASE, at: new Date().toISOString() }
    try {
      await p.goto(`${BASE}/pairflip/play?set=${SET}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForSelector('button.pf-card', { timeout: 60_000 })
      await p.waitForTimeout(2500)
      const cards = p.locator('button.pf-card:not([disabled]):not([aria-disabled])')
      if (state !== 'initial') await cards.nth(0).click()
      if (state === 'progress') { await p.waitForTimeout(300); await cards.nth(1).click(); await p.waitForTimeout(250) }
      row.focus = await p.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)
      row.flipped = await p.locator('button.pf-card[aria-label*="짝을 찾고"], button.pf-card[aria-label*="매칭"]').count()
      await p.screenshot({ path: path.join(outDir, `${tag}-${state}.png`) })
      const from = new URL(p.url()).pathname
      await p.keyboard.press('Escape')
      await p.waitForURL((u) => u.pathname !== from, { timeout: 30_000 }).catch(() => {})
      row.afterEsc = new URL(p.url()).pathname
      row.ok = row.afterEsc === '/pairflip'
    } catch (e) {
      row.ok = false
      row.error = String(e).slice(0, 140)
    }
    process.stdout.write(`${row.ok ? '✓' : '✗'} ${state} ${JSON.stringify({ focus: row.focus, flipped: row.flipped, afterEsc: row.afterEsc, error: row.error })}\n`)
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_pairflip-${tag}.json`), JSON.stringify(results, null, 2))
}

run().catch((e) => { console.error(e); process.exit(1) })
