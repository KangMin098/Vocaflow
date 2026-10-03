// scripts/design/hub-ref-compare.mjs
// Tines 홈/3B 웹사이트의 측정 항목과 정상 학습자 허브를 대조한다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'
const args = process.argv.slice(2)
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/tines/hub-spec.json'), 'utf8'))
const base = arg('--base', 'http://localhost:3000')
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
assert(password, 'PLAYWRIGHT_RUNTIME_PASSWORD가 필요하다. 값은 출력하지 않는다.')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: spec.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('vocaflow-theme', 'light'))
  await page.goto(`${base}/login`)
  await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  await page.goto(`${base}/hub`, { timeout: 90000 })
  await page.locator('.hub-product-frame').waitFor({ timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  const rows = []
  for (const entry of spec.comparisons) {
    const value = await page.locator(entry.selector).first().evaluate((node, field) => {
      const rect = node.getBoundingClientRect(), s = getComputedStyle(node)
      return { x: rect.x, width: rect.width, size: parseFloat(s.fontSize), lineHeight: parseFloat(s.lineHeight), radius: parseFloat(s.borderRadius), padding: parseFloat(s.paddingLeft), gap: parseFloat(s.gap) }[field]
    }, entry.field)
    rows.push({ 항목: entry.name, 참조: entry.reference, 적용: Math.round(value * 100) / 100, 차이: Math.round(Math.abs(value - entry.reference) * 100) / 100 })
  }
  console.table(rows)
  const out = arg('--out', null)
  if (out) { const file = path.resolve(out); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ viewport: spec.viewport, rows }, null, 2) + '\n') }
  assert(rows.every(row => row.차이 <= 2), '참조 허용 오차 2px 초과')
} finally { await browser.close() }
