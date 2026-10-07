#!/usr/bin/env node
// scripts/design/ref-scan.mjs
//
// 참조 스크린샷의 **선 · 바깥 사각형 · 대표 색**을 잰다(ref-measure 가 카드 사각형을 재는 것의 짝).
//
//   node scripts/design/ref-scan.mjs <png> --lines                 # 긴 가로선 · 세로선(패널 테두리 · 머리 구분선)과 색
//   node scripts/design/ref-scan.mjs <png> --box <x>,<y>           # (x,y) 에서 이어지는 밝은 영역의 바깥 사각형(모달 · 패널)
//   node scripts/design/ref-scan.mjs <png> --color <x>,<y> [...]   # 그 점의 색(여러 개)
//   node scripts/design/ref-scan.mjs <png> --text <y0>,<y1>        # 가로 띠(y0~y1)에서 글자 덩어리의 왼쪽 · 오른쪽 x(열 머리 글자 위치)
//
// --box 는 밝은 점(≥240)이 이어지는 범위라 구분선에서 끊긴다 — 머리 · 바닥 높이는 머리/바닥의 빈 곳에서 각각 재면 된다.
// 결과는 docs/design/refs/3b/access-map/spec.json 에 손으로 옮긴다(명세가 정본).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--') && !/^\d+,\d+/.test(a))
const flag = (k) => argv.indexOf(k)
if (!file) {
  console.error('사용: node scripts/design/ref-scan.mjs <png> --lines | --box x,y | --color x,y [x,y…]')
  process.exit(1)
}
const png = fs.readFileSync(path.resolve(ROOT, file))
const pts = (k) => {
  const i = flag(k)
  return i < 0 ? [] : argv.slice(i + 1).filter((a) => /^\d+,\d+$/.test(a)).map((a) => a.split(',').map(Number))
}
const mode = flag('--lines') >= 0 ? 'lines' : flag('--box') >= 0 ? 'box' : flag('--color') >= 0 ? 'color' : flag('--text') >= 0 ? 'text' : null
if (!mode) {
  console.error('--lines | --box x,y | --color x,y 중 하나가 필요하다')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const out = await page.evaluate(
  async ({ b64, mode, points }) => {
    const img = new Image()
    await new Promise((res) => {
      img.onload = res
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
    const px = (x, y) => {
      const i = (y * W + x) * 4
      return [d[i], d[i + 1], d[i + 2]]
    }
    const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
    if (mode === 'text') {
      // 띠 안에서 어두운 점(글자)이 있는 열 → 40px 넘게 비면 다른 덩어리
      const [y0, y1] = points[0]
      const dark = (c) => c[0] < 170 && c[1] < 170 && c[2] < 170
      const runs = []
      let cur = null
      for (let x = 0; x < W; x++) {
        let hit = false
        for (let y = y0; y <= y1 && !hit; y++) hit = dark(px(x, y))
        if (hit) {
          if (cur && x - cur.r <= 40) cur.r = x
          else { cur = { l: x, r: x }; runs.push(cur) }
        }
      }
      return { size: [W, H], band: [y0, y1], runs }
    }
    if (mode === 'color') return { size: [W, H], colors: points.map(([x, y]) => ({ x, y, color: hex(px(x, y)) })) }
    if (mode === 'box') {
      const light = (c) => c[0] >= 240 && c[1] >= 240 && c[2] >= 240
      const [cx, cy] = points[0]
      let l = cx, r = cx, t = cy, b = cy
      while (l > 0 && light(px(l - 1, cy))) l--
      while (r < W - 1 && light(px(r + 1, cy))) r++
      while (t > 0 && light(px(cx, t - 1))) t--
      while (b < H - 1 && light(px(cx, b + 1))) b++
      return { size: [W, H], box: { x: l, y: t, w: r - l + 1, h: b - t + 1 } }
    }
    // lines — 한 행/열에서 선 색(연한 회색) 픽셀이 길게 이어진 곳
    const isLine = (c) => c[0] < 247 && c[0] > 205 && Math.abs(c[0] - c[1]) < 8
    const h = []
    for (let y = 0; y < H; y++) {
      let run = 0, best = 0, bx = 0, sx = 0
      for (let x = 0; x < W; x++) {
        if (isLine(px(x, y))) {
          if (run === 0) sx = x
          run++
          if (run > best) { best = run; bx = sx }
        } else run = 0
      }
      if (best > 900) h.push({ y, x: bx, len: best, color: hex(px(bx + 40, y)) })
    }
    const v = []
    for (let x = 0; x < W; x++) {
      let run = 0, best = 0, by = 0, sy = 0
      for (let y = 0; y < H; y++) {
        if (isLine(px(x, y))) {
          if (run === 0) sy = y
          run++
          if (run > best) { best = run; by = sy }
        } else run = 0
      }
      if (best > 500) v.push({ x, y: by, len: best, color: hex(px(x, by + 40)) })
    }
    const dedupe = (a, key) => a.filter((e, i) => i === 0 || Math.abs(e[key] - a[i - 1][key]) > 1)
    return { size: [W, H], hLines: dedupe(h, 'y'), vLines: dedupe(v, 'x') }
  },
  { b64: png.toString('base64'), mode, points: pts(mode === 'lines' ? '--lines' : mode === 'box' ? '--box' : mode === 'text' ? '--text' : '--color') },
)
await browser.close()
console.log(JSON.stringify(out, null, 2))
