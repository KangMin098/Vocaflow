#!/usr/bin/env node
// scripts/design/workspace-skeleton.mjs
//
// **워크스페이스 화면의 골격을 잰다 — 참조든 우리 것이든 같은 자로.**
//
// ── 왜 새로 만드나 ────────────────────────────────────────────────────
// `extract-app.mjs` 는 Tines 마케팅 페이지의 히어로 목업 전용이다(앵커 클래스
// `StoryboardHeroAppContent` 를 안다). 3B 워크스페이스는 **클래스 이름을 모르고**, 인증이 걸려
// 크롤링도 못 한다. 그래서 이 자는 **이름이 아니라 기하(幾何)로** 역할을 찾는다:
//
//   상단 막대 = y≈0 · 폭 ≈ 화면 · 높이 32~88
//   왼쪽 레일 = x≈0 · 높이 ≥ 본문의 60% · 폭 220~560
//   탭 줄     = 본문 맨 위 · 높이 28~64 · 버튼/링크 3개 이상
//   판(pane)  = 본문 안에서 y·h 가 비슷하고 폭 ≥ 200 인 형제 상자들
//   바닥 카드 = 본문 아래 18% 안 · 높이가 서로 비슷한 상자 2개 이상
//
// 규칙이 틀리면 `--dump` 로 상자를 전부 뽑아 눈으로 보고 규칙을 고친다 —
// 「규칙이 정당한 것을 걸면 규칙을 고친다」(AGENTS).
//
// ── 무엇을 재나 ──────────────────────────────────────────────────────
// 상자마다 위치·크기 + 계산된 배경·테두리·모서리·그림자 + 글자(크기·굵기·행간·자간·색).
// 그리고 화면 전체의 **글자 크기 히스토그램**과 **색 히스토그램** — 이 둘이 판면의 «체감»을
// 가장 많이 정한다(간격보다 먼저 맞춰야 한다).
//
// ── 쓰는 법 ──────────────────────────────────────────────────────────
//   # ① 참조 — 저장한 페이지(Ctrl+S 「웹페이지, 전체」)에서
//   node scripts/design/workspace-skeleton.mjs extract \
//     --url "file:///D:/refs/3b/workspace.html" --label ref --out docs/design/refs/3b
//
//   # ①' 참조 — 로그인 상태 파일이 있으면 실물에서 (더 정확: 호버·전환까지 같은 조건)
//   node scripts/design/workspace-skeleton.mjs extract \
//     --url https://neon-currant.3b.dev/spaces/.../workflows/... --state <storageState.json> \
//     --label ref --out docs/design/refs/3b
//
//   # ② 우리 화면
//   node scripts/design/workspace-skeleton.mjs extract \
//     --url http://localhost:3000/csat/item/M2706-19 --state <ours.json> \
//     --label ours --out docs/design/refs/3b
//
//   # ③ 대조 — 역할마다 차이를 표로. 허용치를 넘으면 exit 1
//   node scripts/design/workspace-skeleton.mjs diff --dir docs/design/refs/3b
//
// 재실행 안전: 읽기만 한다(산출 JSON 만 덮어쓴다). 캡처 이미지는 만들지 않는다.

import fs from 'node:fs'
import path from 'node:path'

import { ROOT, chromium, settle } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0]
const has = (k) => argv.includes(k)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const VIEWPORT = (() => {
  const m = /^(\d+)x(\d+)$/.exec(arg('--viewport', '1600x1000'))
  return m ? { width: +m[1], height: +m[2] } : { width: 1600, height: 1000 }
})()

// ── 브라우저 안에서 도는 측정기 ────────────────────────────────────────
// 문자열로 넘어가므로 바깥 스코프를 쓰지 않는다.
function measureSkeleton() {
  const round = (n) => Math.round(n * 10) / 10
  const rgbToHex = (s) => {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(s || '')
    if (!m) return null
    if (m[4] !== undefined && Number(m[4]) === 0) return null
    const hx = (n) => Math.round(Number(n)).toString(16).padStart(2, '0')
    return '#' + hx(m[1]) + hx(m[2]) + hx(m[3])
  }
  const vw = window.innerWidth
  const vh = window.innerHeight

  /** 눈에 보이고 자리를 차지하는 상자만 — 0px·숨김·화면 밖은 뺀다. */
  const boxes = []
  const typeHist = new Map()
  const colorHist = new Map()
  const all = document.querySelectorAll('*')
  for (const el of all) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) continue
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue

    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()

    if (ownText) {
      const key = `${Math.round(parseFloat(cs.fontSize))}/${cs.fontWeight}`
      typeHist.set(key, (typeHist.get(key) ?? 0) + 1)
      const fg = rgbToHex(cs.color)
      if (fg) colorHist.set('text ' + fg, (colorHist.get('text ' + fg) ?? 0) + 1)
    }
    const bg = rgbToHex(cs.backgroundColor)
    if (bg && r.width * r.height > 400) colorHist.set('fill ' + bg, (colorHist.get('fill ' + bg) ?? 0) + 1)

    boxes.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 60),
      role: el.getAttribute('role') || null,
      x: round(r.x),
      y: round(r.y),
      w: round(r.width),
      h: round(r.height),
      bg,
      border: cs.borderTopWidth === '0px' ? null : `${cs.borderTopWidth} ${rgbToHex(cs.borderTopColor) ?? cs.borderTopColor}`,
      radius: cs.borderTopLeftRadius === '0px' ? null : cs.borderTopLeftRadius,
      shadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 80),
      pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      gap: cs.gap === 'normal' ? null : cs.gap,
      flow: cs.display.includes('flex') || cs.display.includes('grid') ? `${cs.display}:${cs.flexDirection}` : null,
      font: ownText ? `${Math.round(parseFloat(cs.fontSize))}/${cs.fontWeight}/${cs.lineHeight}/${cs.letterSpacing}` : null,
      fg: ownText ? rgbToHex(cs.color) : null,
      textLen: ownText.length,
      text: ownText.length <= 40 ? ownText : null,
      depth: (() => {
        let d = 0
        for (let p = el.parentElement; p; p = p.parentElement) d += 1
        return d
      })(),
    })
  }

  // ── 역할 찾기 — 기하로만 ────────────────────────────────────────────
  const near = (a, b, t) => Math.abs(a - b) <= t
  const full = boxes.filter((b) => near(b.w, vw, 24))

  const topBar =
    full.filter((b) => b.y <= 2 && b.h >= 32 && b.h <= 88).sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null
  const bodyTop = topBar ? topBar.y + topBar.h : 0

  const rail =
    boxes
      .filter((b) => b.x <= 2 && b.y >= bodyTop - 2 && b.w >= 220 && b.w <= 560 && b.h >= (vh - bodyTop) * 0.6)
      .sort((a, b) => b.h - a.h)[0] ?? null

  const mainX = rail ? rail.x + rail.w : 0
  const mainW = vw - mainX

  // 탭 줄 — 본문 폭을 가득 채우는 **가장 위의 낮은 상자**.
  // ⚠️ 「상단 막대 바로 아래」로 좁히면 안 된다 — 화면이 제 상단 막대를 하나 더 갖는 경우(우리 극장)
  //    탭 줄은 그보다 아래에 있다. 실측 2026-09-23: 우리 화면 tabBar.y = 119, bodyTop = 65.
  const tabBar =
    boxes
      .filter((b) => near(b.x, mainX, 8) && near(b.w, mainW, 24) && b.y > bodyTop && b.h >= 28 && b.h <= 64)
      .sort((a, b) => a.y - b.y)[0] ?? null

  // 바닥 카드 줄 — 아래 25% 안에서 높이가 비슷한 형제 2개 이상.
  // **카드를 먼저 찾고 그 윗선을 본문 바닥으로 삼는다** — 바닥을 고정 비율로 잡으면 판이 그 선을
  //    넘어가 통째로 빠진다(실측: 판 바닥 906.5 vs 고정선 820).
  const cardish = boxes.filter(
    (b) => b.y >= vh * 0.75 && b.x >= mainX - 4 && b.w >= 80 && b.w <= mainW * 0.5 && b.h >= 32 && b.h <= 120,
  )
  const byHeight = new Map()
  for (const b of cardish) {
    const k = Math.round(b.h / 4) * 4
    byHeight.set(k, [...(byHeight.get(k) ?? []), b])
  }
  const cards = ([...byHeight.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length)[0] ?? [])
  const bottomZone = cards.length ? Math.min(...cards.map((c) => c.y)) : vh * 0.86

  // 판 — 본문 안에서 y·h 가 같은 띠에 있는 형제들
  const paneZone = boxes.filter(
    (b) =>
      b.x >= mainX - 4 &&
      b.w >= 200 &&
      b.h >= 160 &&
      b.y > (tabBar ? tabBar.y + tabBar.h : bodyTop) - 4 &&
      b.y + b.h <= bottomZone + 24,
  )
  const byBand = new Map()
  for (const b of paneZone) {
    const k = `${Math.round(b.y / 12)}:${Math.round(b.h / 24)}`
    byBand.set(k, [...(byBand.get(k) ?? []), b])
  }
  // 같은 띠 안에는 **감싸는 상자와 감싸인 판이 함께** 들어온다(래퍼 1 + 판 2).
  // 폭·위치로 가르려 하면 실패한다 — 깊이로 가른다: 2개 이상인 깊이 중 가장 많은 것, 같으면 더 깊은 것.
  // ⚠️ 띠를 «가장 높은 것» 으로 먼저 고르면 안 된다 — 한 개짜리 래퍼 띠(view)가 판 띠보다
  //    몇 px 높아 그 자리를 빼앗는다(실측: view h716.2 vs 판 h702.2 → 판 0개).
  const bandPanes = (group) => {
    const byDepth = new Map()
    for (const b of group) byDepth.set(b.depth, [...(byDepth.get(b.depth) ?? []), b])
    return (
      [...byDepth.entries()]
        .filter(([, g]) => g.length >= 2)
        .sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0]?.[1] ?? []
    )
  }
  const panes = ([...byBand.values()]
    .map(bandPanes)
    .filter((g) => g.length >= 2)
    .sort((a, b) => b[0].h - a[0].h)[0] ?? []
  ).sort((a, b) => a.x - b.x)

  const pick = (b) =>
    b && {
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      bg: b.bg,
      border: b.border,
      radius: b.radius,
      pad: b.pad,
      gap: b.gap,
    }

  return {
    viewport: { width: vw, height: vh },
    derived: {
      topBarH: topBar ? topBar.h : null,
      railW: rail ? rail.w : null,
      railH: rail ? rail.h : null,
      tabBarH: tabBar ? tabBar.h : null,
      mainX,
      mainW,
      paneCount: panes.length,
      paneGap: panes.length >= 2 ? Math.round((panes[1].x - (panes[0].x + panes[0].w)) * 10) / 10 : null,
      paneWidths: panes.map((p) => p.w),
      paneRadius: panes[0]?.radius ?? null,
      cardCount: cards.length,
      cardH: cards[0]?.h ?? null,
      cardW: cards[0]?.w ?? null,
      cardGap:
        cards.length >= 2
          ? Math.round(
              ([...cards].sort((a, b) => a.x - b.x)[1].x - ([...cards].sort((a, b) => a.x - b.x)[0].x + cards[0].w)) * 10,
            ) / 10
          : null,
    },
    parts: {
      topBar: pick(topBar),
      rail: pick(rail),
      tabBar: pick(tabBar),
      panes: panes.map(pick),
      cards: [...cards].sort((a, b) => a.x - b.x).map(pick),
    },
    type: [...typeHist].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, n]) => ({ size: k, n })),
    palette: [...colorHist].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, n]) => ({ color: k, n })),
    boxCount: boxes.length,
    boxes,
  }
}

async function extract() {
  const url = arg('--url')
  if (!url) throw new Error('--url 이 필요하다 (http(s):// 또는 file:///…/saved.html)')
  const label = arg('--label', 'ref')
  const outDir = path.resolve(ROOT, arg('--out', 'docs/design/refs/3b'))
  const statePath = arg('--state')

  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    ...(statePath ? { storageState: path.resolve(statePath) } : {}),
  })
  const page = await ctx.newPage()
  // 우리 앱은 번들에 __name 을 기대하는 빌드가 있다(다른 캡처 스크립트와 같은 완화)
  await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f)')
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
  await settle(page).catch(() => {})
  await page.waitForTimeout(800)
  await page.evaluate(() => window.scrollTo(0, 0))

  const result = await page.evaluate(measureSkeleton)
  await browser.close()

  const { boxes, ...summary } = result
  fs.mkdirSync(outDir, { recursive: true })
  const stem = `${label}-${VIEWPORT.width}x${VIEWPORT.height}`
  fs.writeFileSync(
    path.join(outDir, `${stem}.json`),
    JSON.stringify({ source: { url: url.startsWith('file://') ? '(로컬 저장본)' : url, measuredAt: new Date().toISOString().slice(0, 10) }, ...summary }, null, 1),
  )
  if (has('--dump')) {
    fs.writeFileSync(path.join(outDir, `${stem}.boxes.json`), JSON.stringify(boxes, null, 1))
  }

  console.log(`→ ${path.relative(ROOT, path.join(outDir, `${stem}.json`))}  (상자 ${result.boxCount})`)
  console.log('  ' + JSON.stringify(summary.derived))
  if (!summary.derived.railW) console.log('  ⚠ 레일을 못 찾았다 — --dump 로 상자를 보고 규칙을 고칠 것')
}

// ── 대조 ──────────────────────────────────────────────────────────────
const FIELDS = [
  ['topBarH', '상단 막대 높이', 6],
  ['railW', '왼쪽 레일 폭', 10],
  ['tabBarH', '탭 줄 높이', 6],
  ['paneCount', '판 개수', 0],
  ['paneGap', '판 사이 간격', 6],
  ['paneRadius', '판 모서리', null],
  ['cardCount', '바닥 카드 수', null],
  ['cardH', '카드 높이', 8],
  ['cardGap', '카드 간격', 4],
]

function diff() {
  const dir = path.resolve(ROOT, arg('--dir', 'docs/design/refs/3b'))
  const stem = `${VIEWPORT.width}x${VIEWPORT.height}`
  const load = (label) => {
    const p = path.join(dir, `${label}-${stem}.json`)
    if (!fs.existsSync(p)) throw new Error(`${path.relative(ROOT, p)} 가 없다 — extract 를 먼저 돌린다`)
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  }
  const ref = load('ref')
  const ours = load('ours')

  let fails = 0
  console.log(`\n골격 대조 · ${stem}\n`)
  console.log('  항목                 참조        우리        차이')
  console.log('  ' + '─'.repeat(52))
  for (const [key, name, tol] of FIELDS) {
    const a = ref.derived[key]
    const b = ours.derived[key]
    const numeric = typeof a === 'number' && typeof b === 'number'
    const d = numeric ? Math.round((b - a) * 10) / 10 : a === b ? 0 : null
    const bad = tol == null ? a !== b : numeric ? Math.abs(d) > tol : a !== b
    if (bad) fails += 1
    const f = (v) => String(v ?? '—').padEnd(11)
    console.log(`  ${name.padEnd(20)}${f(a)}${f(b)}${d == null ? '다름' : d > 0 ? '+' + d : String(d)}${bad ? '  ✗' : ''}`)
  }

  const typeOf = (j) => new Map(j.type.map((t) => [t.size, t.n]))
  const rt = typeOf(ref)
  const ot = typeOf(ours)
  const missing = [...rt.keys()].filter((k) => !ot.has(k)).slice(0, 8)
  const extra = [...ot.keys()].filter((k) => !rt.has(k)).slice(0, 8)
  console.log('\n  글자 계층(크기/굵기 · 빈도순)')
  console.log('    참조 ' + ref.type.slice(0, 8).map((t) => `${t.size}×${t.n}`).join('  '))
  console.log('    우리 ' + ours.type.slice(0, 8).map((t) => `${t.size}×${t.n}`).join('  '))
  if (missing.length) console.log('    참조에만: ' + missing.join(' '))
  if (extra.length) console.log('    우리에만: ' + extra.join(' '))

  console.log('\n  면 색(빈도순)')
  console.log('    참조 ' + ref.palette.slice(0, 6).map((p) => `${p.color}×${p.n}`).join('  '))
  console.log('    우리 ' + ours.palette.slice(0, 6).map((p) => `${p.color}×${p.n}`).join('  '))

  console.log(`\n  어긋난 항목 ${fails} / ${FIELDS.length}\n`)
  if (fails > 0) process.exitCode = 1
}

try {
  if (cmd === 'extract') await extract()
  else if (cmd === 'diff') diff()
  else {
    console.log('쓰는 법: workspace-skeleton.mjs extract --url <…> [--state <…>] [--label ref|ours] [--dump]')
    console.log('         workspace-skeleton.mjs diff [--dir docs/design/refs/3b] [--viewport 1600x1000]')
    process.exitCode = 2
  }
} catch (e) {
  console.error('✗ ' + (e instanceof Error ? e.message : String(e)))
  process.exitCode = 1
}
