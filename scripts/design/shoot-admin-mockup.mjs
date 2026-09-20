// scripts/design/shoot-admin-mockup.mjs
//
// 골든 목업(캔버스 초안)을 두 폭으로 찍는다 — `docs/design/golden/admin-csat-mockup.html` → PNG 2장.
//
// 왜 스크립트로: 목업은 고칠 때마다 다시 찍어야 하고, 손으로 찍으면 폭·테마가 조용히 달라진다.
// 06-workflow 의 산출물 규칙에 맞춘다(캡처는 재생성 가능해야 한다).
// 기출 원문·개인 데이터가 없는 **합성 화면**이라 저장소에 커밋해도 된다(DD-47 기준).
//
// 실행: node scripts/design/shoot-admin-mockup.mjs

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { chromium } = createRequire(join(ROOT, 'apps/web/package.json'))('@playwright/test')

const page_ = pathToFileURL(join(ROOT, 'docs/design/golden/admin-csat-mockup.html')).href
const shots = [
  { file: 'admin-csat-A@1280-light.png', width: 1280, height: 900 },
  { file: 'admin-csat-A@375-light.png', width: 375, height: 812 },
]

const browser = await chromium.launch()
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(page_, { waitUntil: 'load' })
  // 가로 스크롤은 그 자체가 결함이다 — 찍기 전에 잰다(390/375 에서 반복해 걸린 항목).
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const out = join(ROOT, 'docs/design/golden', s.file)
  await p.screenshot({ path: out, fullPage: true })
  console.log(JSON.stringify({ file: s.file, viewport: `${s.width}x${s.height}`, horizontalOverflowPx: overflow }))
  await ctx.close()
}
await browser.close()
