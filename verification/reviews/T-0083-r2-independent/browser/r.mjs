// T-0078 — 실제 React 지도 · 계획 · 자료 받기 + Chromium(고정 데이터 · 인증 Next/DB 아님)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test')
const server = await vite.createServer({ configFile: false, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: 'server-only', replacement: `${wt}/apps/web/src/test/server-only-stub.ts` }, { find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/link', replacement: path.join(dir, 'link.tsx') }, { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
let browser
const ROWS = [{ ref: 'authored:at-teach-1', deliveryId: 'd1111111-1111-4111-8111-111111111111', role: 'model_explanation', deliveredAt: '2026-10-21T00:00:00Z', attempted: false, evidence: null, current: true }, { ref: 'authored:at-guided-1', deliveryId: 'd2222222-2222-4222-8222-222222222222', role: 'guided_practice', deliveredAt: '2026-10-21T00:00:00Z', attempted: true, evidence: false, current: true }]
ROWS.push({ ref: 'authored:at-ind-1', deliveryId: 'd3333333-3333-4333-8333-333333333333', role: 'independent_check', deliveredAt: '2026-10-21T00:00:00Z', attempted: false, evidence: null, current: true })
ROWS.push(...['transfer','delayed_check','unknown'].map((role, i) => ({ ref: 'authored:extra-' + i, deliveryId: 'extra-' + i, role, deliveredAt: '2026-10-21T00:00:00Z', attempted: false, evidence: null, current: true })))
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) for (const state of ['rows', 'support_control']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = [], posts = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/**', (r) => {
      const req = r.request(), u = new URL(req.url())
      if (req.method() === 'POST') { if (!u.pathname.includes('/analytics/')) posts.push({ path: u.pathname, body: req.postDataJSON() }); return r.fulfill({ json: { status: 'ok', lines: [{ role: 'model_explanation', requested: 1, delivered: [], rejected: [], orderOpened: true }, { role: 'guided_practice', requested: 1, delivered: [], rejected: [], orderOpened: true }] } }) }
      if (state === 'error') return r.fulfill({ status: 500, json: {} })
      if (state === 'not_installed') return r.fulfill({ json: { status: 'not_installed' } })
      return r.fulfill({ json: { status: 'installed', rows: state === 'empty' ? [] : state === 'support_control' ? ROWS.filter(r => r.role !== 'unknown') : ROWS } })
    })
    await page.goto(`http://127.0.0.1:${port}/?state=${state}`, { waitUntil: 'load', timeout: 300000 })
    await page.locator(state === 'support_control' ? '[data-testid="ws-authored-support"]' : '[data-testid="ws-authored-learn"]').waitFor({ timeout: 300000 })
    await page.waitForTimeout(800)
    const card = page.locator(state === 'support_control' ? '[data-testid="ws-authored-support"]' : '[data-testid="ws-authored-learn"]')
    const text = (await card.innerText()).replace(/\s+/g, ' ')
    const hrefs = await card.locator('a[href^="/csat/learn/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    const req = card.locator(state === 'support_control' ? '[data-testid="ws-authored-support-request"]' : '[data-testid="ws-authored-learn-request"]')
    let posted = null
    if (await req.count()) { await req.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(800); posted = posts[0] ?? null }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: path.join(dir, `learn-${state}-${width}.png`) })
    const scope = state === 'support_control' ? (await card.locator('[data-testid="ws-authored-learn-scope"]').count()) === 0 : text.includes('혼자 확인은 아직 준비 중') && !/숙달|목표 달성/.test(text)
    const hrefOk = hrefs.every((h) => { const p = new URL(h, 'http://x').searchParams; return p.get('from') === 'map' && p.get('ws') === 'ws.sentence-core' && p.get('map_ws') === '11111111-2222-4333-8444-555555555555' && !p.get('map_item') && !p.get('map_attempt') })
    const checks = {
      scope,
      state: state === 'support_control' ? hrefs.length === 5 : state === 'rows' ? hrefs.length === 2 && hrefOk : state === 'empty' ? text.includes('아직 받은 자료가 없어요') && hrefs.length === 0 : state === 'error' ? text.includes('불러오지 못했어요') && hrefs.length === 0 : state === 'not_installed' ? text.includes('자료 공급을 준비하고 있어요') && hrefs.length === 0 : (await req.count()) === 0,
      post: state === 'error' || state === 'not_installed' || state === 'past' ? posts.length === 0 : !!posted && posted.path === '/api/csat/authored/supply' && JSON.stringify(Object.keys(posted.body).sort()) === JSON.stringify(['task', 'template']) && posted.body.task === 's.attachment' && posted.body.template === 'ws.sentence-core',
      overflow: overflow <= 1, errors: errors.length === 0,
    }
    results.push({ width, state, passed: Object.values(checks).every(Boolean), checks, hrefs, posted })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ environment: 'actual Chromium + actual React AuthoredSupplyCard(kind=instructional) · outgoingCtx 실제 · 모의 HTTP · 인증 Next/DB 아님', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.state, JSON.stringify(r.checks), JSON.stringify(r.posted?.body ?? null))
}
