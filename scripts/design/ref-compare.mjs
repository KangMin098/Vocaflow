#!/usr/bin/env node
// scripts/design/ref-compare.mjs
//
// **참조 일치 게이트** — 우리 학습 지도의 기하를 참조 측정 명세(spec.json)와 숫자로 대조한다.
// 「참조와 같은 느낌」이라는 눈대중 보고를 막는 것이 목적이다: 완료 보고에는 이 표를 붙인다.
//
//   node --env-file=apps/web/.env.local scripts/design/ref-compare.mjs [--base http://localhost:3000] [--tol 2] [--shot out.png]
//
// 1) 참조 명세: docs/design/refs/3b/access-map/spec.json  (scripts/design/ref-measure.mjs 가 PNG 에서 잰 값)
// 2) 우리 값: 참조 캡처와 같은 뷰포트(2094×950, DPR 1)에서 /csat/diagnosis?tab=map 을 열어 DOM 사각형을 잰다
// 3) 항목마다 |차이| ≤ tol(px) 이면 통과. 하나라도 벗어나면 종료 코드 1.
// 로그인은 런타임 테스트 계정(PLAYWRIGHT_RUNTIME_EMAIL / _PASSWORD — 값은 env 에서만 읽고 출력하지 않는다).
// 서버는 이미 떠 있어야 한다(여러 세션이 공유하므로 여기서 띄우거나 죽이지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const BASE = arg('--base', process.env.CAPTURE_BASE_URL || 'http://localhost:3000')
const TOL = Number(arg('--tol', 2))
const shot = arg('--shot', null)

// 그리는 종류별 열 수(코드 core.ts LAYER_COLUMNS 와 같아야 한다 — 비어 있어도 열은 남는다)
const LAYERS = 5
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/access-map/spec.json'), 'utf8'))
const email = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) {
  console.error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — node --env-file=apps/web/.env.local 로 실행')
  process.exit(2)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: spec.image.w, height: spec.image.h }, deviceScaleFactor: 1 })
page.setDefaultTimeout(240_000)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', email)
await page.fill('input[type="password"]', password)
await page.keyboard.press('Enter')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })
// 기하는 전체 지도(상세 보기)에서 잰다 — 첫 화면은 핵심 요약(2026-10-03)
await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full`, { waitUntil: 'domcontentloaded' })
// v6.2 단일 지도(2026-10-14): 전체 펼침의 영역 열 · TASK 노드를 잰다. 옛 54라인 지도의 ⋯ 팝업 모달은 없어졌다(Inspector 는 모달이 아니다) — 모달 항목은 재지 않는다
await page.waitForSelector('[data-testid="umap-node"]')
await page.waitForTimeout(1500)

const ours = await page.evaluate(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
  }
  const nodes = [...document.querySelectorAll('[data-testid="umap-node"]')].map((el) => ({ code: el.getAttribute('data-node'), ...rect(el) }))
  const headEls = [...document.querySelectorAll('[data-testid="umap-domain"]')]
  // 열 머리 글자의 실제 왼쪽(Range) · 영역 열의 왼쪽 — 참조의 「머리 글자는 노드 열보다 일정하게 안쪽」을 잰다(spec.layout)
  const headText = headEls.map((el) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    return r.getBoundingClientRect().left + window.scrollX
  })
  const layerXs = [...document.querySelectorAll('section[data-domain]')].map((el) => el.getBoundingClientRect().left + window.scrollX)
  return { nodes, heads: headEls[0] ? rect(headEls[0]) : null, headText, layerXs }
})
const modal = { box: null, head: null, foot: null, cards: [] }
if (shot) await page.screenshot({ path: path.resolve(ROOT, shot), fullPage: false })
await browser.close()

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN)
const normal = ours.nodes
const colXs = [...new Set(normal.map((n) => Math.round(n.x)))].sort((a, b) => a - b)
const pitchX = colXs.length > 1 ? median(colXs.slice(1).map((x, i) => x - colXs[i])) : NaN
// 같은 열(라인 열)의 연속 노드 간격 — 같은 묶음 안에서만(묶음 사이 여백은 제외하려고 최빈 간격)
// 라인 열은 A1 이 있는 열 — 열 수가 바뀌어도(원리 · 트랙 열 제거) 순번에 기대지 않는다
const lineX = Math.round(normal.find((n) => n.code === 'r.reference')?.x ?? NaN)
const lineCol = normal.filter((n) => Math.round(n.x) === lineX).sort((a, b) => a.y - b.y)
const gaps = lineCol.slice(1).map((n, i) => Math.round(n.y - lineCol[i].y))
const mode = (xs) => {
  const m = new Map()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NaN
}
const firstLine = lineCol[0]
const rows = [
  ['노드 폭', spec.node.w, median(normal.map((n) => n.w))],
  ['노드 높이', spec.node.h, median(normal.map((n) => n.h))],
  ['열 피치', spec.columns.pitch ? 272 : spec.columns.pitch, pitchX],
  ['행 피치(같은 묶음)', spec.rows.pitch, mode(gaps)],
  ['머리 줄 높이', spec.panel?.headH ?? 49, ours.heads?.h ?? NaN],
  ['머리 줄 → 첫 노드', spec.panel?.firstGap ?? 25, firstLine && ours.heads ? firstLine.y - (ours.heads.y + ours.heads.h) : NaN],
]
if (spec.layout) {
  // 영역 열 머리와 그 열을 짝지어 잰다. 열 수는 참조(종류 5)와 다르게 영역 6 — 정본 v6.2 의 영역 수라 비교 항목에서 뺀다
  const offs = ours.layerXs.map((x, i) => ours.headText[i] - x)
  const hp = ours.headText.slice(1).map((x, i) => x - ours.headText[i])
  rows.push(
    ['열 머리 글자 → 노드 열', spec.layout.headerTextOffset, median(offs)],
    ['열 머리 피치', spec.layout.headerPitch, median(hp)],
  )
  void LAYERS
}
const m = spec.modal
if (m && modal.box && modal.head && modal.foot && modal.cards.length >= 2) {
  const [c0, c1] = modal.cards
  rows.push(
    ['모달 폭', m.w, modal.box.w],
    ['모달 높이', m.h, modal.box.h],
    ['모달 머리 높이', m.headH, modal.head.h],
    ['모달 바닥 높이', m.footH, modal.foot.h],
    ['카드 폭', m.cardW, c0.w],
    ['카드 사이 간격', m.cardGap, c1.y - (c0.y + c0.h)],
    ['머리 → 첫 카드', m.firstCardGap, c0.y - (modal.head.y + modal.head.h)],
  )
}
let fail = 0
console.log(`뷰포트 ${spec.image.w}×${spec.image.h} · 허용 ±${TOL}px\n`)
console.log('항목                    참조    우리    차이   판정')
for (const [name, ref, our] of rows) {
  const diff = our - ref
  const ok = Number.isFinite(diff) && Math.abs(diff) <= TOL
  if (!ok) fail++
  console.log(`${name.padEnd(18, '　').slice(0, 14).padEnd(22)}${String(ref).padStart(5)}  ${Number.isFinite(our) ? our.toFixed(1).padStart(6) : '   n/a'}  ${Number.isFinite(diff) ? diff.toFixed(1).padStart(6) : '   n/a'}   ${ok ? '통과' : '실패'}`)
}
console.log(fail === 0 ? '\n모든 항목이 참조 명세와 맞는다.' : `\n${fail}개 항목이 참조 명세에서 벗어났다.`)
process.exit(fail === 0 ? 0 : 1)
