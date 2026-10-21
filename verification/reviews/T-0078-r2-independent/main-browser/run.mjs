// T-0078 — 실제 React 지도 · 계획 · 자료 받기 + Chromium(고정 데이터 · 인증 Next/DB 아님)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
const wt = 'D:/workspace/Vocaflow-main-serving'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test')
const server = await vite.createServer({ configFile: false, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: 'server-only', replacement: `${wt}/apps/web/src/test/server-only-stub.ts` }, { find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
const {execFileSync} = await import('node:child_process')
const testedHead = execFileSync('git',['-C',wt,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
let browser
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = [], posts = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/**', async (route) => {
      const req = route.request(), u = req.url()
      if (req.method() === 'POST') posts.push(u)
      if (u.includes('/api/csat/authored/supply') && req.method() === 'POST') return route.fulfill({ status: 503, json: { error: 'x', code: 'evidence_unavailable' } })
      if (u.includes('/api/csat/diagnosis/map/plan') && req.method() === 'POST') return route.fulfill({ status: 503, json: { error: 'x', code: 'evidence_unavailable' } })
      if (u.includes('/api/csat/authored/delivered')) return route.fulfill({ json: { status: 'installed', rows: [] } })
      return route.fulfill({ json: { status: 'installed', rows: [] } })
    })
    await page.goto(`http://127.0.0.1:${port}/?tab=map&view=full&map_task=r.central_meaning&ws=ws.central-meaning&map_item=authored%3Aprobe-guide&map_attempt=3&map_plan=7&map_ws=11111111-2222-4333-8444-555555555555&map_goal=10`, { waitUntil: 'load', timeout: 300000 })
    await page.waitForSelector('[data-testid="map-read-unavailable"]', { timeout: 300000 })
    const map = page.locator('[data-case="map"]')
    const before = { text: await map.innerText(), cta: await map.locator('[data-testid="plan-save"], [data-testid="umap-top-next"], [data-testid="umap-node"]').count(), url: page.url() }
    await page.screenshot({ path: path.join(dir, `read-unavailable-${width}.png`) })
    const postsBefore = posts.length
    // 키보드 재조회 — 한 번
    await map.locator('[data-testid="map-read-retry"]').focus(); await page.keyboard.press('Enter')
    await page.waitForSelector('[data-case="map"] [data-testid="unified-map"]', { timeout: 120000 })
    await page.waitForTimeout(500)
    const after = { url: page.url(), refreshes: await page.evaluate(() => window.__refreshes), recovered: await map.locator('[data-testid="map-read-unavailable"]').count() }
    const u = new URL(after.url)
    await page.screenshot({ path: path.join(dir, `read-recovered-${width}.png`) })
    // 계획 · 자료 받기 503 안내(모의 응답)
    const plan = page.locator('[data-case="plan"]')
    await plan.locator('[data-testid="plan-save"]').click()
    await plan.getByText('수행 기록을 지금 읽지 못해 계획을 저장하지 않았어요', { exact: false }).waitFor({ timeout: 30000 }).catch(() => undefined)
    const planMsg = await plan.innerText()
    const supply = page.locator('[data-case="supply"]')
    await supply.locator('[data-testid="ws-authored-request"]').click()
    await page.waitForSelector('[data-case="supply"] [data-testid="ws-authored-msg"]', { timeout: 30000 })
    const supplyMsg = await supply.locator('[data-testid="ws-authored-msg"]').innerText()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const ok = (k, v, extra = {}) => results.push({ width, case: k, passed: !!v && errors.length === 0, ...extra })
    ok('unavailable', before.text.includes('학습 기록을 지금 읽지 못했어요') && before.text.includes('0건이라거나 부족하다는 뜻이 아니에요') && before.cta === 0, { cta: before.cta })
    ok('unavailable-return-query-intact', ['map_attempt=3','map_plan=7','map_ws=11111111-2222-4333-8444-555555555555','map_goal=10'].every(x=>before.url.includes(x)))
    ok('no-post-while-unavailable', postsBefore === 0, { postsBefore })
    ok('retry-once-same-context', after.refreshes === 1 && after.recovered === 0 && u.searchParams.get('map_task') === 'r.central_meaning' && u.searchParams.get('ws') === 'ws.central-meaning' && u.searchParams.get('map_item') === 'authored:probe-guide' && u.searchParams.get('tab') === 'map' && u.searchParams.get('view') === 'full' && u.searchParams.get('map_attempt') === '3', { url: after.url, refreshes: after.refreshes })
    ok('plan-503-label', planMsg.includes('수행 기록을 지금 읽지 못해 계획을 저장하지 않았어요') && !/미설치|열리지 않았어요/.test(planMsg.split('저장하지 못했어요')[1] ?? ''))
    ok('supply-503-label', supplyMsg.includes('수행 기록을 지금 읽지 못해 자료를 받지 않았어요') && !supplyMsg.includes('준비하고 있어요'), { supplyMsg })
    ok('overflow', overflow <= 1, { overflow, errors })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  const report = { tested_head:testedHead, end_head:execFileSync('git',['-C',wt,'rev-parse','HEAD'],{encoding:'utf8'}).trim(), observed_at:new Date().toISOString(), environment: 'actual Chromium + actual React UnifiedLearningMap/PlanSection/AuthoredSupplyCard; fixed data(Codex probe compose fixture); router shim; mocked HTTP; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.case, JSON.stringify({ ...r, width: undefined, case: undefined, passed: undefined }))
  console.log(report.passed, report.failed)
}

