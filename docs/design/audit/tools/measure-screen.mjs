// 화면 재설계 실행(2026-09-19) — 감사(Gate 3)와 **같은 기준**으로 화면 하나의 평균 신호를 다시 잰다.
// 사용: node measure-screen.mjs <webDir> <pageFile(webDir 기준)> <route> [baseUrl] [storageState]
//   정적 = page.tsx 에서 따라간 자기 import 트리(셸 layout 트리 제외)의 평균 신호 8종 합 — screen-graph.mjs 와 같은 정규식·같은 트리.
//   렌더 = 1280×900 · 390×844 라이트, reduced-motion 첫 뷰포트 DOM 계수 — capture.mjs 의 METRICS 와 같은 함수.
//   출력 순서는 verdict.md 와 같다: grid3/shadow/bigRadius/gradient/cardsLike/viz
// 계정 값은 출력하지 않는다. storageState 는 gitignore 된 playwright-auth/ 의 파일을 넘긴다.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const [, , WEB, PAGE, ROUTE, BASE = 'http://localhost:3000', STATE] = process.argv
const SRC = join(WEB, 'src')

const EXT = ['.tsx', '.ts', '.css', '/index.tsx', '/index.ts']
function resolveSpec(from, spec) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  if (existsSync(base) && /\.(tsx?|css)$/.test(base)) return base
  for (const e of EXT) if (existsSync(base + e)) return base + e
  return null
}
const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
function tree(entry) {
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) {
      if (/^import\s+type\b/.test(m[0])) continue
      const r = resolveSpec(f, m[1] || m[2])
      if (r && !seen.has(r)) stack.push(r)
    }
  }
  return seen
}
function layoutsFor(pageAbs) {
  const out = []
  let d = dirname(pageAbs)
  const appDir = join(SRC, 'app')
  while (d.startsWith(appDir)) {
    const l = join(d, 'layout.tsx')
    if (existsSync(l)) out.push(l)
    if (d === appDir) break
    d = dirname(d)
  }
  return out
}
const SIGNALS = {
  'grid-3eq': /(?<![\w-])(?:(?:sm|md|lg|xl):)?grid-cols-3(?![\w-])/g,
  'shadow-heavy': /(?<![\w-])(?:hover:)?shadow-(?:md|lg|xl|2xl)(?![\w-])/g,
  'rounded-big': /(?<![\w-])rounded-(?:xl|2xl|3xl)(?![\w-])/g,
  gradient: /bg-gradient-to-|linear-gradient\(|radial-gradient\(/g,
  'ai-purple': /#8B5CF6|#7C3AED|#6D28D9|#A78BFA|(?<![\w-])(?:bg|text|border|from|to|via|ring)-(?:violet|purple|indigo)-\d{2,3}/gi,
  glass: /backdrop-blur/g,
  'float-hover': /hover:-translate-y-/g,
  'infinite-anim': /_infinite\]|animate-(?:bounce|ping)(?![\w-])/g,
}

const pageAbs = join(WEB, PAGE)
const own = tree(pageAbs)
for (const l of layoutsFor(pageAbs)) for (const f of tree(l)) own.delete(f)
const counts = Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, 0]))
for (const f of own) {
  if (/__tests__|\.test\./.test(f)) continue
  const t = readFileSync(f, 'utf8')
  for (const [k, re] of Object.entries(SIGNALS)) counts[k] += t.match(re)?.length ?? 0
}
const staticTotal = Object.values(counts).reduce((a, b) => a + b, 0)

const METRICS = () => {
  const vh = innerHeight
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 }
  const els = [...document.querySelectorAll('body *')].filter(inFold).slice(0, 5000)
  let grid3 = 0, shadow = 0, bigRadius = 0, gradient = 0, cardsLike = 0
  for (const el of els) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.display.includes('grid')) { const t = cs.gridTemplateColumns.split(' ').filter(Boolean); if (t.length === 3 && new Set(t).size === 1) grid3++ }
    if (cs.boxShadow !== 'none' && !cs.boxShadow.includes('0px 0px 0px 1px')) shadow++
    if (parseFloat(cs.borderTopLeftRadius) >= 12 && r.width > 120) bigRadius++
    if (cs.backgroundImage.includes('gradient')) gradient++
    if (r.width > 120 && r.height > 60 && el.children.length >= 2 && (cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none') && cs.borderTopStyle !== 'none') cardsLike++
  }
  const viz = [...document.querySelectorAll('svg, canvas')].filter((e) => { const r = e.getBoundingClientRect(); return inFold(e) && r.width >= 120 && r.height >= 60 })
  const h1 = document.querySelector('h1')
  return `${grid3}/${shadow}/${bigRadius}/${gradient}/${cardsLike}/${viz.length} · h1=${h1 ? 'yes' : 'no'}`
}

const require = createRequire(join(WEB, 'package.json'))
const { chromium } = require('@playwright/test')
const browser = await chromium.launch()
const render = {}
for (const [w, h] of [[1280, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', ...(STATE ? { storageState: STATE } : {}) })
  const page = await ctx.newPage()
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 120000 })
  await page.evaluate(() => document.fonts.ready)
  render[w] = new URL(page.url()).pathname === ROUTE ? await page.evaluate(METRICS) : `redirected → ${new URL(page.url()).pathname}`
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify({ route: ROUTE, static: staticTotal, staticBy: Object.fromEntries(Object.entries(counts).filter(([, v]) => v)), render }, null, 1))
