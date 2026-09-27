#!/usr/bin/env node
// scripts/design/show-screen.mjs
//
// 화면을 **읽을 수 있는 크기로** 찍는다 — 1:1 로 찍고 뷰포트 높이로 잘라 여러 장으로 낸다.
//
//   node scripts/design/show-screen.mjs /dev/replica/ours-home
//   node scripts/design/show-screen.mjs /dev/replica/ours-home --vp 375 --slices 4
//   node scripts/design/show-screen.mjs /dev/replica/ours-app --selector '[data-app-frame="1440"]'
//   node scripts/design/show-screen.mjs https://www.tines.com/ --external
//
// 왜 자르나(사용자 지적 2026-09-20): 전체 페이지를 한 장에 담으면 폭이 1200px 남짓으로 줄고
// 글자·간격·대비가 안 읽힌다. 「같은 급인가」를 물으면서 판단할 수 없는 그림을 주는 셈이다.
// 축소 합성 시트(`replica-diff.mjs`)는 **구조가 같은가**를 볼 때만 쓰고, 판단에는 이 1:1 조각을 쓴다.
//
// 산출: docs/design/shots/replica/screen-<이름>-<폭>-NN.png (gitignore — DD-47)

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, openRef, settle } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const has = (k) => argv.includes(k)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const target = argv[0]
if (!target || target.startsWith('--')) {
  console.error('사용: node scripts/design/show-screen.mjs <경로|URL> [--vp 1440|375] [--slices N] [--selector CSS] [--external] [--base URL]')
  process.exit(64)
}

const BASE = arg('--base', 'http://localhost:3000')
const VP = Number(arg('--vp', '1440'))
const HEIGHT = Number(arg('--height', VP >= 768 ? '900' : '812'))
const SLICES = Number(arg('--slices', '0')) // 0 = 페이지 전체를 뷰포트 높이로 나눈 만큼
const SELECTOR = arg('--selector', '')
const OUT = path.join(ROOT, 'docs/design/shots/replica')
// ⚠️ Git Bash(MSYS)는 `/dev/...` 로 시작하는 인자를 윈도 경로로 바꿔 버린다
//    (`C:/Program Files/Git/dev/...`). 슬래시 없이 줘도 되게 받아 둔다 — 실측 2026-09-20.
const routePath = /^https?:/.test(target)
  ? target
  : '/' + (target.includes('/dev/') ? target.slice(target.indexOf('/dev/') + 1) : target).replace(/^\/+/, '')
const url = has('--external') || /^https?:/.test(target) ? target : `${BASE}${routePath}`
const name = (SELECTOR ? `${routePath}-sel` : routePath).replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '')

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

let page
let ctx
if (has('--external')) {
  ;({ ctx, page } = await openRef(browser, url, { key: String(VP), width: VP, height: HEIGHT }))
} else {
  ctx = await browser.newContext({ viewport: { width: VP, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  page = await ctx.newPage()
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
  if (!res || res.status() >= 400) {
    console.error(`열지 못했다: ${url} (HTTP ${res?.status()})`)
    await browser.close()
    process.exit(1)
  }
  await settle(page)
}

const files = []
if (SELECTOR) {
  const el = page.locator(SELECTOR).first()
  if (!(await el.count())) {
    console.error(`선택자가 없다: ${SELECTOR}`)
    await browser.close()
    process.exit(1)
  }
  const f = path.join(OUT, `screen-${name}-${VP}.png`)
  await el.screenshot({ path: f })
  files.push(f)
} else {
  // 보이는 영역만 여러 번 찍는다 — fullPage 한 장을 나중에 자르는 것보다 sticky 요소가 제자리에 남는다.
  const docH = await page.evaluate(() => document.documentElement.scrollHeight)
  const n = SLICES > 0 ? SLICES : Math.min(8, Math.ceil(docH / HEIGHT))
  for (let i = 0; i < n; i++) {
    const y = Math.min(i * HEIGHT, Math.max(0, docH - HEIGHT))
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(250)
    const f = path.join(OUT, `screen-${name}-${VP}-${String(i + 1).padStart(2, '0')}.png`)
    await page.screenshot({ path: f })
    files.push(f)
  }
  console.log(`문서 높이 ${docH}px · 뷰포트 ${VP}×${HEIGHT} · 조각 ${n}`)
}

await ctx.close()
await browser.close()
for (const f of files) console.log(path.relative(ROOT, f).split(path.sep).join('/'))
