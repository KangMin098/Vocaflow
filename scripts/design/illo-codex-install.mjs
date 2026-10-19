#!/usr/bin/env node
// scripts/design/illo-codex-install.mjs
//
// Codex 가 그린 선화 PNG(투명 바탕)를 학습자 삽화 자리(public/illustrations/tines/<id>.webp)에 넣는다 — 2026-10-19.
// 옛 삽화(광택 아이소메트릭 렌더)가 「AI 템플릿」 인상의 첫째 원인이라는 사용자 지적으로 같은 id 를 선화로 바꾼다.
// 화면 코드는 id 로만 그림을 부르므로 파일을 바꾸면 그 그림을 쓰는 모든 화면이 함께 바뀐다.
//
//   node scripts/design/illo-codex-install.mjs --src tmp/s7/illo --only tile-books,spot-reading
//   (--only 를 빼면 src 의 모든 png 중 기존 webp 가 있는 id 만 바꾼다 — 새 id 를 몰래 늘리지 않는다)
//
// 바탕은 이미 투명이므로 키잉하지 않는다. 1328² 로 맞춰 WebP(0.86)로 굽는다(기존 자산과 같은 크기 — next/image width 1328).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const SRC = path.resolve(ROOT, arg('--src', 'tmp/s7/illo'))
const ONLY = arg('--only', null)?.split(',') ?? null
const DEST = path.join(ROOT, 'apps/web/public/illustrations/tines')
const SIZE = 1328
/** 정사각이 아닌 자산 — 화면 코드의 width/height 와 같은 크기로 굽는다(object-cover 크롭 구도 유지) */
const SIZE_OF = { 'band-scatter': [1664, 928] }

const ids = fs.readdirSync(SRC)
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.slice(0, -4))
  .filter((id) => (ONLY ? ONLY.includes(id) : fs.existsSync(path.join(DEST, `${id}.webp`))))

if (ids.length === 0) { console.log('바꿀 그림 없음'); process.exit(0) }

const browser = await chromium.launch()
const page = await browser.newPage()
let done = 0
for (const id of ids) {
  const src = `data:image/png;base64,${fs.readFileSync(path.join(SRC, `${id}.png`)).toString('base64')}`
  const [W, H] = SIZE_OF[id] ?? [SIZE, SIZE]
  const b64 = await page.evaluate(async ([s, w, h]) => {
    const img = new Image(); img.src = s; await img.decode()
    // 비율이 다르면 가운데를 기준으로 덮어 자른다(cover)
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    return c.toDataURL('image/webp', 0.86).split(',')[1]
  }, [src, W, H])
  fs.writeFileSync(path.join(DEST, `${id}.webp`), Buffer.from(b64, 'base64'))
  done++
  console.log(`✓ ${id}`)
}
await browser.close()
console.log(`${done}/${ids.length} 교체`)
