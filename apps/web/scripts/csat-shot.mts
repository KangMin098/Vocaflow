// apps/web/scripts/csat-shot.mts
//
// 화면을 눈으로 보기 위한 캡처 — 측정(`csat-surface-measure.mts`)과 짝이다.
// 수치가 좋아져도 화면이 깨져 있을 수 있으므로, 사이클마다 둘 다 본다.
//
//   npx tsx scripts/csat-shot.mts /csat [/csat/R-BLANK …]

import fs from 'node:fs'
import path from 'node:path'

import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const STATE = path.resolve('playwright-auth/.auth-csat-measure.json')
const OUT = path.resolve('public/dev/csat-shots')
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/csat']

const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: STATE })
const page = await ctx.newPage()
await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f)')
fs.mkdirSync(OUT, { recursive: true })

for (const r of routes) {
  for (const [label, w, h, dark] of [
    ['desktop', 1280, 900, false],
    ['mobile', 390, 844, false],
    ['dark', 1280, 900, true],
  ] as [string, number, number, boolean][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' })
    await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(500)
    const name = r.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + `-${label}.png`
    await page.screenshot({ path: path.join(OUT, name), fullPage: label === 'desktop' })
    console.log('→ ' + path.relative(process.cwd(), path.join(OUT, name)))
  }
}
await browser.close()
