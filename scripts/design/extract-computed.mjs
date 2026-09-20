#!/usr/bin/env node
// scripts/design/extract-computed.mjs
//
// 참조 사이트의 **계산된 값**만 덤프한다(형용사 0 · 판정 0 · 이미지 0).
// 실물 우선 전환(DD-62) Stage 1 — 이 산출물이 Stage 2 복제의 유일한 입력이다.
//
//   node scripts/design/extract-computed.mjs                # 1440 + 375 둘 다
//   node scripts/design/extract-computed.mjs --url <URL>    # 다른 페이지
//   node scripts/design/extract-computed.mjs --out <dir>
//
// 산출: <out>/computed.json · <out>/computed-summary.md
// 참조 이미지는 저장하지 않는다 — 저장소에 남는 것은 수치뿐이다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, VIEWPORTS, chromium, openRef } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const URL_ = arg('--url', 'https://www.tines.com/')
const OUT = path.resolve(ROOT, arg('--out', 'docs/design/refs/tines'))

// 지시문의 `main > section` 은 이 사이트에서 0개다 — 띠(band)는 래퍼 div 의 직계 자식이라
// `section` 전부를 받고, 리듬은 아래 contentWrapper 의 직계 자식으로 잰다.
const SELECTORS = ['h1', 'h2', 'h3', 'p', 'a[href*="demo"]', 'button', 'header', 'nav', 'section']

// ── 페이지 안에서 도는 함수 ────────────────────────────────────────────────
function collect(selectors) {
  const PROPS = [
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
    'color', 'background-color', 'background-image', 'border-radius', 'box-shadow',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'display', 'grid-template-columns', 'gap', 'max-width', 'text-transform',
  ]
  const round = (n) => Math.round(n * 100) / 100

  // color(display-p3 r g b) → sRGB hex 근사 (P3 → XYZ D65 → sRGB, 클리핑)
  function p3ToHex(str) {
    // 음수 성분(sRGB 밖의 P3 색)도 받는다 — `[\d.]+` 만 쓰면 조용히 변환을 건너뛴다.
    const N = '(-?[\\d.]+)'
    const m = new RegExp(`color\\(display-p3\\s+${N}\\s+${N}\\s+${N}(?:\\s*/\\s*${N})?\\)`).exec(str)
    if (!m) return null
    const lin = (c) => {
      const s = c < 0 ? -1 : 1
      const a = Math.abs(c)
      return s * (a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4))
    }
    const [r, g, b] = [lin(+m[1]), lin(+m[2]), lin(+m[3])]
    const X = 0.4865709 * r + 0.2656677 * g + 0.1982173 * b
    const Y = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b
    const Z = 0.0 * r + 0.0451134 * g + 1.0439444 * b
    let R = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z
    let G = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z
    let B = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
    const enc = (c) => {
      c = Math.min(1, Math.max(0, c))
      c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
      return Math.round(c * 255)
    }
    const hex = (n) => n.toString(16).padStart(2, '0')
    return '#' + hex(enc(R)) + hex(enc(G)) + hex(enc(B))
  }
  function rgbToHex(str) {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(str)
    if (!m) return null
    const hex = (n) => Math.round(+n).toString(16).padStart(2, '0')
    return '#' + hex(m[1]) + hex(m[2]) + hex(m[3])
  }
  const norm = (v) => (typeof v === 'string' ? (p3ToHex(v) || rgbToHex(v) || v) : v)

  // 1. :root 커스텀 속성
  const rootVars = {}
  const rootCs = getComputedStyle(document.documentElement)
  for (let i = 0; i < rootCs.length; i++) {
    const name = rootCs[i]
    if (name.startsWith('--')) rootVars[name] = rootCs.getPropertyValue(name).trim()
  }
  // 동일 출처 스타일시트의 :root 규칙도 훑는다(위 열거가 비는 브라우저 대비)
  for (const sheet of Array.from(document.styleSheets)) {
    let rules
    try { rules = sheet.cssRules } catch { continue }
    if (!rules) continue
    for (const rule of Array.from(rules)) {
      if (!rule.selectorText || !/:root|^html$/.test(rule.selectorText)) continue
      for (let i = 0; i < rule.style.length; i++) {
        const n = rule.style[i]
        if (n.startsWith('--') && !(n in rootVars)) rootVars[n] = rule.style.getPropertyValue(n).trim()
      }
    }
  }

  // 색인 커스텀 속성은 sRGB hex 로도 적어 둔다 — Stage 3 ΔE2000 치환의 입력이다.
  const rootVarsHex = {}
  for (const [k, v] of Object.entries(rootVars)) {
    const hex = norm(v)
    if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) rootVarsHex[k] = hex
  }

  // 2. 선택자별 요소
  const elements = {}
  for (const sel of selectors) {
    const out = []
    let nodes = []
    try { nodes = Array.from(document.querySelectorAll(sel)) } catch { nodes = [] }
    for (const el of nodes.slice(0, 120)) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const cs = getComputedStyle(el)
      const style = {}
      for (const p of PROPS) {
        const v = cs.getPropertyValue(p)
        if (!v || v === 'none' || v === 'normal' || v === 'auto' || v === '0px' || v === 'rgba(0, 0, 0, 0)') continue
        style[p] = norm(v.trim())
      }
      out.push({
        text: (el.textContent || '').trim().slice(0, 60),
        rect: { x: round(r.x), y: round(r.y + window.scrollY), w: round(r.width), h: round(r.height) },
        style,
      })
    }
    elements[sel] = out
  }

  // 3. 리듬 — 섹션 간 세로 간격 · 컨테이너 최대 폭 · 격자 열 수
  // 띠(band)의 정의: main 안에서 전체 높이를 감싸는 가장 깊은 래퍼의 **직계 자식**.
  // `main > section` 같은 고정 선택자는 사이트마다 0개가 되므로 쓰지 않는다.
  const main = document.querySelector('main') || document.body
  let wrapper = main
  for (;;) {
    const kids = Array.from(wrapper.children).filter((el) => el.getBoundingClientRect().height > 0)
    if (kids.length !== 1) break
    if (kids[0].getBoundingClientRect().height < wrapper.getBoundingClientRect().height * 0.9) break
    wrapper = kids[0]
  }
  const wrapperPath = (() => {
    const parts = []
    let el = wrapper
    while (el && el !== document.body) {
      parts.unshift(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''))
      el = el.parentElement
    }
    return parts.join(' > ')
  })()
  // 래퍼의 직계 자식은 3개뿐이고 그 안에 여러 띠가 들어 있다(실측).
  // 띠 = 래퍼 안에서 **전폭이면서 다른 전폭 후보를 품지 않는** 가장 안쪽 블록.
  // 장식(canvas · svg · figure · img)과 흐름 밖 요소(absolute · fixed)는 띠가 아니다 — 음수 간격을 만든다.
  const BAND_TAGS = new Set(['div', 'section', 'header', 'footer', 'aside', 'article', 'main', 'nav', 'ul', 'ol'])
  const cands = Array.from(wrapper.querySelectorAll('*')).filter((el) => {
    if (!BAND_TAGS.has(el.tagName.toLowerCase())) return false
    const cs = getComputedStyle(el)
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') return false
    if (cs.display === 'inline' || cs.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width >= window.innerWidth - 24 && r.height >= 160
  })
  const bands = cands.filter((el) => !cands.some((o) => o !== el && el.contains(o)))
  const boxes = bands
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').trim().split(/\s+/)[0]?.slice(0, 44) || '',
        top: round(r.top + window.scrollY),
        bottom: round(r.bottom + window.scrollY),
        h: round(r.height),
        w: round(r.width),
      }
    })
    .filter((b) => b.h > 0)
    .sort((a, b) => a.top - b.top)
  // 겹치는 것이 남으면 앞선 띠 위에 얹힌 것이다 — 쌓임 순서만 남긴다(살아남은 띠 기준으로 비교).
  const stacked = []
  for (const b of boxes) {
    if (stacked.length && b.top < stacked[stacked.length - 1].bottom - 4) continue
    stacked.push(b)
  }
  const sectionGaps = []
  for (let i = 1; i < stacked.length; i++) sectionGaps.push(round(stacked[i].top - stacked[i - 1].bottom))

  // 컨테이너 폭: 블록 요소 폭의 빈도 — 뷰포트보다 좁고 400px 넘는 것만
  const widthFreq = {}
  for (const el of Array.from(document.querySelectorAll('div, section, header, footer, main, ul'))) {
    const r = el.getBoundingClientRect()
    const w = Math.round(r.width)
    // 375 에서 400px 하한을 쓰면 표가 통째로 빈다 — 뷰포트 비율로 잡는다.
    if (w < window.innerWidth * 0.4 || w >= window.innerWidth) continue
    widthFreq[w] = (widthFreq[w] || 0) + 1
  }
  const containerWidths = Object.entries(widthFreq)
    .map(([w, n]) => ({ width: +w, count: n }))
    .sort((a, b) => b.count - a.count || b.width - a.width)
    .slice(0, 8)

  // 격자: display:grid 인 요소의 열 수
  const gridFreq = {}
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const cs = getComputedStyle(el)
    if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue
    const cols = cs.gridTemplateColumns.trim()
    if (!cols || cols === 'none') continue
    // 배치되지 않은 요소는 `repeat(4, 1fr)` 처럼 지정값 그대로 나온다 — 풀어서 센다.
    const rep = /^repeat\(\s*(\d+)\s*,/.exec(cols)
    const n = rep ? +rep[1] : cols.split(/\s+(?![^(]*\))/).length
    const key = String(n)
    gridFreq[key] = gridFreq[key] || { columns: n, count: 0, samples: [] }
    gridFreq[key].count++
    if (gridFreq[key].samples.length < 3) gridFreq[key].samples.push({ template: cols.slice(0, 80), gap: cs.gap })
  }

  return {
    url: location.href,
    title: document.title,
    scrollHeight: document.documentElement.scrollHeight,
    rootVars,
    rootVarsHex,
    elements,
    rhythm: {
      wrapperPath,
      sectionCount: stacked.length,
      sectionBoxes: stacked,
      sectionGaps,
      containerWidths,
      grids: Object.values(gridFreq).sort((a, b) => b.count - a.count),
    },
  }
}

// ── 요약 마크다운 (값만) ───────────────────────────────────────────────────
function summarize(data) {
  const L = []
  const tag = (sel) => sel.replace(/\[.*/, '').replace(/ > /, '>')
  L.push('# Tines — computed values (Stage 1)')
  L.push('')
  L.push(`> 생성 \`scripts/design/extract-computed.mjs\` · ${new Date().toISOString().slice(0, 10)} · 출처 ${data['1440'].url}`)
  L.push('> **손으로 고치지 말 것** — 다음 실행에 덮어써진다. 형용사·판정은 이 파일에 적지 않는다(DD-62).')
  L.push('> 색은 사이트가 `color(display-p3 …)` 로 내보내므로 sRGB 근사 hex 로 환산했다.')
  L.push('')

  for (const vp of VIEWPORTS) {
    const d = data[vp.key]
    L.push(`## ${vp.width}×${vp.height}`)
    L.push('')

    L.push('### 타입 스케일')
    L.push('')
    L.push('| 선택자 | size | weight | line-height | letter-spacing | family | n |')
    L.push('|---|---|---|---|---|---|---|')
    for (const sel of ['h1', 'h2', 'h3', 'p', 'a[href*="demo"]', 'button']) {
      const items = d.elements[sel] || []
      const freq = new Map()
      for (const it of items) {
        const s = it.style
        const k = [
          s['font-size'] || '', s['font-weight'] || '', s['line-height'] || '', s['letter-spacing'] || '',
          (s['font-family'] || '').split(',')[0].replace(/["']/g, ''),
        ].join('|')
        freq.set(k, (freq.get(k) || 0) + 1)
      }
      for (const [k, n] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
        const [size, weight, lh, ls, fam] = k.split('|')
        L.push(`| \`${tag(sel)}\` | ${size || '—'} | ${weight || '—'} | ${lh || '—'} | ${ls || '—'} | ${fam || '—'} | ${n} |`)
      }
    }
    L.push('')

    L.push('### 간격 스케일')
    L.push('')
    L.push(`- 띠(band) 기준: \`${d.rhythm.wrapperPath}\` 안에서 전폭 · 흐름 안 · 다른 띠를 품지 않는 가장 안쪽 블록`)
    L.push(`- 띠 수: ${d.rhythm.sectionCount} — ${d.rhythm.sectionBoxes.map((b) => `${b.tag} ${b.h}`).join(' · ')}`)
    L.push(`- 띠 사이 세로 간격(px, 순서대로): ${d.rhythm.sectionGaps.join(' · ') || '—'}`)
    const pads = new Map()
    for (const sel of ['section', 'header']) {
      for (const it of d.elements[sel] || []) {
        const k = `${it.style['padding-top'] || '0px'} / ${it.style['padding-bottom'] || '0px'} / ${it.style['padding-left'] || '0px'}`
        pads.set(k, (pads.get(k) || 0) + 1)
      }
    }
    const padStr = [...pads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ×${n}`).join(' · ')
    L.push(`- 섹션 padding(top / bottom / left) 빈도: ${padStr || '—'}`)
    L.push('')

    L.push('### 컨테이너 폭')
    L.push('')
    L.push('| 폭(px) | 등장 |')
    L.push('|---|---|')
    for (const c of d.rhythm.containerWidths) L.push(`| ${c.width} | ${c.count} |`)
    L.push('')

    L.push('### 격자')
    L.push('')
    L.push('| 열 수 | 등장 | 예시 template | gap |')
    L.push('|---|---|---|---|')
    for (const g of d.rhythm.grids.slice(0, 8)) {
      L.push(`| ${g.columns} | ${g.count} | \`${g.samples[0]?.template || ''}\` | ${g.samples[0]?.gap || '—'} |`)
    }
    L.push('')

    const radii = new Map()
    const shadows = new Map()
    for (const items of Object.values(d.elements)) {
      for (const it of items) {
        if (it.style['border-radius']) radii.set(it.style['border-radius'], (radii.get(it.style['border-radius']) || 0) + 1)
        if (it.style['box-shadow']) shadows.set(it.style['box-shadow'], (shadows.get(it.style['box-shadow']) || 0) + 1)
      }
    }
    L.push('### 모서리 · 그림자')
    L.push('')
    L.push(`- border-radius: ${[...radii.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ×${n}`).join(' · ') || '0건'}`)
    L.push(`- box-shadow: ${[...shadows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} ×${n}`).join(' · ') || '**0건**'}`)
    L.push('')

    const colors = new Map()
    for (const items of Object.values(d.elements)) {
      for (const it of items) {
        for (const p of ['color', 'background-color']) {
          const v = it.style[p]
          if (!v) continue
          colors.set(`${p} ${v}`, (colors.get(`${p} ${v}`) || 0) + 1)
        }
      }
    }
    L.push('### 색 (측정된 요소 기준)')
    L.push('')
    L.push('| 속성 · 값 | 등장 |')
    L.push('|---|---|')
    for (const [k, n] of [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)) L.push(`| \`${k}\` | ${n} |`)
    L.push('')

    const vars = Object.entries(d.rootVars)
    L.push(`### \`:root\` 커스텀 속성 (${vars.length}개)`)
    L.push('')
    if (vars.length === 0) {
      L.push('없음 — 사이트가 `:root` 에 커스텀 속성을 두지 않는다.')
    } else {
      L.push(`색인 것 ${Object.keys(d.rootVarsHex).length}개는 sRGB 근사 hex 를 함께 적는다(Stage 3 ΔE2000 입력).`)
      L.push('')
      L.push('| 이름 | 값 | sRGB |')
      L.push('|---|---|---|')
      for (const [k, v] of vars.slice(0, 80)) L.push(`| \`${k}\` | \`${v.slice(0, 48)}\` | ${d.rootVarsHex[k] ? `\`${d.rootVarsHex[k]}\`` : '—'} |`)
      if (vars.length > 80) L.push(`| … | 나머지 ${vars.length - 80}개는 \`computed.json\` | |`)
    }
    L.push('')
  }
  return L.join('\n') + '\n'
}

// ── 실행 ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch()
const data = {}
for (const vp of VIEWPORTS) {
  const { ctx, page } = await openRef(browser, URL_, vp)
  data[vp.key] = { viewport: vp, ...(await page.evaluate(collect, SELECTORS)) }
  const n = Object.values(data[vp.key].elements).reduce((a, b) => a + b.length, 0)
  const r = data[vp.key].rhythm
  console.log(`${vp.key}: 띠 ${r.sectionCount}(${r.wrapperPath}) · :root 변수 ${Object.keys(data[vp.key].rootVars).length} · 요소 ${n}`)
  await ctx.close()
}
await browser.close()

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'computed.json'), JSON.stringify(data, null, 2) + '\n', 'utf8')
fs.writeFileSync(path.join(OUT, 'computed-summary.md'), summarize(data), 'utf8')
console.log(`\n${path.relative(ROOT, path.join(OUT, 'computed.json'))} · computed-summary.md`)
