// scripts/design/shot-section.mjs
//
// 화면의 한 구획을 찾아(접근 이름 · 선택자) 그 위치로 스크롤한 첫 화면을 찍는다 — 긴 화면 아래쪽 구획의 전후 비교용.
// 사용: node scripts/design/shot-section.mjs --url <URL> --selector '<css>' --out <png> [--width 1440] [--auth] [--theme light|dark] [--offset 80]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const width = Number(arg('width', '1440'))
const theme = arg('theme', 'light')

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width, height: 900 },
  colorScheme: theme === 'dark' ? 'dark' : 'light',
  reducedMotion: 'reduce',
  ...(args.includes('--auth') && fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}),
})
const page = await ctx.newPage()
await page.addInitScript((t) => { try { localStorage.setItem('vocaflow-theme', t) } catch {} }, theme)
await page.goto(arg('url'), { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.waitForTimeout(5000)
const y = await page.evaluate((sel) => {
  const el = document.querySelector(sel)
  return el ? el.getBoundingClientRect().top + scrollY : null
}, arg('selector'))
if (y === null) { console.error('구획을 못 찾음:', arg('selector')); process.exit(1) }
await page.evaluate((top) => window.scrollTo(0, top), Math.max(0, y - Number(arg('offset', '80'))))
await page.waitForTimeout(1200)
const out = path.resolve(ROOT, arg('out'))
fs.mkdirSync(path.dirname(out), { recursive: true })
await page.screenshot({ path: out })
console.log(`${out} (구획 y=${Math.round(y)})`)
await browser.close()
