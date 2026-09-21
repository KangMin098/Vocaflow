#!/usr/bin/env node
// scripts/design/extract-ui-kit.mjs
//
// 참조 사이트 **UI 부품 실측**(DD-68 · tines-mapping §14) — 코퍼스(tines-corpus.mjs)의 템플릿마다 첫 페이지를 다시 열어
// 화면 구조가 아니라 **부품 단위**를 잰다:
//   · 버튼 — 채움/테두리 서명(바탕 · 글자 · 테두리 · 모서리 · 높이 · 서체 · 대소문자) + 서명마다 호버 뒤 값
//   · 탭 — role=tab 과 aria-pressed 무리: 선택/비선택 모양 · 목록 틀 · 페이지 안 위치(위/아래)
//   · 칩 — 높이 16–30 · 둥근 끝 · 칠한 바탕의 짧은 글
//   · 입력 — input · textarea · select
//   · 카드 — 모서리 8↑ · 칠함 또는 테두리 · 200–700 폭
//   · 층 — position fixed/sticky 요소(z-index · 바탕 · backdrop · 그림자 · 위/아래 붙음)
//   · 그림자 — box-shadow 가 있는 요소
// 산출: docs/design/refs/tines/ui-kit-summary.md · ui-kit.json (수치만 — 캡처는 만들지 않는다)
//
//   node scripts/design/extract-ui-kit.mjs [--conc 4] [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, dismissOverlays } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const CONC = Number(flag('--conc', '4'))
const LIMIT = Number(flag('--limit', '0'))
const SEL = path.join(ROOT, 'tmp/tines-corpus/selection.json')
const OUT_MD = path.join(ROOT, 'docs/design/refs/tines/ui-kit-summary.md')
const OUT_JSON = path.join(ROOT, 'docs/design/refs/tines/ui-kit.json')
const RAW = path.join(ROOT, 'tmp/tines-corpus/ui-kit-raw.json')

if (!fs.existsSync(SEL)) { console.error('먼저 tines-corpus.mjs 를 돌려 selection.json 을 만든다'); process.exit(2) }
const seen = new Set()
let pages = JSON.parse(fs.readFileSync(SEL, 'utf8')).filter((p) => !seen.has(p.template) && seen.add(p.template))
if (LIMIT) pages = pages.slice(0, LIMIT)

function measure() {
  const vw = innerWidth
  const pageBg = getComputedStyle(document.body).backgroundColor
  const paint = (c) => c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && !/\/\s*0\)$/.test(c) && !/,\s*0\)$/.test(c)
  const vis = (el, r) => { const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 }
  const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ')
  const font = (cs) => `${cs.fontFamily.split(',')[0].replace(/"/g, '')} ${cs.fontSize}/${cs.fontWeight}`
  const out = { buttons: [], tabs: [], pressed: [], chips: [], inputs: [], cards: [], layers: [], shadows: [] }

  let bi = 0
  for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
    const r = el.getBoundingClientRect()
    if (!vis(el, r) || r.height < 24 || r.height > 72 || r.width > 480) continue
    const t = txt(el)
    if (!t || t.length > 40) continue
    const cs = getComputedStyle(el)
    const bw = parseFloat(cs.borderTopWidth) || 0
    if (!paint(cs.backgroundColor) && bw === 0) continue
    el.setAttribute('data-uikit-btn', String(bi++))
    out.buttons.push({ i: bi - 1, text: t.slice(0, 30), bg: cs.backgroundColor, color: cs.color, border: bw ? `${cs.borderTopWidth} ${cs.borderTopColor}` : 'none', radius: cs.borderTopLeftRadius, h: Math.round(r.height), w: Math.round(r.width), padX: cs.paddingLeft, font: font(cs), transform: cs.textTransform, spacing: cs.letterSpacing, shadow: cs.boxShadow, onBg: (() => { for (let e = el.parentElement; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (paint(b)) return b } return pageBg })() })
  }
  for (const el of document.querySelectorAll('[role="tab"]')) {
    const r = el.getBoundingClientRect()
    if (!vis(el, r)) continue
    const cs = getComputedStyle(el)
    const list = el.closest('[role="tablist"]') || el.parentElement
    const lr = list.getBoundingClientRect()
    const ls = getComputedStyle(list)
    out.tabs.push({ text: txt(el).slice(0, 24), selected: el.getAttribute('aria-selected') === 'true', bg: cs.backgroundColor, color: cs.color, borderB: `${cs.borderBottomWidth} ${cs.borderBottomColor}`, radius: cs.borderTopLeftRadius, h: Math.round(r.height), font: font(cs), listBg: ls.backgroundColor, listRadius: ls.borderTopLeftRadius, listPad: ls.paddingLeft, listW: Math.round(lr.width), orient: lr.width > lr.height * 2 ? '가로' : '세로', y: Math.round(r.top + scrollY) })
  }
  for (const el of document.querySelectorAll('[aria-pressed]')) {
    const r = el.getBoundingClientRect()
    if (!vis(el, r)) continue
    const cs = getComputedStyle(el)
    out.pressed.push({ text: txt(el).slice(0, 24), on: el.getAttribute('aria-pressed') === 'true', bg: cs.backgroundColor, color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopColor}`, radius: cs.borderTopLeftRadius, h: Math.round(r.height), font: font(cs) })
  }
  for (const el of document.querySelectorAll('span, div, a, li, p')) {
    const r = el.getBoundingClientRect()
    if (r.height < 16 || r.height > 30 || r.width > 260 || !vis(el, r)) continue
    const cs = getComputedStyle(el)
    if (!paint(cs.backgroundColor)) continue
    const rad = parseFloat(cs.borderTopLeftRadius) || 0
    const t = txt(el)
    if (rad < r.height / 2 - 2 || !t || t.length > 24 || el.children.length > 3) continue
    out.chips.push({ text: t.slice(0, 20), bg: cs.backgroundColor, color: cs.color, h: Math.round(r.height), padX: cs.paddingLeft, font: font(cs), transform: cs.textTransform })
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select')) {
    const r = el.getBoundingClientRect()
    if (!vis(el, r)) continue
    const cs = getComputedStyle(el)
    out.inputs.push({ tag: el.tagName.toLowerCase(), type: el.type || '', bg: cs.backgroundColor, color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopColor}`, radius: cs.borderTopLeftRadius, h: Math.round(r.height), padX: cs.paddingLeft, font: font(cs) })
  }
  for (const el of document.querySelectorAll('div, a, li, article, section')) {
    const r = el.getBoundingClientRect()
    if (r.width < 200 || r.width > 700 || r.height < 120 || r.height > 640 || !vis(el, r)) continue
    const cs = getComputedStyle(el)
    const rad = parseFloat(cs.borderTopLeftRadius) || 0
    const bw = parseFloat(cs.borderTopWidth) || 0
    if (rad < 8 || (!paint(cs.backgroundColor) && bw === 0)) continue
    if (el.parentElement && getComputedStyle(el.parentElement).borderTopLeftRadius === cs.borderTopLeftRadius && getComputedStyle(el.parentElement).backgroundColor === cs.backgroundColor) continue
    out.cards.push({ bg: cs.backgroundColor, border: bw ? `${cs.borderTopWidth} ${cs.borderTopColor}` : 'none', radius: cs.borderTopLeftRadius, pad: cs.paddingLeft, shadow: cs.boxShadow, w: Math.round(r.width), h: Math.round(r.height), link: el.tagName === 'A' || !!el.querySelector(':scope > a:only-child') })
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      const r = el.getBoundingClientRect()
      if (r.width < 100 || !vis(el, r)) continue
      out.layers.push({ pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor, backdrop: cs.backdropFilter, shadow: cs.boxShadow, top: cs.top, bottom: cs.bottom, h: Math.round(r.height), w: Math.round(r.width), cls: String(el.className || '').slice(0, 60) })
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      const r = el.getBoundingClientRect()
      if (r.width * r.height < 2000 || !vis(el, r)) continue
      out.shadows.push({ v: cs.boxShadow, w: Math.round(r.width), h: Math.round(r.height) })
    }
  }
  return out
}

async function hoverDiff(page, list) {
  // 서명마다 첫 요소 하나만 올려 본다(페이지당 최대 6)
  const bySig = new Map()
  for (const b of list) { const k = [b.bg, b.color, b.border, b.radius].join('|'); if (!bySig.has(k)) bySig.set(k, b) }
  for (const b of [...bySig.values()].slice(0, 6)) {
    const loc = page.locator(`[data-uikit-btn="${b.i}"]`)
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 })
      await loc.hover({ timeout: 2000 })
      await page.waitForTimeout(350)
      b.hover = await loc.evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopColor}`, transform: cs.transform, shadow: cs.boxShadow, deco: cs.textDecorationLine } })
    } catch { /* 가려진 요소 — 호버 기록 없음 */ }
  }
}

const results = []
const browser = await chromium.launch()
let k = 0
async function worker() {
  while (k < pages.length) {
    const p = pages[k++]
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    try {
      await page.goto(p.url, { waitUntil: 'load', timeout: 90_000 })
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
      await dismissOverlays(page)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } scrollTo(0, 0) })
      await page.waitForTimeout(800)
      const m = await page.evaluate(measure)
      await hoverDiff(page, m.buttons)
      results.push({ ...p, ...m })
      console.log(`[${results.length}/${pages.length}] ${p.template} 버튼 ${m.buttons.length} 탭 ${m.tabs.length} 칩 ${m.chips.length} 입력 ${m.inputs.length} 카드 ${m.cards.length} 층 ${m.layers.length}`)
    } catch (e) {
      console.log(`✗ ${p.template} ${e.message.split('\n')[0]}`)
    } finally { await ctx.close() }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
await browser.close()
fs.writeFileSync(RAW, JSON.stringify(results))

// ── 집계 ────────────────────────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
/** 색 문자열 안의 rgb()/display-p3 를 sRGB hex 로(투명도는 /a 로 남긴다) */
function hx(c) {
  if (!c) return c
  return c.replace(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g, (_, r, g, b, a) => {
    const h = '#' + [r, g, b].map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('')
    return a !== undefined && +a < 1 ? `${h}/${(+a).toFixed(2)}` : h
  }).replace(/color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)/g, (_, r, g, b, a) => {
    const h = '#' + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, +v)) * 255).toString(16).padStart(2, '0')).join('')
    return a !== undefined && +a < 1 ? `${h}/${(+a).toFixed(2)}` : h
  }).replace(/color\(display-p3\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)/g, (_, r, g, b, a) => {
    const [R, G, B] = [+r, +g, +b].map(lin)
    const X = 0.4865709 * R + 0.2656677 * G + 0.1982173 * B, Y = 0.2289746 * R + 0.6917385 * G + 0.0792869 * B, Z = 0.0451134 * G + 1.0439444 * B
    const s = [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z]
    const h = '#' + s.map((v) => Math.round(Math.min(1, Math.max(0, gam(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('')
    return a !== undefined && +a < 1 ? `${h}/${(+a).toFixed(2)}` : h
  })
}
function tally(items, keyFn, n = 20) {
  const m = new Map()
  for (const it of items) { const k = keyFn(it); const e = m.get(k) ?? { k, n: 0, pages: new Set(), ex: it }; e.n++; e.pages.add(it._page); m.set(k, e) }
  return [...m.values()].sort((a, b) => b.pages.size * 10 + b.n - (a.pages.size * 10 + a.n)).slice(0, n)
}
const all = (key) => results.flatMap((r) => r[key].map((x) => ({ ...x, _page: r.url, _tpl: r.template })))
const btn = tally(all('buttons'), (b) => [hx(b.bg), hx(b.color), hx(b.border), b.radius, b.h, b.font, b.transform].join(' · '), 24)
const tabs = tally(all('tabs'), (t) => [t.selected ? '선택' : '비선택', hx(t.bg), hx(t.color), hx(t.borderB), t.radius, t.h, t.font, '| 틀 ' + hx(t.listBg), t.listRadius, t.orient].join(' · '), 16)
const pressed = tally(all('pressed'), (t) => [t.on ? '켬' : '끔', hx(t.bg), hx(t.color), hx(t.border), t.radius, t.h, t.font].join(' · '), 12)
const chips = tally(all('chips'), (c) => [hx(c.bg), hx(c.color), c.h, c.font, c.transform].join(' · '), 16)
const inputs = tally(all('inputs'), (c) => [c.tag, hx(c.bg), hx(c.border), c.radius, c.h, c.font].join(' · '), 10)
const cards = tally(all('cards'), (c) => [hx(c.bg), hx(c.border), c.radius, c.pad, c.shadow === 'none' ? '그림자 없음' : hx(c.shadow)].join(' · '), 20)
const layers = tally(all('layers'), (l) => [l.pos, 'z ' + l.z, hx(l.bg), l.backdrop, l.shadow === 'none' ? '—' : hx(l.shadow), l.top !== 'auto' ? 'top ' + l.top : 'bottom ' + l.bottom, 'h ' + l.h].join(' · '), 16)
const shadows = tally(all('shadows'), (s) => hx(s.v), 14)
const hovers = tally(all('buttons').filter((b) => b.hover), (b) => [hx(b.bg), '→', hx(b.hover.bg), '| 글자', hx(b.color), '→', hx(b.hover.color), '| 변형', b.hover.transform === 'none' ? '—' : b.hover.transform, b.hover.deco !== 'none' ? '밑줄' : ''].join(' '), 16)

const row = (e) => `| ${e.k} | ${e.pages.size} | ${e.n} |`
const md = [
  '<!-- 생성물: scripts/design/extract-ui-kit.mjs — 손으로 고치지 말 것 -->',
  `# 참조 UI 부품 실측 (${results.length}개 템플릿 대표 페이지)`,
  '',
  '> 각 행 = 같은 모양 서명(계산 스타일, 색은 sRGB 근사). 「페이지」= 그 서명이 나온 페이지 수 · 「개수」= 요소 수.',
  '',
  '## 버튼 (바탕 · 글자 · 테두리 · 모서리 · 높이 · 서체 · 대소문자)', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...btn.map(row), '',
  '## 버튼 호버 (바탕 → · 글자 → · 변형)', '', '| 변화 | 페이지 | 개수 |', '|---|---|---|', ...hovers.map(row), '',
  '## 탭 role=tab (선택 여부 · 바탕 · 글자 · 밑줄 · 모서리 · 높이 · 서체 | 목록 틀)', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...tabs.map(row), '',
  '## 눌림 단추 aria-pressed (분절 · 필터)', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...pressed.map(row), '',
  '## 칩 · 배지', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...chips.map(row), '',
  '## 입력', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...inputs.map(row), '',
  '## 카드 (바탕 · 테두리 · 모서리 · 안여백 · 그림자)', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...cards.map(row), '',
  '## 층 — 고정 · 붙음 요소', '', '| 서명 | 페이지 | 개수 |', '|---|---|---|', ...layers.map(row), '',
  '## 그림자', '', '| 값 | 페이지 | 개수 |', '|---|---|---|', ...shadows.map(row), '',
]
fs.writeFileSync(OUT_MD, md.join('\n'))
fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedBy: 'scripts/design/extract-ui-kit.mjs', pages: results.length, btn, hovers, tabs, pressed, chips, inputs, cards, layers, shadows }, (k, v) => (v instanceof Set ? v.size : k === 'ex' ? undefined : v), 1))
console.log(path.relative(ROOT, OUT_MD))
