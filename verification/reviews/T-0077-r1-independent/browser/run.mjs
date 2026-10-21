// T-0077 — 실제 React PlanSection + Chromium(고정 데이터 · 인증 Next/DB 아님)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test')
const server = await vite.createServer({ configFile: false, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: 'server-only', replacement: `${wt}/apps/web/src/test/server-only-stub.ts` }, { find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
const requests = []
const expectedHead = '0aa0631279bdd2cd123d38493027945cf1db76c9'
const {execFileSync} = await import('node:child_process')
const head = () => execFileSync('git', ['-C', wt, 'rev-parse','HEAD'], {encoding:'utf8'}).trim()
if(head() !== expectedHead) throw Error('Source moved')
let browser
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    page.on('request',r => {if(r.method()==='POST') requests.push({method:r.method(),url:r.url()})})
    const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 300000 })
    await page.waitForSelector('[data-case="past"] [data-testid="plan-section"]', { timeout: 300000 })
    const c = (id) => page.locator(`[data-case="${id}"]`)
    const text = async (id, tid) => (await c(id).locator(`[data-testid="${tid}"]`).count()) ? (await c(id).locator(`[data-testid="${tid}"]`).first().innerText()) : null
    // 키보드 — 저장된 변화가 든 이력 details 를 Tab · Enter 로 펼쳐 읽는다
    const sum = c('saved-change').locator('[data-testid="plan-history"] summary')
    await sum.focus(); await page.keyboard.press('Enter')
    const open = await c('saved-change').locator('[data-testid="plan-history"]').evaluate((d) => d.open)
    const savedChange = await text('saved-change', 'plan-change-saved')
    const historyTasks = await c('saved-change').locator('[data-testid="plan-history-tasks"]').allInnerTexts()
    const checks = {
      proposal: ((await text('proposal', 'plan-change-proposal')) ?? '').includes('단계 확인하기 → 바로잡기') && (await c('proposal').locator('[data-testid="plan-save-state"]').getAttribute('data-state')) !== 'saved',
      savedChange: open && (savedChange ?? '').includes('버전 1 → 2') && (savedChange ?? '').includes('단계 확인하기 → 바로잡기') && historyTasks.some((t) => t.includes('확인하기 2문항')) && historyTasks.some((t) => t.includes('바로잡기 2문항')),
      same: (await c('same').locator('[data-testid="plan-save-state"]').getAttribute('data-state')) === 'saved' && (await text('same', 'plan-change-proposal')) === null,
      availableNull: ((await text('available-null', 'plan-change-proposal')) ?? '').includes('2문항 → 미정'),
      goalOnly: /그때 목표 80점[\s\S]*지금 목표 90점/.test((await text('goal-only', 'plan-change-proposal')) ?? '') && ((await text('goal-only', 'plan-change-proposal')) ?? '').includes('순서가 같아요'),
      readFailed: (await text('read-failed', 'plan-change-unavailable')) !== null && (await c('read-failed').locator('[data-testid="plan-history"]').count()) === 0,
      past: (await text('past', 'plan-change-proposal')) === null && (await c('past').locator('[data-testid="plan-change-none"]').count()) === 0,
    }
    const minus = c('same').locator('button[aria-label$="줄이기"]')
    await minus.focus(); await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('[data-case="same"] [data-testid="plan-change-proposal"]')?.textContent?.includes('계획량 2문항 → 1문항'))
    checks.keyboardEdit = ((await text('same','plan-change-proposal')) ?? '').includes('아직 저장하지 않았어요')
    const reset = c('same').locator('[data-testid="plan-reset"]'); await reset.focus(); await page.keyboard.press('Enter')
    await page.waitForFunction(() => !document.querySelector('[data-case="same"] [data-testid="plan-change-proposal"]'))
    checks.keyboardReset = (await c('same').locator('[data-testid="plan-save-state"]').getAttribute('data-state')) === 'saved'
    checks.noHiddenPost = requests.length === 0
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: path.join(dir, `plan-change-${width}.png`), fullPage: true })
    for (const [k, v] of Object.entries(checks)) results.push({ width, case: k, passed: v && overflow <= 1 && errors.length === 0, overflow, errors })
    results.push({ width, case: 'detail', savedChange, historyTasks, passed: true })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  if(head() !== expectedHead) throw Error('Source moved during browser check')
  const report = { tested_head:expectedHead, observed_at:new Date().toISOString(), meaningful_checks:results.filter(r=>r.case!=='detail').length, post_requests:requests.length, environment: 'actual Chromium + actual React PlanSection; fixed data; router shim; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.case, JSON.stringify({ errors: r.errors, o: r.overflow, s: r.savedChange, h: r.historyTasks }))
  console.log(report.passed, report.failed)
}
