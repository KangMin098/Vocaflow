// scripts/design/reading-measure.mjs
//
// 긴 글 본문 단을 같은 방법으로 잰다 — 우리 읽기 화면(/text/[id])과 참조의 긴 글(tines.com 사례 상세 등).
// 잰다: 본문 문단(긴 p 또는 [data-reading]) 의 단 x·폭 · 글자 크기 · 줄 간격 · 서체 · 색 · 문단 간격 · 한 줄 글자 수(근사).
// 사용: node scripts/design/reading-measure.mjs --out <dir> --page "id|url|auth|anon" ... [--widths 1440,1280]

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
const pages = args.flatMap((a, i) => (a === '--page' ? [args[i + 1]] : [])).map((s) => { const [id, url, mode = 'anon'] = s.split('|'); return { id, url, mode } })
const outDir = path.resolve(ROOT, arg('out', 'tmp/reading-measure'))
const widths = arg('widths', '1440,1280').split(',').map(Number)
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

function measureReading() {
  // 본문 문단: 글자 120자 이상인 p/div 중 자식 블록이 없는 것 — 화면에서 가장 많이 반복되는 x 를 본문 단으로 본다
  const cands = [...document.querySelectorAll('p, [data-reading] div, article div')].filter((e) => {
    const t = e.textContent?.trim() ?? ''
    if (t.length < 120) return false
    if ([...e.children].some((c) => getComputedStyle(c).display === 'block' && (c.textContent?.length ?? 0) > 60)) return false
    const r = e.getBoundingClientRect()
    return r.width > 200 && r.height > 20
  })
  if (!cands.length) return null
  const byX = new Map()
  for (const e of cands) { const x = Math.round(e.getBoundingClientRect().x); byX.set(x, (byX.get(x) ?? []).concat(e)) }
  const [x, group] = [...byX.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const e = group[0]
  const cs = getComputedStyle(e)
  const r = e.getBoundingClientRect()
  const gaps = group.slice(0, 6).map((g, i, a) => (i ? Math.round(g.getBoundingClientRect().top - a[i - 1].getBoundingClientRect().bottom) : null)).filter((v) => v !== null)
  const fs = parseFloat(cs.fontSize)
  return {
    paragraphs: group.length, x, w: Math.round(r.width),
    font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: cs.fontSize, lineHeight: cs.lineHeight, weight: cs.fontWeight, color: cs.color,
    gapMedian: gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : null,
    charsPerLine: Math.round(r.width / (fs * 0.5)),
    wordSpacing: cs.wordSpacing, letterSpacing: cs.letterSpacing,
  }
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const w of widths) for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', ...(pg.mode === 'auth' && fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    const row = { id: pg.id, url: pg.url, width: w, at: new Date().toISOString() }
    try {
      await p.goto(pg.url, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForTimeout(6000)
      const reject = p.getByRole('button', { name: /reject all/i }).first()
      if (await reject.isVisible().catch(() => false)) { await reject.click().catch(() => {}); await p.waitForTimeout(400) }
      row.m = await p.evaluate(measureReading)
      await p.screenshot({ path: path.join(outDir, `${pg.id}@${w}.png`) })
      process.stdout.write(`✓ ${pg.id} @${w}\n`)
    } catch (e) {
      row.error = String(e).slice(0, 140)
      process.stdout.write(`✗ ${pg.id} @${w} — ${row.error.slice(0, 80)}\n`)
    }
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, '_reading.json'), JSON.stringify(results, null, 2))
}

run().catch((e) => { console.error(e); process.exit(1) })
