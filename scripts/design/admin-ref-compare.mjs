// scripts/design/admin-ref-compare.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'
const args = process.argv.slice(2)
const arg = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback)
const base = arg('--base', 'http://localhost:3000')
const spec = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/admin/spec.json'), 'utf8')
)
const state = process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
assert(state || password, '관리자 인증 상태 또는 검증 계정 비밀번호가 필요합니다.')
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    viewport: spec.viewport,
    reducedMotion: 'reduce',
    ...(state ? { storageState: path.resolve(state) } : {}),
  })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('vocaflow-theme', 'light'))
  if (!state) {
    await page.goto(`${base}/login`)
    await page
      .getByLabel(/이메일/)
      .fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
    await page.locator('input[type=password]').fill(password)
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 90000 })
  }
  await page.goto(`${base}/admin/settings`, { timeout: 120000 })
  await page.getByRole('heading', { name: '연결·지원 상태', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  const actual = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector)
      if (!node) throw new Error(`Missing ${selector}`)
      const box = node.getBoundingClientRect()
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        minHeight: parseFloat(getComputedStyle(node).minHeight),
      }
    }
    const style = getComputedStyle(document.documentElement)
    return {
      header: rect('.admin-site-header'),
      rail: rect('.admin-frame > aside'),
      panel: rect('[data-admin-panel]'),
      tokens: {
        primary: style.getPropertyValue('--p').trim(),
        surface: style.getPropertyValue('--bg').trim(),
        canvas: style.getPropertyValue('--bg2').trim(),
      },
    }
  })
  assert.deepEqual(actual.tokens, spec.tokens)
  const rows = []
  for (const [name, reference, applied, fields] of [
    ['상단', spec.header, actual.header, ['height']],
    ['레일', spec.rail, actual.rail, ['width']],
    ['작업 패널', spec.panelFill, actual.panel, ['x', 'y', 'width', 'minHeight']],
  ])
    for (const field of fields)
      rows.push({
        항목: `${name} ${field}`,
        참조: reference[field],
        적용: applied[field],
        차이: Math.abs(reference[field] - applied[field]),
      })
  console.table(rows)
  const out = arg('--out', null)
  if (out) {
    const file = path.resolve(out)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      JSON.stringify({ viewport: spec.viewport, rows, tokens: actual.tokens }, null, 2) + '\n'
    )
  }
  assert(
    rows.every((row) => row.차이 <= 2),
    '관리자 외곽 참조 허용 오차 2px 초과'
  )
} finally {
  await browser.close()
}
