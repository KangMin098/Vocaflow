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
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) for (const c of ['direct', 'error', 'empty', 'partial', 'held']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = [], posts = []; page.on('pageerror', (e) => errors.push(e.message))
    const beacons = []; await page.route('**/api/**', (r) => { if (r.request().method() === 'POST') (new URL(r.request().url()).pathname === '/api/analytics/event' ? beacons : posts).push(new URL(r.request().url()).pathname); return r.fulfill({ json: {} }) })
    await page.addInitScript(() => { window.__refreshes = 0; window.__refresh = () => { window.__refreshes++ } })
    await page.goto(`http://127.0.0.1:${port}/?case=${c}`, { waitUntil: 'load', timeout: 300000 })
    await page.waitForSelector('[data-testid="home-suggest"]', { timeout: 300000 })
    const sug = page.locator('[data-testid="home-suggest"]')
    const kind = await sug.getAttribute('data-kind'), text = await sug.innerText()
    let ok = false, extra = {}
    if (c === 'direct') {
      const a = sug.locator('a[href="#umap-h"]'); await a.focus(); await page.keyboard.press('Enter')
      const hash = await page.evaluate(() => location.hash)
      ok = kind === 'check' && !/시험 기록이 없|기록을 넣으면/.test(text) && hash === '#umap-h'; extra = { hash }
    } else if (c === 'error') {
      const b = page.locator('[data-testid="home-map-retry"]'); await b.focus(); await page.keyboard.press('Enter')
      const n = await page.evaluate(() => window.__refreshes)
      ok = kind === 'error' && text.includes('기록이 없다는 뜻이 아니에요') && n === 1; extra = { refreshes: n }
     } else if(c === 'partial') { const actual = sug.locator('[data-testid="home-continue-check-go"]');const href=await actual.getAttribute('href');const wrongSelectorCount=await sug.locator('a[href="#umap-h"]').count();await actual.focus();ok=kind==='continue_check'&&href.includes('task=r.central_meaning')&&href.includes('ws=ws.central-meaning');extra={href,wrongSelectorCount,keyboardFocus:await actual.evaluate(e=>document.activeElement===e)}; } else if(c === 'held') {ok=kind==='withheld'&&text.includes('기록이 없다는 뜻이 아니에요')} else {
      ok = kind === 'no_records' && text.includes('약점을 정한 것은 아니에요') && !text.includes('기록을 넣으면 그려져요')
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: path.join(dir, `home-${c}-${width}.png`) })
    results.push({ width, case: c, passed: ok && overflow <= 1 && errors.length === 0 && posts.length === 0, kind, overflow, errors, posts, beacons: beacons.length, ...extra })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  const report = { tested_head: '26a7be72ed932959fd6024b6aa547beb6e367f3f', environment: 'actual Chromium + actual React HomeLanding; actual compose+homeFocus+homeProgress derived props; mapData null, map body excluded; router/link shim; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.case, JSON.stringify({ kind: r.kind, o: r.overflow, e: r.errors, p: r.posts, h: r.hash, n: r.refreshes }))
  console.log(report.passed, report.failed)
}
