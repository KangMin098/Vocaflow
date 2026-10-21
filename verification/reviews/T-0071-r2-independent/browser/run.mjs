// verification/reviews/T-0071-r2-independent/browser/run.mjs
// Actual React + Chromium, synthetic identity/state GET. Not authenticated Next/DB or visual acceptance.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = path.dirname(fileURLToPath(import.meta.url))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test')
const d = '11111111-1111-4111-8111-111111111111', d2 = '22222222-2222-4222-8222-222222222222'
const row = { ref: 'authored:opt-guided-1', deliveryId: d, role: 'guided_practice', current: true }
const record = (deliveryId = d, statement = 'SYNTHETIC_NOTE_A') => ({ ok: true, record: { version: 1, reasoningNotes: [{ id: 'n1', item: row.ref, authored: { deliveryId, annotationHash: 'h' }, statement, grounds: 'g', applicability: 'a', limit: 'l', at: 1, updatedAt: 1, pairIds: [], binding: { analysisVersion: null }, evidence: [], afterExplanation: true, comparedWithModel: false }] } })
const server = await vite.createServer({ configFile: false, root: dir, logLevel: 'error', esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/link', replacement: path.join(dir, 'link.tsx') }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const port = server.httpServer.address().port
  const setup = async ({ deferred = false, second = record() } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const requests = [], errors = []
    let release
    const pending = new Promise(r => { release = r })
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/csat/state', async route => {
      const index = requests.length
      requests.push(route.request().method())
      if (index === 0 && deferred) await pending
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(index === 0 ? record() : second) })
    })
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="ws-notes"] summary')
    return { page, requests, errors, release }
  }
  const open = async p => { await p.locator('[data-testid="ws-notes"] summary').click(); await p.waitForSelector('[data-testid="ws-notes-list"]') }
  const settle = async p => { await p.waitForLoadState('networkidle'); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  const change = async (p, patch) => { await p.evaluate(x => window.change(x), patch); await settle(p) }
  const links = p => p.locator('[data-testid="ws-notes-open"]').count()
  const old = p => p.getByText('SYNTHETIC_NOTE_A', { exact: true }).count()
  const push = (x, name, passed, extra = {}) => results.push({ case: name, passed: passed && x.errors.length === 0, requests: [...x.requests], errors: [...x.errors], ...extra })
  {
    const x = await setup(), lazy = x.requests.length === 0
    await open(x.page)
    await x.page.locator('[data-testid="ws-notes"] summary').click()
    await open(x.page)
    push(x, 'lazy GET-only normal read and same-scope reopen', lazy && x.requests.join(',') === 'GET' && await links(x.page) === 1)
    await x.page.close()
  }
  for (const current of [false, null]) {
    const x = await setup(); await open(x.page)
    await change(x.page, { rows: [{ ...row, current }] })
    push(x, `latest current=${current} makes own note readonly without refetch`, await links(x.page) === 0 && await old(x.page) === 1 && x.requests.length === 1)
    await x.page.close()
  }
  for (const listed of ['error', 'not_installed', 'loading']) {
    const x = await setup(); await open(x.page)
    await change(x.page, { listed })
    push(x, `listed ${listed} removes stale notes and links`, await links(x.page) === 0 && await old(x.page) === 0 && await x.page.locator('[data-testid="ws-notes-unknown"]').count() === 1)
    await x.page.close()
  }
  {
    const x = await setup(); await open(x.page)
    await change(x.page, { viewer: 'B', rows: [{ ...row, deliveryId: d2 }] })
    push(x, 'same-TASK new viewer and delivery excludes old scope notes', await old(x.page) === 0 && await links(x.page) === 0 && x.requests.length === 2)
    await x.page.close()
  }
  {
    const x = await setup({ second: record(d, 'SYNTHETIC_NOTE_B') }); await open(x.page)
    await change(x.page, { viewer: 'B' })
    push(x, 'viewer-only change fetches new scope once', await old(x.page) === 0 && await x.page.getByText('SYNTHETIC_NOTE_B', { exact: true }).count() === 1 && x.requests.length === 2)
    await x.page.close()
  }
  {
    const x = await setup({ deferred: true, second: record(d2, 'SYNTHETIC_NOTE_B') })
    await x.page.locator('[data-testid="ws-notes"] summary').click()
    await x.page.waitForFunction(() => document.body.textContent.includes('\ubd88\ub7ec\uc624\ub294 \uc911'))
    await x.page.evaluate(patch => window.change(patch), { viewer: 'B', rows: [{ ...row, deliveryId: d2 }] })
    await x.page.getByText('SYNTHETIC_NOTE_B', { exact: true }).waitFor()
    x.release(); await settle(x.page)
    push(x, 'late response cannot overwrite newer viewer-delivery result', await old(x.page) === 0 && await x.page.getByText('SYNTHETIC_NOTE_B', { exact: true }).count() === 1 && x.requests.length === 2)
    await x.page.close()
  }
  {
    const x = await setup({ deferred: true })
    await x.page.locator('[data-testid="ws-notes"] summary').click()
    await x.page.waitForFunction(() => document.body.textContent.includes('\ubd88\ub7ec\uc624\ub294 \uc911'))
    await x.page.evaluate(patch => window.change(patch), { task: 'r.central_meaning', rows: [{ ...row, deliveryId: d2 }] })
    x.release(); await settle(x.page)
    push(x, 'TASK-key remount control discards prior response', await old(x.page) === 0 && x.requests.length === 1)
    await x.page.close()
  }
  {
    const x = await setup(); await open(x.page)
    for (let i = 0; i < 3; i++) await change(x.page, { rows: [{ ...row }] })
    push(x, 'fresh equivalent rows references do not refetch', await links(x.page) === 1 && x.requests.length === 1)
    await x.page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
  const report = { head: 'f9d66f487072b56a64d76ebe70fb668920a8576e', environment: 'actual Chromium + actual React, next/link shim, synthetic GET and viewer transitions; NOT authenticated Next/DB or full visual acceptance', results, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length }
  fs.writeFileSync(path.join(dir, '../browser-results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
if (results.length !== 11 || results.some(x => !x.passed)) process.exitCode = 1
