#!/usr/bin/env node
// scripts/design/scene-illustrations.mjs
//
// **규격 L(장면) 삽화 생성기** — 1000 × 400 (DD-62 Stage 3 2회차 ③그림).
//
//   node scripts/design/scene-illustrations.mjs
//   node scripts/design/style-gate.mjs docs/design/illustrations/scene --ref docs/design/golden/illustrations
//
// 왜 손으로 안 그리고 생성하나: 03-system §3-9 의 값(모눈 24px · 선 2종 · 비례 60~85% · 액센트 ≤10%)은
// 좌표 산술이다. 손으로 찍으면 한 점씩 어긋나고, 어긋난 것은 스타일 게이트가 잡기 전에는 안 보인다.
//
// 개념은 **기호 사전의 기존 행**에서만 고른다(DD-25 조건 2 — 새 개념을 여기서 발명하지 않는다):
//   #19 서가가 차오른다 (서 · 안정도)  ·  #26 해마다의 기출 (시 · 시험지)
// 둘 다 사전에서 규격 B 였다. L 은 그 개념을 **띠 하나를 차지하는 장면**으로 키운 것이다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/ref-page.mjs'

const OUT = path.join(ROOT, 'docs/design/illustrations/scene')
const W = 1000
const H = 400
const CELL = 24

// ── 뼈대 ───────────────────────────────────────────────────────────────────
const round = (n) => Math.round(n * 100) / 100
const stage = (id) =>
  `<defs><pattern id="${id}" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">` +
  `<path d="M${CELL} 0H0V${CELL}" style="fill:none;stroke:var(--grid-line);stroke-width:1"/></pattern></defs>` +
  `<g data-layer="stage">` +
  `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" style="fill:var(--bg)"/>` +
  `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" style="fill:url(#${id});stroke:var(--bd);stroke-width:1"/>` +
  `</g>`

const OUTER = 'style="fill:var(--bg);stroke:var(--t1);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round" vector-effect="non-scaling-stroke"'
const INNER = (fill = 'none') =>
  `style="fill:${fill};stroke:var(--t1);stroke-width:1;stroke-linecap:round;stroke-linejoin:round" vector-effect="non-scaling-stroke"`
const RULE = 'style="fill:none;stroke:var(--bd);stroke-width:1" vector-effect="non-scaling-stroke"'
const mono = (x, y, t, anchor = 'middle', size = 12) =>
  `<text x="${round(x)}" y="${round(y)}" text-anchor="${anchor}" style="font-family:'JetBrains Mono',serif;font-size:${size}px;font-weight:400;fill:var(--t1)">${t}</text>`
const ko = (x, y, t, anchor = 'start', size = 14) =>
  `<text x="${round(x)}" y="${round(y)}" text-anchor="${anchor}" style="font-family:Hahmlet,serif;font-size:${size}px;font-weight:500;fill:var(--t1)">${t}</text>`

const svg = (id, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="illo " viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t">` +
  `<title id="${id}-t">${title}</title>${stage(`${id}-g`)}${body}</svg>\n`

// ── #19 서가가 차오른다 — 사다리 선반 4층, 아래 칸부터 책등이 찬다 ─────────
function shelfFills() {
  const X = 96
  const Y = 72
  const BW = 816 // 무대 폭의 81.6% — §3-9 비례 60~85%
  const BH = 264
  const ROWS = 4
  const rowH = BH / ROWS

  const main = [
    `<rect x="${X}" y="${Y}" width="${BW}" height="${BH}" rx="2" ${OUTER}/>`,
    ...[1, 2, 3].map((k) => {
      const y = Y + rowH * k
      return `<line x1="${X}" y1="${y}" x2="${X + BW}" y2="${y}" ${RULE}/>`
    }),
    `<line x1="${X + 72}" y1="${Y}" x2="${X + 72}" y2="${Y + BH}" ${RULE}/>`, // 눈금 칸(왼쪽 라벨 열)
  ].join('')

  // 아래 칸부터 찬다 — 칸마다 채운 비율(실측이 아니라 이 삽화가 말하는 관계다)
  const fillRatio = [0.94, 0.66, 0.37, 0.12] // row 0 = 맨 아래
  const LABELS = ['90', '30', '7', '1'] // 안정도(일) — 아래 칸이 가장 오래 버틴다
  const spines = []
  const frontier = []
  const shelfLeft = X + 72 + 16
  const shelfRight = X + BW - 16
  const span = shelfRight - shelfLeft
  let accent = ''

  for (let r = 0; r < ROWS; r++) {
    const bottom = Y + BH - rowH * r
    const top = bottom - rowH
    const spineTop = top + 14
    const spineBottom = bottom - 8
    // 라벨 — 왼쪽 눈금 칸
    spines.push(mono(X + 36, (top + bottom) / 2 + 4, LABELS[r]))

    let x = shelfLeft
    const limit = shelfLeft + span * fillRatio[r]
    let i = 0
    while (x + 16 <= limit) {
      const w = [20, 26, 16, 22][i % 4]
      if (x + w > limit) break
      const fill = i % 3 === 1 ? 'var(--bg2)' : 'var(--bg)'
      spines.push(`<rect x="${round(x)}" y="${round(spineTop)}" width="${w}" height="${round(spineBottom - spineTop)}" rx="2" ${INNER(fill)}/>`)
      x += w + 6
      i++
    }
    frontier.push({ x: round(x - 6), top: round(top), bottom: round(bottom) })
    // 액센트 — 이번 주 꽂힌 책등 한 권(맨 아래 칸의 마지막 권)에 권점 하나.
    // 칸 경계에 걸치면 어느 칸의 표식인지 읽히지 않는다 — 그 책등의 세로 한가운데에 놓는다.
    if (r === 0) {
      accent = `<circle cx="${round(x - 6 - 11)}" cy="${round((spineTop + spineBottom) / 2)}" r="5" style="fill:none;stroke:var(--ju);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`
    }
  }

  // 이야기 선 — 차오른 앞자락. **직각 계단**이다: 비스듬한 한 줄은 판면을 가로지르는 사선으로 읽히고
  // (§3-9 「직선·직각 우선」) 어느 칸이 얼마나 찼는지를 말하지 못한다.
  // 관계(근거→목적지)가 아니므로 주묵이 아니라 --t1 1px(§3-9 · DD-35).
  const pts = []
  for (let r = 0; r < frontier.length; r++) {
    const f = frontier[r]
    pts.push([f.x, f.bottom], [f.x, f.top])
    const next = frontier[r + 1]
    if (next) pts.push([next.x, f.top])
  }
  const story = `<polyline points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" ${INNER()}/>`

  return svg(
    'illo-19-shelf-fills',
    '서가가 차오른다 — 사다리 선반 네 칸, 아래 칸부터 책등이 찬다',
    `<g data-layer="main">${main}</g>` +
      `<g data-layer="minor">${spines.join('')}${ko(X + 8, Y - 14, '안정도(일)')}</g>` +
      `<g data-layer="story">${story}</g>` +
      `<g data-layer="accent">${accent}</g>`,
  )
}

// ── #26 해마다의 기출 — 시험지 묶음, 모서리가 부채꼴로 펼쳐진다 ────────────
function pastPapers() {
  // 축은 **왼쪽 가장자리 안쪽, 세로 한가운데**다.
  //   · 가운데를 축으로 돌리면 아래 모서리들이 무대 밖으로 나간다.
  //   · 왼쪽 아래 **모서리**를 축으로 두면 뒷장이 한쪽으로만 뻗어 쐐기가 된다 — 「묶음」이 아니라
  //     딴 물건으로 읽힌다(2026-09-20 2회차 1차 렌더 실측).
  //   · 왼쪽 안쪽을 축으로 두면 뒷장이 오른쪽에서 위아래로 고르게 삐져나와 「부채꼴로 펼쳐진 묶음」이 된다.
  const SX = 150
  const SY = 112
  const SW = 700 // 무대 폭의 70% — §3-9 비례 60~85%
  const SH = 228
  const PIVOT = [SX + 40, SY + SH / 2]
  const YEARS = ['2021', '2022', '2023', '2024', '2025', '2026']
  const MAX_DEG = -6 // 이 이상 돌리면 맨 뒷장 모서리가 무대 안 여백 1칸(24px)을 깬다
  const ANGLES = YEARS.map((_, i) => round((MAX_DEG * (YEARS.length - 1 - i)) / (YEARS.length - 1)))

  const at = (x, y, deg) => {
    const a = (deg * Math.PI) / 180
    const [px, py] = PIVOT
    return [
      round(px + (x - px) * Math.cos(a) - (y - py) * Math.sin(a)),
      round(py + (x - px) * Math.sin(a) + (y - py) * Math.cos(a)),
    ]
  }

  const sheets = []
  const labels = []
  const anchors = []
  for (let i = 0; i < YEARS.length; i++) {
    const front = i === YEARS.length - 1
    const fill = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'
    sheets.push(
      `<g transform="rotate(${ANGLES[i]} ${PIVOT[0]} ${PIVOT[1]})">` +
        `<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="2" ${front ? OUTER : INNER(fill)}/>` +
        (front
          ? [48, 84, 120, 156, 192]
              .map((dy) => `<line x1="${SX + 40}" y1="${SY + dy}" x2="${SX + SW - 200}" y2="${SY + dy}" ${RULE}/>`)
              .join('')
          : '') +
        `</g>`,
    )
    // 연도는 **회전 밖**에 가로로 적는다 — 장마다 삐져나온 폭이 18px 뿐이라 장 안에 적으면 앞장에 덮인다.
    const [cx, cy] = at(SX + SW, SY, ANGLES[i])
    anchors.push([cx, cy])
    labels.push(mono(cx + 10, cy + 5, YEARS[i], 'start', 13))
  }

  // 이야기 선 — 넘기는 자취(모서리 끝을 잇는다). 관계가 아니므로 --t1 1px.
  const story = `<polyline points="${anchors.map(([x, y]) => `${x},${y}`).join(' ')}" ${INNER()}/>`
  // 액센트 — 펼친 해의 도장 하나(맨 앞 장 머리)
  const stamp =
    `<rect x="${SX + SW - 128}" y="${SY + 36}" width="44" height="44" rx="2" style="fill:none;stroke:var(--ju);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`

  return svg(
    'illo-26-past-papers',
    '해마다의 기출 — 연도가 적힌 시험지 묶음을 넘긴다',
    `<g data-layer="main">${sheets.join('')}</g>` +
      `<g data-layer="minor">${labels.join('')}${ko(SX, SY - 28, '해마다의 기출')}</g>` +
      `<g data-layer="story">${story}</g>` +
      `<g data-layer="accent">${stamp}</g>`,
  )
}

fs.mkdirSync(OUT, { recursive: true })
const files = [
  ['illo-19-shelf-fills.svg', shelfFills()],
  ['illo-26-past-papers.svg', pastPapers()],
]
for (const [name, body] of files) {
  fs.writeFileSync(path.join(OUT, name), body, 'utf8')
  console.log(`${path.relative(ROOT, path.join(OUT, name)).split(path.sep).join('/')} · ${body.length}B`)
}
console.log('\n검사: node scripts/design/style-gate.mjs docs/design/illustrations/scene --ref docs/design/golden/illustrations')
