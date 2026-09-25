#!/usr/bin/env node
// scripts/design/extract-app.mjs
//
// 참조 사이트의 **앱 UI 골격**을 잰다 (DD-62 Stage 1).
//
// 지시문은 `design-refs/tines/20260919/0031_platform-storyboard` 캡처를 **자로 재서** app-measured.json 을
// 만들라고 했다. 그 캡처는 이 저장소에 없다(참조 이미지는 커밋하지 않는다 — DD-47). 대신 같은 화면이
// `/stories/storyboard/` 히어로에 **DOM 으로** 들어 있다는 것을 확인했다 → 픽셀 추정 대신 getBoundingClientRect 로 잰다.
// 따라서 이 파일의 값은 "추정" 이 아니라 **실측**이다. 다만 대상은 실제 제품이 아니라 **마케팅 페이지의 앱 목업**이다 —
// 그 한계는 JSON 의 `caveats` 에 적는다.
//
//   node scripts/design/extract-app.mjs
//
// 산출: docs/design/refs/tines/app-measured.json

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, VIEWPORTS, chromium, openRef } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const URL_ = arg('--url', 'https://www.tines.com/stories/storyboard/')
const ANCHOR = arg('--anchor', '[class*="StoryboardHeroAppContent"]')
const OUT = path.resolve(ROOT, arg('--out', 'docs/design/refs/tines'))

function measure(anchorSel) {
  const round = (n) => Math.round(n * 100) / 100
  function p3ToHex(str) {
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
    const Z = 0.0451134 * g + 1.0439444 * b
    const enc = (c) => {
      c = Math.min(1, Math.max(0, c))
      c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
      return Math.round(c * 255)
    }
    const hx = (n) => n.toString(16).padStart(2, '0')
    return '#' + hx(enc(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z)) +
      hx(enc(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z)) +
      hx(enc(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z))
  }
  const rgbToHex = (s) => {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(s)
    if (!m) return null
    if (m[4] !== undefined && +m[4] === 0) return null // 투명
    const hx = (n) => Math.round(+n).toString(16).padStart(2, '0')
    return '#' + hx(m[1]) + hx(m[2]) + hx(m[3])
  }
  const hex = (s) => (s ? p3ToHex(s) || rgbToHex(s) : null)

  const anchor = document.querySelector(anchorSel)
  if (!anchor) return { error: `anchor 없음: ${anchorSel}` }

  // 앱 창 = anchor 의 조상 중 폭 900 이상이 되는 첫 상자.
  // 좁은 뷰포트에서는 900 에 영영 닿지 않아 body 까지 올라간다 — 뷰포트 폭과 main/body 에서 멈춘다.
  const STOP = new Set(['MAIN', 'BODY', 'HTML'])
  let frame = anchor
  while (
    frame.parentElement &&
    !STOP.has(frame.parentElement.tagName) &&
    frame.getBoundingClientRect().width < Math.min(900, window.innerWidth * 0.95)
  ) frame = frame.parentElement
  const fr = frame.getBoundingClientRect()

  // 칠해졌거나 테두리가 있는 상자만 모은다 — 골격을 만드는 것은 이것들이다.
  const boxes = []
  for (const el of Array.from(frame.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (['path', 'circle', 'rect', 'line', 'g', 'defs', 'clippath', 'polygon'].includes(tag)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 12 || r.height < 12) continue
    const cs = getComputedStyle(el)
    const bg = hex(cs.backgroundColor)
    const bw = parseFloat(cs.borderTopWidth) || 0
    if (!bg && bw === 0) continue
    boxes.push({
      tag,
      cls: String(el.className?.baseVal ?? el.className ?? '').replace(/-module-scss-module__[\w-]+/g, '').trim().slice(0, 40),
      x: round(r.left - fr.left), y: round(r.top - fr.top), w: round(r.width), h: round(r.height),
      bg, borderWidth: bw || undefined, borderColor: bw ? hex(cs.borderTopColor) : undefined,
      radius: cs.borderRadius === '0px' ? undefined : cs.borderRadius,
      shadow: cs.boxShadow === 'none' ? undefined : cs.boxShadow,
    })
  }
  boxes.sort((a, b) => b.w * b.h - a.w * a.h)

  // 파생: 상단 바 · 캔버스 · 좌우 패널
  const W = round(fr.width)
  const H = round(fr.height)
  // 상단 바는 배경이 투명하다(실측) — 칠 여부가 아니라 **자리**로 찾는다: frame 의 직계 자식 중 맨 위 전폭 띠.
  const topBar = Array.from(frame.children)
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { y: round(r.top - fr.top), w: round(r.width), h: round(r.height) }
    })
    .filter((b) => b.y <= 2 && b.w >= W * 0.6 && b.h > 8 && b.h < H * 0.25)
    .sort((a, b) => b.w - a.w)[0]
  const full = (b) => b.w >= W - 8
  const canvas = boxes.filter((b) => b.h >= H * 0.5 && b.w >= W * 0.5 && !full(b)).sort((a, b) => b.w * b.h - a.w * a.h)[0]
    || boxes.filter((b) => b.h >= H * 0.5).sort((a, b) => b.w * b.h - a.w * a.h)[0]
  const tall = boxes.filter((b) => b.h >= H * 0.4 && b !== canvas)
  // 왼쪽에는 둘이 있다(실측): 좁은 아이콘 레일과 그 옆의 목록 패널. 하나로 뭉뚱그리면 골격이 틀어진다.
  const lefts = tall.filter((b) => b.x < W * 0.3).sort((a, b) => a.x - b.x)
  const leftRail = lefts.find((b) => b.w < 80)
  const leftPanel = lefts.find((b) => b.w >= 80)
  // 우측 카드는 **캔버스가 끝난 뒤**에 서는 것만 — 캔버스 위에 떠 있는 카드를 고르면 gap 이 음수가 된다.
  const canvasRight = canvas ? canvas.x + canvas.w : W
  const rightPanel = boxes.filter((b) => b.x >= canvasRight - 4 && b.w >= 80 && b.w < W * 0.4)
    .sort((a, b) => b.h - a.h)[0]

  // 점 격자 (캔버스 바탕) — 클래스에 DotGrid 가 들어간 요소만. `[class*="Grid"]` 로 훑으면
  // 앱 컨테이너가 먼저 잡혀 background 가 none 으로 나온다.
  // 격자를 **실제로 그리는** 요소는 클래스에 dotGrid 가 붙은 상자가 아니라 그 안의 자식 레이어다(실측).
  // 이름으로 찾은 상자에서 멈추면 background-image 가 none 으로 나온다 — 칠을 가진 후손까지 내려간다.
  const gridHost = Array.from(frame.querySelectorAll('*'))
    .find((el) => /dotgrid/i.test(String(el.className?.baseVal ?? el.className ?? '')))
  let grid
  if (gridHost) {
    const painter = [gridHost, ...Array.from(gridHost.querySelectorAll('*'))]
      .find((el) => getComputedStyle(el).backgroundImage !== 'none') || gridHost
    const gcs = getComputedStyle(painter)
    const gr = painter.getBoundingClientRect()
    const img = gcs.backgroundImage
    // 타일은 data: URI 안의 SVG 다 — 타일 크기와 점 반지름·색을 꺼낸다.
    const svg = decodeURIComponent((/url\("data:image\/svg\+xml,([^"]+)"\)/.exec(img) || [])[1] || '')
    const attr = (n) => (new RegExp(`${n}\\s*=\\s*'([^']+)'`).exec(svg) || new RegExp(`${n}\\s*=\\s*"([^"]+)"`).exec(svg) || [])[1]
    grid = {
      hostCls: String(gridHost.className).replace(/-module-scss-module__[\w-]+/g, '').trim().slice(0, 40),
      painterCls: String(painter.className).replace(/-module-scss-module__[\w-]+/g, '').trim().slice(0, 40),
      rect: { x: round(gr.left - fr.left), y: round(gr.top - fr.top), w: round(gr.width), h: round(gr.height) },
      backgroundSize: gcs.backgroundSize,
      backgroundPosition: gcs.backgroundPosition,
      backgroundColor: hex(gcs.backgroundColor),
      tile: svg
        ? { width: attr('width'), height: attr('height'), dotRadius: attr('r'), fill: attr('fill') }
        : undefined,
      backgroundImage: img.slice(0, 240),
    }
  }

  // 노드(캔버스 위의 카드) = 모서리가 둥글고 캔버스 영역 안에 있는 중간 크기 상자
  const nodes = boxes
    .filter((b) => b.radius && b.w >= 60 && b.w <= W * 0.45 && b.h >= 40 && b !== leftPanel && b !== rightPanel)
    .slice(0, 12)
    .map(({ tag, cls, x, y, w, h, bg, radius, borderWidth, borderColor, shadow }) =>
      ({ tag, cls, x, y, w, h, bg, radius, borderWidth, borderColor, shadow }))

  // 글자 크기 — 앱 창 안에서 실제로 쓰인 것
  const fonts = {}
  for (const el of Array.from(frame.querySelectorAll('span, div, p, button, a'))) {
    if (!el.textContent?.trim() || el.children.length) continue
    const cs = getComputedStyle(el)
    const k = `${cs.fontSize}/${cs.fontWeight}`
    fonts[k] = (fonts[k] || 0) + 1
  }

  return {
    frame: { width: W, height: H, cls: String(frame.className).replace(/-module-scss-module__[\w-]+/g, '').trim().slice(0, 60) },
    derived: {
      topBarHeight: topBar ? topBar.h : null,
      canvas: canvas ? { x: canvas.x, y: canvas.y, w: canvas.w, h: canvas.h, bg: canvas.bg } : null,
      leftRailWidth: leftRail ? leftRail.w : null,
      leftRailInset: leftRail ? { x: leftRail.x, y: leftRail.y, radius: leftRail.radius } : null,
      leftPanelWidth: leftPanel ? leftPanel.w : null,
      leftPanelInset: leftPanel ? { x: leftPanel.x, y: leftPanel.y, radius: leftPanel.radius } : null,
      // 우측 인스펙터는 칠해진 상자가 아니라 캔버스가 끝난 뒤 남는 띠다.
      rightInspectorWidth: canvas ? round(W - (canvas.x + canvas.w)) : null,
      rightCardWidth: rightPanel ? rightPanel.w : null,
      rightCardInset: rightPanel ? { x: rightPanel.x, gapFromCanvas: canvas ? round(rightPanel.x - (canvas.x + canvas.w)) : null } : null,
      canvasInset: canvas ? { top: canvas.y, left: canvas.x, right: round(W - canvas.x - canvas.w), bottom: round(H - canvas.y - canvas.h) } : null,
    },
    grid,
    nodes,
    fontSizes: Object.entries(fonts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ size: k.split('/')[0], weight: k.split('/')[1], count: n })),
    boxes: boxes.slice(0, 40),
  }
}

const browser = await chromium.launch()
const out = {
  source: {
    url: URL_,
    anchor: ANCHOR,
    method: 'DOM getBoundingClientRect (playwright chromium)',
    measuredAt: new Date().toISOString().slice(0, 10),
    note: '지시문은 캡처를 자로 재라고 했으나 같은 화면이 DOM 으로 있어 실측했다 — 값은 추정이 아니다.',
  },
  caveats: [
    '대상은 실제 Tines 제품이 아니라 마케팅 페이지 히어로의 앱 목업이다.',
    '앱 창 자체가 페이지 폭에 따라 줄어든다 — 절대 px 이 아니라 창 폭 대비 비율로 읽는다(ratios).',
    '색은 사이트가 color(display-p3 …) 로 내보내므로 sRGB 근사 hex 다.',
  ],
  viewports: {},
}
for (const vp of VIEWPORTS) {
  const { ctx, page } = await openRef(browser, URL_, vp)
  const m = await page.evaluate(measure, ANCHOR)
  if (m.error) {
    out.viewports[vp.key] = { viewport: vp, ...m }
    console.log(`${vp.key}: ${m.error}`)
  } else {
    const W = m.frame.width
    const d = m.derived
    m.ratios = {
      topBarHeightOverFrameHeight: d.topBarHeight ? Math.round((d.topBarHeight / m.frame.height) * 1000) / 1000 : null,
      leftRailWidthOverFrameWidth: d.leftRailWidth ? Math.round((d.leftRailWidth / W) * 1000) / 1000 : null,
      leftPanelWidthOverFrameWidth: d.leftPanelWidth ? Math.round((d.leftPanelWidth / W) * 1000) / 1000 : null,
      rightInspectorOverFrameWidth: d.rightInspectorWidth ? Math.round((d.rightInspectorWidth / W) * 1000) / 1000 : null,
      canvasWidthOverFrameWidth: d.canvas ? Math.round((d.canvas.w / W) * 1000) / 1000 : null,
    }
    if (d.topBarHeight === null) {
      m.note = '이 뷰포트에서는 앱 창이 데스크톱과 다른 구성으로 접힌다(상단 바 없음) — 값을 데스크톱과 나란히 쓰지 않는다.'
    }
    out.viewports[vp.key] = { viewport: vp, ...m }
    console.log(`${vp.key}: 창 ${W}×${m.frame.height} · 상단바 ${d.topBarHeight} · 레일 ${d.leftRailWidth} · 좌패널 ${d.leftPanelWidth} · 캔버스 ${d.canvas?.w} · 우 ${d.rightInspectorWidth} · 노드 ${m.nodes.length}${m.note ? ' · ⚠ 접힘' : ''}`)
  }
  await ctx.close()
}
await browser.close()

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'app-measured.json'), JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`\n${path.relative(ROOT, path.join(OUT, 'app-measured.json'))}`)
