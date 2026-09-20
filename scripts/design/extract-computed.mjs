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
  // ⚠️ norm() 은 `rgba(0,0,0,0)` 을 `#000000` 으로 바꾼다 — 투명인지는 **변환 전 문자열**로 묻는다.
  const isTransparent = (s) => {
    if (!s || s === 'transparent') return true
    const m = /^rgba?\([^)]*?,\s*([\d.]+)\s*\)$/.exec(s)
    return !!m && +m[1] === 0
  }
  const bgOf = (cs) => (isTransparent(cs.backgroundColor) ? undefined : norm(cs.backgroundColor))

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
  // 띠는 페이지의 **세로 분할**이어야 한다. "가장 안쪽 전폭 블록" 으로 잡으면 띠 사이에 틈이 생기고
  // (실측: 1440 에서 477px) 그 틈에 있던 히어로 비주얼이 통째로 빠진다 — 복제에 흰 구멍이 남는다.
  // 그래서 위에서부터 **겹치지 않게 덮어 나가며** 각 자리에서 가장 바깥/가장 큰 블록을 고른다.
  const BAND_TAGS = new Set(['div', 'section', 'header', 'footer', 'aside', 'article', 'main', 'nav', 'ul', 'ol'])
  const cands = Array.from(wrapper.querySelectorAll('*')).filter((el) => {
    if (!BAND_TAGS.has(el.tagName.toLowerCase())) return false
    const cs = getComputedStyle(el)
    if (cs.display === 'inline' || cs.display === 'none') return false
    if (cs.visibility === 'hidden') return false
    const r = el.getBoundingClientRect()
    return r.width >= window.innerWidth * 0.6 && r.height >= 100
  })
  cands.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    return ra.top - rb.top || rb.height - ra.height
  })
  const coverBands = []
  let cursor = -Infinity
  for (const el of cands) {
    const r = el.getBoundingClientRect()
    const top = r.top + window.scrollY
    if (top < cursor - 8) continue // 이미 덮인 자리 — 바깥 띠가 이 요소를 품고 있다
    coverBands.push(el)
    cursor = r.bottom + window.scrollY
  }

  // 리듬용 띠는 **다른 것**이다. 덮기용(coverBands)은 틈을 남기지 않는 대신 바깥 블록을 고르므로
  // 섹션 사이 간격이 사라진다. 간격을 재려면 전폭 · 흐름 안 · 가장 안쪽 블록이어야 한다.
  // 두 목록을 하나로 합치려다 2026-09-20 에 리듬(156·96)을 통째로 잃었다 — 나누어 둔다.
  const rhythmCands = cands.filter((el) => {
    const cs = getComputedStyle(el)
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') return false
    const r = el.getBoundingClientRect()
    return r.width >= window.innerWidth - 24 && r.height >= 160
  })
  const bands = rhythmCands.filter((el) => !rhythmCands.some((o) => o !== el && el.contains(o)))
  const boxes = bands
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        el, // 청사진에서 다시 찾아 들어가야 한다 — 직렬화 전에 뗀다.
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').trim().split(/\s+/)[0]?.slice(0, 44) || '',
        bg: bgOf(getComputedStyle(el)),
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

  // 4. 청사진 — 띠마다 그 안의 **눈에 보이는 상자**를 띠 기준 좌표로.
  //
  // 왜 필요한가: 선택자별 덤프(elements)에는 "무엇이 어디에 있는가"가 없다. 그것 없이 복제를 쓰면
  // 사람이 눈으로 보고 JSX 를 옮겨 적게 되고, 그 순간 복제는 생성물이 아니라 손글씨가 된다(DD-62 ②).
  // 청사진이 있으면 복제 화면은 이 배열을 **그리기만** 한다 — 추출을 다시 돌리면 복제도 따라온다.
  const ROLE_TAGS = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h3', p: 'p', img: 'img', svg: 'svg', video: 'video', canvas: 'canvas', button: 'button', a: 'a' }
  const bandOf = (bandEl, bi) => {
    const r0 = bandEl.getBoundingClientRect()
    const band = {
      tag: bandEl.tagName.toLowerCase(),
      cls: String(bandEl.className || '').trim().split(/\s+/)[0]?.slice(0, 44) || '',
      bg: bgOf(getComputedStyle(bandEl)),
      top: round(r0.top + window.scrollY),
      left: round(r0.left),
      w: round(r0.width),
      h: round(r0.height),
    }
    const children = []
    {
      const br = bandEl.getBoundingClientRect()
      for (const el of Array.from(bandEl.querySelectorAll('*'))) {
        const tag = el.tagName.toLowerCase()
        if (['script', 'style', 'path', 'g', 'defs', 'clippath', 'use', 'circle', 'rect', 'line', 'polygon', 'stop', 'lineargradient'].includes(tag)) continue
        // svg 안쪽은 건너뛴다 — svg 하나를 통째로 자리로 잡는다.
        if (el.closest('svg') && tag !== 'svg') continue
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue

        const isMedia = ['img', 'svg', 'video', 'canvas', 'picture'].includes(tag)
        const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
        // ⚠️ norm() 은 `rgba(0,0,0,0)` 을 `#000000` 으로 바꾼다 — 투명 판정은 **변환 전 문자열**로 해야 한다.
        //    안 그러면 모든 요소가 "칠해짐" 이 되어 청사진이 수천 개로 부푼다.
        const painted = !isTransparent(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) || 0) > 0
        if (!isMedia && !ownText && !(painted && r.width >= 24 && r.height >= 24)) continue

        const text = (el.textContent || '').trim()
        children.push({
          role: ROLE_TAGS[tag] || (isMedia ? 'media' : ownText ? 'text' : 'box'),
          tag,
          x: round(r.left - br.left), y: round(r.top - br.top), w: round(r.width), h: round(r.height),
          textLen: ownText ? text.length : 0,
          text: ownText ? text.slice(0, 40) : undefined,
          fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing === 'normal' ? undefined : cs.letterSpacing,
          textAlign: cs.textAlign === 'start' ? undefined : cs.textAlign,
          color: ownText ? norm(cs.color) : undefined,
          bg: bgOf(cs),
          radius: cs.borderRadius === '0px' ? undefined : cs.borderRadius,
          border: (parseFloat(cs.borderTopWidth) || 0) > 0 ? `${cs.borderTopWidth} solid ${norm(cs.borderTopColor)}` : undefined,
        })
        if (children.length >= 400) break
      }
    }
    // 겹치는 상자는 바깥 것을 남기고 뺀다 — 같은 글자를 두 번 그리면 diff 가 커진다.
    const kept = children.filter((c, i) => !children.some((o, j) =>
      j < i && o.role !== 'box' && c.role !== 'box' &&
      o.x <= c.x + 1 && o.y <= c.y + 1 && o.x + o.w >= c.x + c.w - 1 && o.y + o.h >= c.y + c.h - 1 &&
      o.textLen > 0 && c.textLen > 0))
    return { index: bi, tag: band.tag, cls: band.cls, bg: band.bg, top: band.top, left: band.left, w: band.w, h: band.h, children: kept }
  }
  const blueprint = coverBands.map(bandOf)
  // 직렬화 전에 DOM 참조를 뗀다 — 남기면 page.evaluate 가 구조화 복제에서 죽는다.
  for (const b of stacked) delete b.el

  // 페이지 바탕과 머리·바닥띠 — `main` 밖이라 띠 목록에 없는데 화면의 큰 몫을 칠한다.
  // 이게 없으면 복제가 흰 바탕이 되어 픽셀 차이의 큰 몫이 배경에서 나온다(실측 1440: 42.7% → 1.35%).
  const pageBg = bgOf(getComputedStyle(document.body)) || bgOf(getComputedStyle(document.documentElement))
  const chrome = ['header', 'footer']
    .map((sel, i) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      return { part: sel, position: getComputedStyle(el).position, ...bandOf(el, i) }
    })
    .filter(Boolean)

  return {
    url: location.href,
    title: document.title,
    scrollHeight: document.documentElement.scrollHeight,
    pageBg,
    chrome,
    rootVars,
    rootVarsHex,
    blueprint,
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
