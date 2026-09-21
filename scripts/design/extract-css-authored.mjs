#!/usr/bin/env node
// scripts/design/extract-css-authored.mjs
//
// 참조 사이트가 **작성한 CSS** 에서 값만 집계한다(형용사 0 · 판정 0 · 이미지 0 · 원문 0).
// extract-computed 는 화면에 찍힌 요소의 계산값만 본다 — hover·열린 메뉴·모션처럼
// 측정 시점에 안 보이는 값(transition · @keyframes · 분기점 · 작성된 모서리 전체)은 여기서 얻는다(DD-62 Stage 1 보강).
//
//   node scripts/design/extract-css-authored.mjs
//   node scripts/design/extract-css-authored.mjs --out <dir>
//
// 산출: <out>/css-authored.json · <out>/css-authored-summary.md
// CSS 파일 자체는 저장하지 않는다 — 저장소에 남는 것은 집계된 수치뿐이다(서체·키프레임 본문 포함 0).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, chromium } from './lib/ref-page.mjs'

const require = createRequire(import.meta.url)
const postcss = require(require.resolve('postcss', { paths: [path.join(ROOT, 'apps/web')] }))

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const OUT = path.resolve(ROOT, arg('--out', 'docs/design/refs/tines'))

// 메뉴·요금·목록 화면은 홈에 없는 모듈 CSS 를 따로 싣는다.
const PAGES = [
  'https://www.tines.com/',
  'https://www.tines.com/product',
  'https://www.tines.com/pricing',
  'https://www.tines.com/solutions',
  'https://www.tines.com/library',
  'https://www.tines.com/blog',
]
const VP = { key: '1440', width: 1440, height: 900 }

// 우리 모션·모서리 토큰 — 대조 열은 이 값에 대한 기계적 최근접만 적는다.
const TOKENS = path.join(ROOT, 'packages/design-tokens/src/tokens.css')

// ── 수집 ───────────────────────────────────────────────────────────────────
// lib/ref-page 의 openRef 는 쓰지 않는다 — 모션을 멈추는 <style> 을 주입해 집계를 오염시킨다.
const sheets = new Map() // url -> css text
let rootFontPx = 16
const browser = await chromium.launch()
for (const url of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const pending = []
  page.on('response', (res) => {
    if (res.request().resourceType() !== 'stylesheet' || sheets.has(res.url())) return
    pending.push(res.text().then((t) => sheets.set(res.url(), t)).catch(() => {}))
  })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
  await Promise.all(pending)
  rootFontPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  // 인라인 <style> 도 작성된 CSS 다.
  const inline = await page.evaluate(() => Array.from(document.querySelectorAll('style')).map((s) => s.textContent || ''))
  inline.forEach((t, i) => { if (t.trim()) sheets.set(`${url}#style${i}`, t) })
  console.log(`${url} · 누적 시트 ${sheets.size}`)
  await ctx.close()
}
await browser.close()

// ── 집계 ───────────────────────────────────────────────────────────────────
const tally = {}
const bump = (k, v) => {
  const m = (tally[k] ??= new Map())
  m.set(v, (m.get(v) || 0) + 1)
}
const media = new Map()
const keyframes = new Map() // name -> Set(animated props)
const fontFaces = new Map() // family -> Set(weight style)
let rules = 0, decls = 0, bytes = 0, failed = 0

const stripHash = (s) => s.replace(/^[\w-]*?(?:-module__[\w-]+?__)/, '')
const TRANSITION_RE = /,(?![^(]*\))/

for (const [, src] of sheets) {
  bytes += src.length
  let root
  try { root = postcss.parse(src) } catch { failed++; continue }
  root.walkAtRules((r) => {
    if (r.name === 'media') media.set(r.params.replace(/\s+/g, ''), (media.get(r.params.replace(/\s+/g, '')) || 0) + 1)
    if (/keyframes$/.test(r.name)) {
      const set = keyframes.get(stripHash(r.params)) || new Set()
      r.walkDecls((d) => set.add(d.prop))
      keyframes.set(stripHash(r.params), set)
    }
    if (r.name === 'font-face') {
      const o = {}
      r.walkDecls((d) => { if (d.prop !== 'src') o[d.prop] = d.value })
      const fam = (o['font-family'] || '?').replace(/["']/g, '')
      const set = fontFaces.get(fam) || new Set()
      set.add(`${o['font-weight'] || 'var'} ${o['font-style'] || 'normal'}`)
      fontFaces.set(fam, set)
    }
  })
  root.walkRules(() => { rules++ })
  root.walkDecls((d) => {
    decls++
    const p = d.prop
    const v = d.value.trim().replace(/\s*!important$/, '')
    // 커스텀 속성은 값만 모은다 — 아래에서 var(--radius) 같은 참조를 푸는 데 쓴다.
    if (p.startsWith('--')) { bump(`var:${p}`, v); return }
    if (/^border(-(top|bottom)-(left|right))?-radius$/.test(p)) bump('radius', v)
    else if (p === 'box-shadow') bump('box-shadow', v)
    else if (p === 'backdrop-filter') bump('backdrop-filter', v)
    else if (p === 'transition-property') for (const t of v.split(TRANSITION_RE)) bump('transition-property', t.trim())
    else if (p === 'transition-duration' || p === 'animation-duration') bump('duration', v)
    else if (p === 'transition-timing-function' || p === 'animation-timing-function') bump('easing', v)
    else if (p === 'transition') {
      for (const t of v.split(TRANSITION_RE)) {
        const parts = t.trim().split(/\s+(?![^(]*\))/)
        if (parts[0] === 'none') continue
        const prop = parts.find((x) => /^[a-z-]+$/.test(x) && !/^(ease|ease-in|ease-out|ease-in-out|linear)$/.test(x))
        if (prop) bump('transition-property', prop)
        const du = parts.find((x) => /^-?\d*\.?\d+m?s$/.test(x))
        if (du) bump('duration', du)
        const ea = parts.find((x) => /^(cubic-bezier|steps|ease|linear|var)/.test(x))
        if (ea) bump('easing', ea)
      }
    } else if (p === 'animation') {
      for (const t of v.split(TRANSITION_RE)) {
        if (t.trim() === 'none') continue
        bump('animation-iteration', /\binfinite\b/.test(t) ? 'infinite' : 'finite')
        const du = t.trim().split(/\s+(?![^(]*\))/).find((x) => /^-?\d*\.?\d+m?s$/.test(x))
        if (du) bump('duration', du)
        const ea = t.match(/cubic-bezier\([^)]*\)|steps\((?:[^()]|\([^)]*\))*\)|\bease(-in-out|-in|-out)?\b|\blinear\b/)
        if (ea) bump('easing', ea[0])
      }
    } else if (p === 'animation-iteration-count') bump('animation-iteration', v === 'infinite' ? 'infinite' : 'finite')
    else if (p === 'z-index') bump('z-index', v)
  })
}

// ── 환산 · 대조 ────────────────────────────────────────────────────────────
const toMs = (s) => (s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000)
const toPx = (s) => {
  if (/^-?\d*\.?\d+px$/.test(s)) return parseFloat(s)
  if (/^-?\d*\.?\d+rem$/.test(s)) return Math.round(parseFloat(s) * rootFontPx * 100) / 100
  if (s === '0') return 0
  return null
}
const tokenCss = fs.readFileSync(TOKENS, 'utf8')
const tokenVals = (re) => [...tokenCss.matchAll(re)].map((m) => ({ name: m[1], value: m[2].trim() }))
const durTokens = tokenVals(/(--dur-[a-z]+)\s*:\s*([^;]+);/g).map((t) => ({ ...t, ms: toMs(t.value) }))
const easeTokens = tokenVals(/(--ease[a-z-]*)\s*:\s*([^;]+);/g)
const radiusTokens = tokenVals(/(--r-(?:sm|md|lg|xl|2xl|full))\s*:\s*([^;]+);/g).map((t) => ({ ...t, px: toPx(t.value) }))
const nearest = (list, key, x) => list.reduce((a, b) => (Math.abs(b[key] - x) < Math.abs(a[key] - x) ? b : a))

const sorted = (k) => [...(tally[k] || new Map())].sort((a, b) => b[1] - a[1])
// var(--x) 는 사이트가 --x 에 작성한 값들로 푼다(범위마다 다른 값일 수 있어 빈도순 목록).
const resolveVar = (v) => {
  const m = /^var\((--[\w-]+)\)$/.exec(v)
  return m ? sorted(`var:${m[1]}`).map(([value, count]) => ({ value, px: toPx(value), count })) : null
}
// 100px 이상은 높이와 무관하게 양 끝이 반원이다 — 우리 쪽 대응은 --r-full.
const PILL_PX = 100
const fixedRadius = radiusTokens.filter((r) => r.px < 9999)
const OUR_MAX_PX = Math.max(...fixedRadius.map((r) => r.px))
const radiusToken = (px) => {
  if (px == null || px === 0) return null
  if (px >= PILL_PX) return '--r-full'
  return nearest(fixedRadius, 'px', px).name
}
const durations = sorted('duration').map(([v, n]) => {
  const ms = /^-?\d*\.?\d+m?s$/.test(v) ? toMs(v) : null
  const t = ms == null || !durTokens.length ? null : nearest(durTokens, 'ms', ms)
  const resolved = resolveVar(v)?.map((r) => r.value)
  return { value: v, ms, count: n, nearestToken: t?.name ?? null, deltaMs: t ? Math.round((ms - t.ms) * 100) / 100 : null, resolved }
})
const radii = sorted('radius').map(([v, n]) => {
  const px = toPx(v)
  const resolved = resolveVar(v)
  return { value: v, px, count: n, nearestToken: radiusToken(px), overOurMax: px != null && px > OUR_MAX_PX && px < PILL_PX, resolved }
})

const data = {
  generatedBy: 'scripts/design/extract-css-authored.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  pages: PAGES,
  rootFontPx,
  scale: { sheets: sheets.size, bytes, rules, decls, parseFailed: failed },
  media: [...media].sort((a, b) => b[1] - a[1]),
  durations,
  easing: sorted('easing'),
  transitionProperty: sorted('transition-property'),
  animationIteration: Object.fromEntries(sorted('animation-iteration')),
  keyframes: [...keyframes].map(([name, props]) => ({ name, props: [...props].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
  radii,
  ourMaxRadiusPx: OUR_MAX_PX,
  boxShadow: sorted('box-shadow'),
  backdropFilter: sorted('backdrop-filter'),
  zIndex: sorted('z-index'),
  fontFaces: Object.fromEntries([...fontFaces].map(([f, s]) => [f, [...s].sort()])),
  ourTokens: { durations: durTokens, easing: easeTokens, radius: radiusTokens },
}

// ── 요약 ───────────────────────────────────────────────────────────────────
function summarize(d) {
  const L = []
  const row = (...c) => L.push(`| ${c.join(' | ')} |`)
  L.push('# Tines — authored CSS values (Stage 1 보강)')
  L.push('')
  L.push(`> 생성 \`scripts/design/extract-css-authored.mjs\` · ${d.generatedAt} · 출처 ${d.pages.length}페이지(${d.pages.map((u) => new URL(u).pathname).join(' ')})`)
  L.push('> **손으로 고치지 말 것** — 다음 실행에 덮어써진다. 형용사·판정은 이 파일에 적지 않는다(DD-62).')
  L.push(`> 원문 CSS·서체·키프레임 본문은 저장하지 않는다. rem 은 루트 ${d.rootFontPx}px 로 환산했다. 「최근접 토큰」은 거리만 잰 것이고 채택 여부가 아니다.`)
  L.push('')
  L.push(`규모: 시트 ${d.scale.sheets} · ${Math.round(d.scale.bytes / 1024)} KiB · 규칙 ${d.scale.rules} · 선언 ${d.scale.decls}${d.scale.parseFailed ? ` · 파싱 실패 ${d.scale.parseFailed}` : ''}`)
  L.push('')

  L.push('## 분기점 (@media)')
  L.push('')
  row('조건', '등장'); row('---', '---')
  for (const [q, n] of d.media.slice(0, 20)) row(`\`${q}\``, n)
  L.push('')

  L.push('## 모션')
  L.push('')
  L.push(`우리 토큰: ${d.ourTokens.durations.map((t) => `\`${t.name}\` ${t.value}`).join(' · ')} · ${d.ourTokens.easing.map((t) => `\`${t.name}\` \`${t.value}\``).join(' · ')}`)
  L.push('')
  L.push('### 지속시간')
  L.push('')
  row('값', 'ms', '등장', '최근접 토큰', 'Δms'); row('---', '---', '---', '---', '---')
  for (const x of d.durations.slice(0, 20)) {
    const val = x.resolved?.length ? `\`${x.value}\` → ${x.resolved.slice(0, 4).map((r) => `\`${r}\``).join(' · ')}` : `\`${x.value}\``
    row(val, x.ms ?? '—', x.count, x.nearestToken ? `\`${x.nearestToken}\`` : '—', x.deltaMs ?? '—')
  }
  L.push('')
  L.push('### 이징')
  L.push('')
  row('값', '등장'); row('---', '---')
  for (const [v, n] of d.easing.slice(0, 15)) row(`\`${v}\``, n)
  L.push('')
  L.push('### transition 대상 속성')
  L.push('')
  L.push(d.transitionProperty.slice(0, 15).map(([v, n]) => `\`${v}\` ×${n}`).join(' · '))
  L.push('')
  const it = d.animationIteration
  L.push(`### @keyframes (${d.keyframes.length}개) · animation 반복: 유한 ${it.finite || 0} · 무한 ${it.infinite || 0}`)
  L.push('')
  row('이름', '움직이는 속성'); row('---', '---')
  for (const k of d.keyframes) row(`\`${k.name}\``, k.props.map((p) => `\`${p}\``).join(' ') || '—')
  L.push('')

  L.push('## 모서리 (작성값 전체)')
  L.push('')
  L.push(`우리 토큰: ${d.ourTokens.radius.map((t) => `\`${t.name}\` ${t.value}`).join(' · ')}`)
  L.push('')
  row('값', 'px', '등장', '최근접 토큰', `우리 상한 ${d.ourMaxRadiusPx}px 초과`, 'var 작성값 (빈도순)'); row('---', '---', '---', '---', '---', '---')
  for (const x of d.radii.slice(0, 25)) {
    const res = x.resolved?.length
      ? x.resolved.slice(0, 6).map((r) => `\`${r.value}\`${r.px != null ? ` ${r.px}px` : ''} ×${r.count}`).join(' · ')
      : '—'
    row(`\`${x.value}\``, x.px ?? '—', x.count, x.nearestToken ? `\`${x.nearestToken}\`` : '—', x.overOurMax ? '예' : '—', res)
  }
  L.push('')

  L.push('## 그림자 · 블러 · 층')
  L.push('')
  L.push(`- box-shadow 작성 ${d.boxShadow.reduce((a, [, n]) => a + n, 0)}건: ${d.boxShadow.slice(0, 10).map(([v, n]) => `\`${v}\` ×${n}`).join(' · ')}`)
  L.push(`- backdrop-filter 작성 ${d.backdropFilter.reduce((a, [, n]) => a + n, 0)}건: ${d.backdropFilter.slice(0, 10).map(([v, n]) => `\`${v}\` ×${n}`).join(' · ')}`)
  L.push(`- z-index: ${d.zIndex.slice(0, 16).map(([v, n]) => `${v} ×${n}`).join(' · ')}`)
  L.push('')

  L.push('## @font-face (패밀리 · 굵기 · 스타일만)')
  L.push('')
  for (const [f, s] of Object.entries(d.fontFaces)) L.push(`- ${f}: ${s.join(', ')}`)
  L.push('')
  return L.join('\n') + '\n'
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'css-authored.json'), JSON.stringify(data, null, 2) + '\n', 'utf8')
fs.writeFileSync(path.join(OUT, 'css-authored-summary.md'), summarize(data), 'utf8')
console.log(`\n${path.relative(ROOT, path.join(OUT, 'css-authored.json'))} · css-authored-summary.md`)
