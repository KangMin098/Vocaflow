// T-0076 — 실제 React EvidenceBlock + 실제 Chromium(고정 데이터 · 인증 Next/DB 아님): 안내 연습 오답/정답 · 창작 직접 확인 · 평가 재풀이 · 기출 재시도 · 원장 불명확
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
let browser
const EXPECT = {
  'guided-wrong': { repair: '해 봤어요', items: '2' },
  'guided-right': { repair: '맞혀 봤어요', items: '2' },
  'authored-direct': { repair: null, items: '2' },
  'authored-replay': { repair: null, items: '2' },
  'kice-retry': { repair: '맞혀 봤어요', items: '2' },
  'ledger-unknown': { repair: null, items: null, unknown: true },
}
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 300000 })
    await page.waitForSelector('[data-testid="ins-evidence-claims"]', { timeout: 300000 })
    // 키보드 — 각 절 제목까지 Tab 으로 닿는다(블록 자체엔 조작 요소가 없다)
    const seen = new Set()
    for (let i = 0; i < 30 && seen.size < 6; i++) { await page.keyboard.press('Tab'); const id = await page.evaluate(() => document.activeElement?.tagName === 'H3' ? document.activeElement.id : null); if (id) seen.add(id) }
    const reached = seen.size
    const states = await page.$$eval('section[data-state]', (ss) => ss.map((s) => ({ id: s.dataset.state, repair: s.querySelector('[data-testid="ev-repair"]')?.textContent ?? '', check: s.querySelector('[data-testid="ev-check"]')?.textContent ?? '', items: s.querySelector('[data-testid="ev-check"]')?.getAttribute('data-current-items'), ledgerItems: s.querySelector('[data-testid="ev-check"]')?.getAttribute('data-ledger-items'), unknown: !!s.querySelector('[data-testid="ev-ledger-unknown"]') })))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: path.join(dir, `evidence-${width}.png`), fullPage: true })
    for (const s of states) {
      const x = EXPECT[s.id]
      const repairOk = x.repair === null ? !/맞혀 봤어요|해 봤어요/.test(s.repair) : s.repair.includes(x.repair)
      const passed = repairOk && s.items === x.items && (x.items === null ? s.check.includes('이번 판정 문항 수 확인 보류') : s.check.includes(`이번 판정의 독립 확인 ${x.items}문항`)) && !s.check.includes('문항 0개') && (x.unknown ? s.unknown && s.check.includes('확인 보류') : !s.unknown) && overflow <= 1 && errors.length === 0
      results.push({ width, state: s.id, passed, repair: s.repair, check: s.check, ledgerItems: s.ledgerItems, unknown: s.unknown, overflow, errors })
    }
    results.push({ width, state: 'keyboard', passed: reached === 6, reached })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  const report = { environment: 'actual Chromium + actual React EvidenceBlock(evidenceView 실제 계산); fixed data; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.state, JSON.stringify({ repair: r.repair, check: r.check, ledgerItems: r.ledgerItems, reached: r.reached, errors: r.errors }))
  console.log(report.passed, report.failed)
}
