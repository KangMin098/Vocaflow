// scripts/design/admin-ref-compare.mjs
// 관리자 정상 화면의 3B 틀과 토큰 대조. 인증 실패/권한 없음은 통과로 세지 않는다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
const base = arg('--base', 'http://localhost:3000')
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/admin/spec.json'), 'utf8'))
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
const state = process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE
assert(state || password, '관리자 storage state 또는 런타임 테스트 비밀번호가 필요하다. env 값은 출력하지 않는다.')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: spec.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', ...(state ? { storageState: path.resolve(state) } : {}) })
  await page.addInitScript(() => localStorage.setItem('vocaflow-theme', 'light'))
  if (!state) {
    await page.goto(`${base}/login`)
    await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  }
  await page.goto(`${base}/admin/analytics`, { timeout: 90000 })
  await page.getByRole('heading', { name: '플랫폼 분석', exact: true }).waitFor({ timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  const actual = await page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector)
      const r = node.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, minHeight: parseFloat(getComputedStyle(node).minHeight) }
    }
    const style = getComputedStyle(document.documentElement)
    return {
      header: rect('.admin-site-header'), rail: rect('.admin-frame > aside'), panel: rect('[data-admin-panel]'),
      family: style.getPropertyValue('--design-family').trim(),
      tokens: { primary: style.getPropertyValue('--p').trim(), surface: style.getPropertyValue('--bg').trim(), canvas: style.getPropertyValue('--bg2').trim() },
    }
  })
  assert.equal(actual.family, 'three-b', '관리자 3B 루트 스킨이 적용되지 않았다')
  assert.deepEqual(actual.tokens, spec.tokens)
  const rows = []
  for (const [label, reference, measured, fields] of [
    ['상단', spec.header, actual.header, ['height']],
    ['레일', spec.rail, actual.rail, ['width']],
    ['작업 패널', spec.panelFill, actual.panel, ['x', 'y', 'width', 'minHeight']],
  ]) for (const field of fields) rows.push({ 항목: `${label} ${field}`, 참조: reference[field], 적용: measured[field], 차이: Math.abs(measured[field] - reference[field]) })
  console.table(rows)
  const out = arg('--out', null)
  if (out) {
    const file = path.resolve(out)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ viewport: spec.viewport, rows, tokens: actual.tokens, measurement: spec.measurement }, null, 2) + '\n')
  }
  assert(rows.every(row => row.차이 <= 2), '참조 허용 오차 2px 초과')
} finally { await browser.close() }
