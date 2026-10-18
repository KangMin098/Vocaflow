// scripts/design/layout-measure.mjs
//
// 화면 골격을 **같은 방법으로** 잰다 — 우리 화면과 참조(tines.com)를 한 도구로 재야 숫자를 나란히 놓을 수 있다.
// 잰다: 본문 영역(x·폭) · 왼쪽 레일 유무와 폭 · 첫 화면의 큰 구획(위치·크기·면색·모서리) ·
//       반복 카드 격자(한 줄 개수 · 카드 크기 · 간격 · 모서리) · h1 · 탭/검색/필터 조작의 유무와 위치.
//
// 사용: node -r dotenv/config scripts/design/layout-measure.mjs --out <dir> --widths 1440,1280 \
//         --page "id|url|auth" --page "id|url|anon" ...
//   auth = 우리 앱 로그인 상태(capture-learner 와 같은 상태 파일) · anon = 로그인 없음(참조 사이트 포함)
// 산출: <dir>/<id>@<w>.png(첫 화면) · <dir>/_layout.json

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
const pages = args.flatMap((a, i) => (a === '--page' ? [args[i + 1]] : [])).map((s) => {
  const [id, url, mode = 'anon'] = s.split('|')
  return { id, url, mode }
})
const outDir = path.resolve(ROOT, arg('out', 'tmp/layout-measure'))
const widths = arg('widths', '1440,1280').split(',').map(Number)
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

function measureLayout() {
  const vw = innerWidth
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const box = (e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, radius: cs.borderRadius, border: cs.borderTopWidth !== '0px' ? `${cs.borderTopWidth} ${cs.borderTopColor}` : null }
  }
  const header = document.querySelector('header')
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0
  const h1 = document.querySelector('h1')

  // 왼쪽 레일: 화면 왼쪽 1/3 안에서 시작하고, 폭 160~420, 높이 300 이상, 오른쪽에 본문이 따로 있는 세로 블록
  const rail = [...document.querySelectorAll('aside, nav, div')].filter((e) => {
    if (!vis(e)) return false
    const r = e.getBoundingClientRect()
    return r.left < vw / 3 && r.width >= 160 && r.width <= 420 && r.height >= 300 && r.top >= headerBottom - 2 && r.top < 400
      && e.querySelectorAll('a, button, input').length >= 4
  }).sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]

  // 첫 화면 큰 구획: 헤더 아래 ~1.5 화면 안, 폭 400 이상, 높이 120 이상, 면색이나 테두리가 있는 것 — 바깥 것만
  const big = [...document.querySelectorAll('main *, body > div *')].filter((e) => {
    if (!vis(e)) return false
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return r.top >= headerBottom - 2 && r.top < innerHeight * 1.5 && r.width >= 400 && r.height >= 120
      && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || e.tagName === 'IMG')
  })
  const outer = big.filter((e) => !big.some((o) => o !== e && o.contains(e))).slice(0, 8).map(box)

  // 반복 카드 격자: 같은 부모 아래 같은 폭(±2px)의 형제가 3개 이상 — 가장 큰 무리
  let grid = null
  for (const parent of document.querySelectorAll('main *, body > div *')) {
    const kids = [...parent.children].filter((k) => vis(k) && k.getBoundingClientRect().width >= 120 && k.getBoundingClientRect().height >= 80)
    if (kids.length < 3) continue
    const w0 = kids[0].getBoundingClientRect().width
    const same = kids.filter((k) => Math.abs(k.getBoundingClientRect().width - w0) <= 2)
    if (same.length < 3) continue
    const top0 = same[0].getBoundingClientRect().top
    const perRow = same.filter((k) => Math.abs(k.getBoundingClientRect().top - top0) <= 2).length
    if (perRow < 2) continue
    const r0 = same[0].getBoundingClientRect(), r1 = same[1].getBoundingClientRect()
    const cand = { count: same.length, perRow, cardW: Math.round(r0.width), cardH: Math.round(r0.height), gapX: perRow > 1 ? Math.round(r1.left - r0.right) : null, x: Math.round(r0.left), y: Math.round(r0.top + scrollY), radius: getComputedStyle(same[0]).borderRadius }
    if (!grid || cand.count * cand.cardW > grid.count * grid.cardW) grid = cand
  }

  // 본문 영역: h1 이 든 가장 넓지 않은 컨테이너(뷰포트 폭보다 좁은 첫 조상) — 없으면 main
  let content = h1 ?? document.querySelector('main')
  while (content && content.parentElement && content.getBoundingClientRect().width < vw * 0.5) content = content.parentElement
  const controls = {
    search: [...document.querySelectorAll('input[type="search"], input[placeholder]')].filter(vis).slice(0, 2).map((e) => ({ ...box(e), placeholder: e.getAttribute('placeholder')?.slice(0, 30) })),
    tabs: [...document.querySelectorAll('[role="tab"]')].filter(vis).length,
    selects: [...document.querySelectorAll('select, [aria-haspopup="listbox"], [aria-haspopup="menu"]')].filter(vis).length,
  }
  return {
    title: document.title.slice(0, 60),
    docHeight: document.documentElement.scrollHeight,
    headerH: Math.round(headerBottom),
    h1: h1 ? { ...box(h1), text: h1.textContent.trim().slice(0, 40), font: getComputedStyle(h1).fontFamily.split(',')[0].replace(/["']/g, ''), size: getComputedStyle(h1).fontSize, weight: getComputedStyle(h1).fontWeight, color: getComputedStyle(h1).color } : null,
    content: content ? box(content) : null,
    rail: rail ? { ...box(rail), links: rail.querySelectorAll('a, button').length } : null,
    blocks: outer,
    grid,
    controls,
  }
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const w of widths) for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR', reducedMotion: 'reduce', ...(pg.mode === 'auth' && fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const page = await ctx.newPage()
    const row = { id: pg.id, url: pg.url, mode: pg.mode, width: w, at: new Date().toISOString() }
    try {
      const res = await page.goto(pg.url, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      row.status = res?.status() ?? null
      await page.waitForTimeout(5000)
      row.landed = page.url()
      const reject = page.getByRole('button', { name: /reject all|decline/i }).first()
      if (await reject.isVisible().catch(() => false)) { await reject.click().catch(() => {}); await page.waitForTimeout(400) }
      row.m = await page.evaluate(measureLayout)
      await page.screenshot({ path: path.join(outDir, `${pg.id}@${w}.png`) })
      process.stdout.write(`✓ ${pg.id} @${w}\n`)
    } catch (e) {
      row.error = String(e).slice(0, 140)
      process.stdout.write(`✗ ${pg.id} @${w} — ${row.error.slice(0, 80)}\n`)
    }
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  const file = path.join(outDir, '_layout.json')
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  const key = (r) => `${r.id}@${r.width}`
  fs.writeFileSync(file, JSON.stringify([...prev.filter((r) => !results.some((n) => key(n) === key(r))), ...results], null, 2))
  console.log(`\n${results.filter((r) => !r.error).length}/${results.length} → ${outDir}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
