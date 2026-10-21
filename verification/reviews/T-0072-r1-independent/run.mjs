// T-0072 — 실제 React PlanSection + 실제 Chromium(POST 모의 · router.refresh = 서버 재조회 흉내). 인증 Next/DB 아님.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = path.dirname(fileURLToPath(import.meta.url))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test')
const server = await vite.createServer({ configFile: false, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
let browser
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  const open = async (qs, width = 1440) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const posts = []; const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/csat/diagnosis/map/plan', async (route) => { posts.push(JSON.parse(route.request().postData())); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 3, workspaceId: '11111111-2222-4333-8444-555555555555' }) }) })
    await page.goto(`http://127.0.0.1:${port}/?${qs}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="plan-section"]')
    return { page, posts, errors }
  }
  const state = (p) => p.locator('[data-testid="plan-save-state"]').getAttribute('data-state')
  for (const width of [1440, 1280]) {
    const x = await open('goal=11', width)
    const notice = await x.page.locator('[data-testid="plan-goal-changed"]').count()
    const before = await state(x.page)
    const reason = await x.page.locator('[data-testid="plan-reason"]').inputValue()
    const save = x.page.locator('[data-testid="plan-save"]')
    await save.focus(); await x.page.keyboard.press('Enter')
    await x.page.waitForFunction(() => document.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') === 'saved', null, { timeout: 15000 }).catch(() => null)
    const after = await state(x.page)
    const noticeAfter = await x.page.locator('[data-testid="plan-goal-changed"]').count()
    const shot = path.join(dir, `goal-refresh-${width}.png`); await x.page.screenshot({ path: shot, fullPage: true })
    const b = x.posts[0] ?? {}
    results.push({ case: `새 목표 → 옛 PLAN 안내 → 키보드 재확정 → 재조회 뒤 저장됨 · ${width}`, passed: notice === 1 && before !== 'saved' && reason === 'goal_change' && x.posts.length === 1 && b.reason === 'goal_change' && b.expectedGoalVersion === 11 && b.expectedVersion === 2 && after === 'saved' && noticeAfter === 0 && x.errors.length === 0, notice, before, reason, posts: x.posts.length, body: { reason: b.reason, expectedGoalVersion: b.expectedGoalVersion, expectedVersion: b.expectedVersion }, after, noticeAfter, errors: x.errors, shot })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    await x.page.evaluate(() => { window.__afterRefreshGoal = 12 })
    await x.page.locator('[data-testid="plan-save"]').click(); await x.page.waitForTimeout(1000)
    const after = await state(x.page)
    const cur = await x.page.locator('[data-testid="plan-goal-changed"]').getAttribute('data-current-goal').catch(() => null)
    results.push({ case: '확정 중 목표가 또 바뀜 → 지금 목표 저장됐다고 표시하지 않음', passed: after !== 'saved' && cur === '12', after, cur })
    await x.page.close()
  }
  {
    const x = await open('goal=10'); await x.page.waitForTimeout(500)
    const st = await state(x.page); const notice = await x.page.locator('[data-testid="plan-goal-changed"]').count()
    results.push({ case: '정상 같은 목표 → 저장됨 · 안내 없음 · 숨은 POST 없음', passed: st === 'saved' && notice === 0 && x.posts.length === 0, st, notice, posts: x.posts.length })
    await x.page.close()
  }
  {
    const x = await open('goal=11&past=1'); await x.page.waitForTimeout(500)
    const notice = await x.page.locator('[data-testid="plan-goal-changed"]').count()
    results.push({ case: '과거 모드 → 목표 변경 재확정 안내 없음 · POST 없음', passed: notice === 0 && x.posts.length === 0, notice, posts: x.posts.length })
    await x.page.close()
  }

  {
    const x = await open('goal=11')
    await x.page.evaluate(() => { window.__refresh = () => {} })
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForTimeout(300)
    const after = await state(x.page)
    results.push({ case: 'Independent: successful POST without current server refetch stays unconfirmed', passed: x.posts.length === 1 && after !== 'saved', after, posts: x.posts.length })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    await x.page.unroute('**/api/csat/diagnosis/map/plan')
    await x.page.route('**/api/csat/diagnosis/map/plan', async route => {
      x.posts.push(JSON.parse(route.request().postData()))
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'goal_changed' }) })
    })
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForSelector('[data-testid="plan-conflict"]')
    const after = await state(x.page)
    results.push({ case: 'Independent: goal CAS conflict never claims saved', passed: after !== 'saved' && x.posts.length === 1, after, posts: x.posts.length })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    await x.page.locator('[data-testid="plan-reason"]').selectOption('learner_adjust')
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForFunction(() => document.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') === 'saved')
    const body = x.posts[0]
    results.push({ case: 'Independent: explicit user reason survives default goal reason', passed: body?.reason === 'learner_adjust' && body.expectedGoalVersion === 11 && body.expectedVersion === 2, body: { reason: body?.reason, expectedGoalVersion: body?.expectedGoalVersion, expectedVersion: body?.expectedVersion } })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    const notice = await x.page.locator('[data-testid="plan-drift"]').textContent().catch(() => null)
    results.push({ case: 'Observation only: content-drift notice on goal-only change', passed: true, observation: notice, severity: 'P2', blocking: false })
    await x.page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
  const report = { environment: 'actual Chromium + actual React PlanSection; mocked POST; router.refresh simulates server refetch; no auth Next/DB', results, passed: results.filter((r) => r.passed && !r.observation).length, failed: results.filter((r) => !r.passed).length, observations: results.filter((r) => r.observation).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.case, JSON.stringify({ ...r, case: undefined, passed: undefined, shot: undefined }))
  console.log(report.passed, report.failed)
}
