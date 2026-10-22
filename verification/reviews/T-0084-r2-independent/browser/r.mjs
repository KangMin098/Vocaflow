// T-0084 — 실제 React AdminKpiGrid + 실제 fmt · Chromium 1440/1280(고정 learners · 인증 Next/DB 아님)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test'); const tw=req('tailwindcss/loadConfig')(`${wt}/apps/web/tailwind.config.ts`); tw.content=[`${wt}/apps/web/src/components/admin/AdminKpiGrid.tsx`,path.join(dir,'main.tsx')]
const server = await vite.createServer({ configFile: false, css:{postcss:{plugins:[req('tailwindcss')(tw)]}}, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias: [{ find: 'server-only', replacement: `${wt}/apps/web/src/test/server-only-stub.ts` }, { find: '@', replacement: `${wt}/apps/web/src` }, { find: 'next/link', replacement: path.join(dir, 'link.tsx') }, { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') }, { find: /^lucide-react$/, replacement: createRequire(req.resolve('react')).resolve !== undefined ? path.dirname(req.resolve('lucide-react/package.json')) : '' }, { find: /^react$/, replacement: req.resolve('react') }, { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') }, { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') }, { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') }] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const results = []
let browser
try {
  await server.listen(); const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) for (const state of ['verified', 'zero', 'unavailable']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message) }); page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text())); page.on('response', async (r) => r.status() >= 500 && console.log('R500', r.url(), (await r.text()).slice(0, 300)))
    await page.goto(`http://127.0.0.1:${port}/?state=${state}`, { waitUntil: 'load', timeout: 60000 })
    await page.locator('li').first().waitFor({ timeout: 60000 })
    const cards = await page.locator('li').evaluateAll((ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ')))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const clipped = await page.locator('li *').evaluateAll((es) => es.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'hidden').length)
    await page.keyboard.press('Tab')
    const focusTrap = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY')
    await page.screenshot({ path: path.join(dir, `kpi-${state}-${width}.png`) })
    const main = state === 'verified' ? ['3', '12', '3'] : state === 'zero' ? ['0', '0', '0'] : ['—', '—', '—']
    const checks = {
      mainValue: cards.slice(0, 3).every((c, i) => new RegExp(`(^| )${main[i]}( |$)`).test(c)),
      allScope: cards[0].includes('전체 계정 오늘 4(내부·미분류 포함)') && cards[1].includes('전체 계정 65(내부·미분류 포함)'),
      notMixed: !cards.slice(0, 3).some((c) => / 65 /.test(` ${c.split(' ').slice(0, 3).join(' ')} `)),
      zeroVsUnknown: state === 'zero' ? !cards[1].includes('—') : state === 'unavailable' ? cards[1].includes('—') && !/실사용 학습자 0/.test(cards.join(' ')) : true,
      overflow: overflow <= 1 && clipped === 0, keyboardNoTrap: ['BODY', 'A', 'BUTTON'].includes(focusTrap), errors: errors.length === 0,
    }
    results.push({ width, state, passed: Object.values(checks).every(Boolean), checks, cards })
    await page.close()
  }
} finally {
  if (browser) await browser.close(); await server.close()
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ environment: 'actual Chromium + actual React AdminKpiGrid · fmt 동일 식 · KPI 문자열은 page.tsx 정의와 같은 식(서버 컴포넌트라 직접 렌더 불가) · Tailwind + actual globals/admin skin applied; copied page KPI expressions, not authenticated Next · 인증 Next/DB 아님', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.state, JSON.stringify(r.checks), r.cards[1])
}
