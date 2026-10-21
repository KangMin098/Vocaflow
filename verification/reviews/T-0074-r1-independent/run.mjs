// T-0074 — 실제 React GoalPlanSummary + 실제 Chromium(고정 데이터 · 인증 Next/DB 아님): 통과 · 미측정 · 원장 불명확 대표 상태
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
  for (const width of [1440, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 300000 })
    await page.waitForSelector('[data-testid="goal-plan"]', { timeout: 180000 })
    const sum = page.locator('[data-testid="goal-plan"] summary')
    await sum.focus(); await page.keyboard.press('Enter')
    const open = await page.locator('[data-testid="goal-plan"]').evaluate((d) => d.open)
    const r1 = page.locator('li[data-task="r.central_meaning"]')
    const chips = await r1.locator('[data-testid="goal-plan-evidence"]').getAttribute('data-delay')
    const delayText = await r1.locator('[data-testid="goal-plan-evidence"]').innerText()
    const correctCurrent = delayText.includes('지금 확인 · 통과(지금 기준)')
    const missing = await page.locator('li[data-task="e.task_demand"] [data-testid="goal-plan-scope-unknown"]').innerText()
    const focusVisible = await sum.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle!=='none')
    const note = await r1.locator('[data-testid="goal-plan-scope-note"]').count()
    const r2chips = await page.locator('li[data-task="r.inference"] [data-testid="goal-plan-evidence"]').count()
    const r3unknown = await page.locator('li[data-task="r.relation"]').innerText()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const shot = path.join(dir, `criterion-scope-${width}.png`); await page.screenshot({ path: shot, fullPage: true })
    results.push({ case: `통과 행 = 지금 확인 · 시간 지나 다시 확인 아직 + 다른 날 미확인 안내 / 미측정 행 칩 없음 / 원장 불명확 안내 · 키보드 펼치기 · ${width}`, passed: correctCurrent && focusVisible && missing.includes('0개라는 뜻은 아니에요') && open && chips === 'NOT_ESTABLISHED' && delayText.includes('시간 지나 다시 확인 · 아직 근거 없음') && note === 1 && r2chips === 0 && r3unknown.includes('범위를 확인할 수 없어요') && overflow <= 1 && errors.length === 0, open, chips, correctCurrent, focusVisible, missing, note, r2chips, overflow, errors })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  const report = { environment: 'actual Chromium + actual React GoalPlanSummary; fixed data; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.case, JSON.stringify({ ...r, case: undefined, passed: undefined }))
  console.log(report.passed, report.failed)
}
