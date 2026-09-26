#!/usr/bin/env node
// scripts/design/capture-ours.mjs
//
// 「제품 화면 자리」에 넣을 **우리 실제 라우트 캡처**를 굽는다(DD-62 Stage 3 ③그림).
//
//   node scripts/design/capture-ours.mjs [--base http://localhost:3000]
//
// 산출: apps/web/public/dev/replica-shots/*.png + manifest.json  (gitignore — 실제 데이터가 찍힌다)
//
// 왜 실물 캡처인가: 「제품 화면」 자리에 목업을 넣으면 Stage 3 의 판단이 다시 목업 판단이 된다.
// 로그인 없이 열리는 라우트만 찍는다 — 검증 계정 데이터가 시트에 섞이면 공유할 수 없다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, settle } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const BASE = arg('--base', 'http://localhost:3000')
const OUT = path.join(ROOT, 'apps/web/public/dev/replica-shots')

// 공개 라우트만. `/fit` 은 로그인 없이 지문 난이도를 재 주는 화면이라 「제품」 이 가장 잘 보인다.
const SHOTS = [
  { id: 'fit-desktop', route: '/fit', width: 1280, height: 800 },
  { id: 'fit-mobile', route: '/fit', width: 390, height: 844 },
  { id: 'landing-desktop', route: '/', width: 1280, height: 800 },
  { id: 'landing-mobile', route: '/', width: 390, height: 844 },
]

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const manifest = { generatedBy: 'scripts/design/capture-ours.mjs', generatedAt: new Date().toISOString(), base: BASE, shots: [] }

for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`${BASE}${s.route}`, { waitUntil: 'networkidle', timeout: 120_000 })
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()}`)
    await settle(page)
    const file = `${s.id}.png`
    await page.screenshot({ path: path.join(OUT, file) })
    manifest.shots.push({ ...s, file, url: `/dev/replica-shots/${file}`, ratio: Math.round((s.width / s.height) * 1000) / 1000 })
    console.log(`${s.id}: ${s.route} @ ${s.width}×${s.height}`)
  } catch (e) {
    console.error(`${s.id}: 실패 — ${e.message}`)
  }
  await ctx.close()
}
await browser.close()

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(`\n${manifest.shots.length}/${SHOTS.length} 장 · apps/web/public/dev/replica-shots/manifest.json`)
if (manifest.shots.length === 0) process.exitCode = 1
