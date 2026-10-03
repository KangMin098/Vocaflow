// scripts/design/tines-ref-compare.mjs
// PC Library/University 기하 대조. 알려진 읽기 허브만 방문하고 학습/구독을 실행하지 않는다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
const base = arg('--base', 'http://localhost:3000')
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/tines/pc-refinement-spec.json'), 'utf8'))
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
assert(password, 'PLAYWRIGHT_RUNTIME_PASSWORD가 필요하다. env 값은 출력하지 않는다.')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: spec.viewport.width, height: spec.viewport.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('vocaflow-theme', 'light'))
  await page.goto(`${base}/login`)
  await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  const rows = []
  async function compare(route, selector, reference, fields) {
    await page.goto(`${base}${route}`, { timeout: 90000 })
    const element = page.locator(selector)
    await element.waitFor({ timeout: 60000 })
    await page.evaluate(() => document.fonts.ready)
    const actual = await element.evaluate(node => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
      return { x: rect.x, width: rect.width, height: rect.height, radius: parseFloat(style.borderRadius), size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }
    })
    for (const field of fields) rows.push({ 항목: `${route} ${field}`, 참조: reference[field], 적용: Math.round(actual[field] * 100) / 100, 차이: Math.round(Math.abs(actual[field] - reference[field]) * 100) / 100 })
  }
  await compare('/library/vocab', '.tines-library-hero', spec.references.library.hero, ['x', 'width', 'height', 'radius'])
  await compare('/library/vocab', '.tines-library-hero h1', spec.references.library.heading, ['size', 'lineHeight'])
  await compare('/dictate', '.tines-university-hero', spec.references.university.frame, ['x', 'width', 'height'])
  await compare('/dictate', '.tines-university-hero h1', spec.references.university.heading, ['size', 'lineHeight'])
  console.table(rows)
  const out = arg('--out', null)
  if (out) { const file = path.resolve(out); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ viewport: spec.viewport, rows }, null, 2)) }
  assert(rows.every(row => row.차이 <= 2), '참조 허용 오차 2px 초과')
} finally {
  await browser.close()
}
