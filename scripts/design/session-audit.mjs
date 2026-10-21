// scripts/design/session-audit.mjs
//
// 학습 세션들의 **공통 조작**(종료 · 복귀 · 설정 · 진행 표시)을 같은 방법으로 잰다 — learner-tines-audit S3 ③ 세션.
// 세션마다 다른 것은 학습 방식(카드 · 철자 · 짝 맞추기 · 받아쓰기)이라 그대로 두고, 공통 조작의 자리·이름·크기만 맞추려는 것.
// 잰다: 전체화면 여부(전역 헤더 유무) · 위쪽 막대 높이 · 종료 조작(이름 · 위치 · 크기) · 설정 조작 · 진행 표시 · 첫 화면 캡처.
// 사용: node scripts/design/session-audit.mjs --base http://localhost:3041 --out <dir> --page "id|/path?query" ... [--width 1440]

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
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/session-audit'))
const width = Number(arg('width', '1440'))
const pages = args.flatMap((a, i) => (a === '--page' ? [args[i + 1]] : [])).map((s) => { const [id, url] = s.split('|'); return { id, url } })
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

function probe() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.top < innerHeight }
  const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)
  const controls = [...document.querySelectorAll('a, button, [role="button"]')].filter(vis)
  const box = (e) => { const r = e.getBoundingClientRect(); return { name: name(e), tag: e.tagName.toLowerCase(), href: e.getAttribute('href'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const exit = controls.filter((e) => /종료|나가기|닫기|그만|끝내기|돌아가기|뒤로|exit|close|quit|back/i.test(name(e)) || e.querySelector('svg.lucide-x, svg.lucide-arrow-left, svg.lucide-chevron-left')).map(box)
  const settings = controls.filter((e) => /설정|옵션|setting|option/i.test(name(e)) || e.querySelector('svg.lucide-settings, svg.lucide-settings-2, svg.lucide-sliders-horizontal')).map(box)
  const progress = [...document.querySelectorAll('[role="progressbar"], progress')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } })
  const counter = (document.body.innerText.match(/\b\d+\s*\/\s*\d+\b/) || [null])[0]
  const appHeader = Boolean([...document.querySelectorAll('header')].find((h) => vis(h) && [...h.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Today' || a.textContent.includes('Vocaflow')) && h.getBoundingClientRect().top < 5))
  // 맨 위 막대: 화면 맨 위 120px 안에서 가로 폭 60% 이상인 가장 낮은 요소
  const bars = [...document.querySelectorAll('header, nav, div')].filter((e) => { const r = e.getBoundingClientRect(); return vis(e) && r.top >= 0 && r.top < 10 && r.width > innerWidth * 0.6 && r.height > 30 && r.height < 140 })
  const bar = bars.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0]
  return {
    title: document.title.slice(0, 50),
    h1: document.querySelector('h1')?.textContent?.trim().slice(0, 40) ?? null,
    appHeader,
    topBar: bar ? { h: Math.round(bar.getBoundingClientRect().height), bg: getComputedStyle(bar).backgroundColor } : null,
    exit: exit.slice(0, 4),
    settings: settings.slice(0, 3),
    progress,
    counter,
  }
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    const row = { id: pg.id, url: pg.url, base: BASE, width, at: new Date().toISOString() }
    try {
      await p.goto(`${BASE}${pg.url}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForTimeout(6000)
      row.landed = new URL(p.url()).pathname + new URL(p.url()).search
      row.m = await p.evaluate(probe)
      await p.screenshot({ path: path.join(outDir, `${pg.id}@${width}.png`) })
      process.stdout.write(`✓ ${pg.id}\n`)
    } catch (e) {
      row.error = String(e).slice(0, 140)
      process.stdout.write(`✗ ${pg.id} — ${row.error.slice(0, 80)}\n`)
    }
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_sessions@${width}.json`), JSON.stringify(results, null, 2))
}

run().catch((e) => { console.error(e); process.exit(1) })
