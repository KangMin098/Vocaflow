#!/usr/bin/env node
// scripts/design/ref-measure.mjs
//
// 참조 **스크린샷(PNG)** 에서 카드(노드) 사각형을 픽셀 단위로 잰다 — 눈대중 대신 숫자로 맞추기 위한 도구.
// 인증이 걸린 참조 앱(3B)은 에이전트가 열 수 없어 DOM 계산값을 못 얻는다. 그때의 차선책이 이 측정이다
// (정확한 계산값이 필요하면 docs/design/refs/3b/CAPTURE.md 의 「웹페이지, 전체」 저장 → extract-computed).
//
//   node scripts/design/ref-measure.mjs <참조.png> [--out spec.json] [--min-w 120 --max-w 420 --min-h 30 --max-h 110]
//                                       [--color fbf9f7 --tol 1]   # 찾을 면 색(기본 흰색 ≥254) — 모달 안 카드 등 옅은 면을 잴 때
//
// 원리: 판 바탕(#faf9f8 근처)과 카드 면(#fff)은 색이 몇 단계 다르다. 흰 픽셀의 연결 성분을 찾아 카드 크기의
// 사각형만 남긴다(글자 · 아이콘은 구멍이라 성분을 끊지 않는다). 그 사각형에서 노드 폭 · 높이 · 열 간격 · 행 간격을 구한다.
// 산출은 숫자뿐이다 — 스크린샷 자체는 저장소에 두되(작다) 판단은 숫자로 한다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--'))
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
if (!file) {
  console.error('사용: node scripts/design/ref-measure.mjs <참조.png> [--out spec.json]')
  process.exit(1)
}
const lim = { minW: +arg('--min-w', 120), maxW: +arg('--max-w', 420), minH: +arg('--min-h', 30), maxH: +arg('--max-h', 110) }
const colorHex = arg('--color', null)
const target = colorHex ? [0, 2, 4].map((i) => parseInt(colorHex.slice(i, i + 2), 16)) : null
const tolerance = +arg('--tol', 1)
const png = fs.readFileSync(path.resolve(ROOT, file))

const browser = await chromium.launch()
const page = await browser.newPage()
const result = await page.evaluate(
  async ({ b64, lim, target, tolerance }) => {
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = `data:image/png;base64,${b64}`
    })
    const W = img.naturalWidth
    const H = img.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, W, H).data
    const white = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
      white[i] = target
        ? (Math.abs(r - target[0]) <= tolerance && Math.abs(g - target[1]) <= tolerance && Math.abs(b - target[2]) <= tolerance ? 1 : 0)
        : (r >= 254 && g >= 254 && b >= 254 ? 1 : 0)
    }

    // 연결 성분(4방향, 반복 스택) — 사각형만 남긴다
    const seen = new Uint8Array(W * H)
    const rects = []
    const stack = new Int32Array(W * H)
    for (let s = 0; s < W * H; s++) {
      if (!white[s] || seen[s]) continue
      let sp = 0
      stack[sp++] = s
      seen[s] = 1
      let minX = W, minY = H, maxX = 0, maxY = 0, area = 0
      while (sp > 0) {
        const p = stack[--sp]
        const x = p % W
        const y = (p / W) | 0
        area++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        const n = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]
        for (const q of n) if (q >= 0 && white[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q }
      }
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      // 카드 = 크기가 맞고 bbox 를 꽤 채우는 성분(화면 전체 흰 면 · 선 · 글자 조각 제외)
      if (w >= lim.minW && w <= lim.maxW && h >= lim.minH && h <= lim.maxH && area / (w * h) > 0.55) rects.push({ x: minX, y: minY, w, h })
    }
    return { W, H, rects }
  },
  { b64: png.toString('base64'), lim, target, tolerance },
)
await browser.close()

const rects = result.rects.sort((a, b) => a.x - b.x || a.y - b.y)
const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null)
// 열 = x 가 6px 이내인 사각형
const cols = []
for (const r of rects) {
  const c = cols.find((c) => Math.abs(c.x - r.x) <= 6)
  if (c) c.items.push(r)
  else cols.push({ x: r.x, items: [r] })
}
cols.sort((a, b) => a.x - b.x)
const colXs = cols.map((c) => c.x)
const pitchX = colXs.length > 1 ? median(colXs.slice(1).map((x, i) => x - colXs[i])) : null
const rowGaps = cols.flatMap((c) => {
  const ys = c.items.map((r) => r.y).sort((a, b) => a - b)
  return ys.slice(1).map((y, i) => y - ys[i])
})
const spec = {
  source: path.basename(file),
  image: { w: result.W, h: result.H },
  node: { w: median(rects.map((r) => r.w)), h: median(rects.map((r) => r.h)) },
  columns: { count: cols.length, xs: colXs, pitch: pitchX, gapBetween: pitchX !== null ? pitchX - median(rects.map((r) => r.w)) : null },
  rows: { pitch: median(rowGaps), gap: rowGaps.length ? median(rowGaps) - median(rects.map((r) => r.h)) : null },
  firstNodeY: rects.length ? Math.min(...rects.map((r) => r.y)) : null,
  rects,
}
const out = arg('--out', null)
if (out) fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify(spec, null, 2) + '\n')
console.log(JSON.stringify({ ...spec, rects: `(${rects.length}개)` }, null, 2))
