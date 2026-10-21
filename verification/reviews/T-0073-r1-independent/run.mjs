// T-0073 — 실제 React GoalRecordBar + 실제 Chromium(데이터 고정 · 인증 Next/DB 아님): 시험 기록 0 · 목표 있음 → 미측정 안내 + 실제 다음 행동(키보드) + 기출 기록 보조
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
  const open = async (qs, width) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.error('PAGEERROR', e.message) })
    page.on('console', (m) => { if (m.type() === 'error') console.error('BROWSER', m.text()) })
    await page.goto(`http://127.0.0.1:${port}/?${qs}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="umap-top"]', { timeout: 15000 })
    return { page, errors }
  }
  for (const width of [1440, 1280]) {
    const x = await open('', width)
    const state = await x.page.locator('[data-testid="umap-top"]').getAttribute('data-state')
    const note = await x.page.locator('[data-testid="umap-no-record-note"]').innerText().catch(() => '')
    const cta = x.page.locator('[data-testid="umap-top-next"]')
    const kind = await cta.getAttribute('data-kind')
    const record = await x.page.locator('[data-testid="focus-record"]').innerText().catch(() => '')
    await cta.focus(); const focused = await cta.evaluate((el) => el === document.activeElement)
    await x.page.keyboard.press('Enter')
    const opened = await x.page.evaluate(() => window.__opened)
    const overflow = await x.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const shot = path.join(dir, `no-record-${width}.png`); await x.page.screenshot({ path: shot, fullPage: true })
    results.push({ case: `기록 0 · 목표 → 미측정 안내 + 계획 확정(키보드 → 같은 Workspace 계획 탭) + 기록 보조 · ${width}`, passed: state === 'no_record' && note.includes('약점으로 정한 것은 없어요') && kind === 'plan' && record.includes('기출 한 회 기록하기') && focused && JSON.stringify(opened) === JSON.stringify([['ws.central-meaning', 'plan']]) && overflow <= 1 && x.errors.length === 0, state, kind, record, focused, opened, overflow, errors: x.errors })
    await x.page.close()
  }
  for (const [qs, label] of [['goal=0', '목표 없음'], ['past=1', '과거 보기']]) {
    const x = await open(qs, 1440)
    const n = await x.page.locator('[data-testid="umap-top-next"]').count()
    results.push({ case: `대조 — ${label}: 실행 행동 없음`, passed: n === 0 && x.errors.length === 0, n })
    await x.page.close()
  }

  {
    const x=await open('case=start',1440);const c=x.page.locator('[data-testid="umap-top-next"]');const tag=await c.evaluate(el=>el.tagName);const kind=await c.getAttribute('data-kind');const href=await c.getAttribute('href');
    results.push({case:'Independent: actual start is a return-context link, not data-kind start',passed:tag==='A'&&kind===null&&new URL(href,'http://x').searchParams.get('from')==='map',tag,kind,href});await x.page.close();
  }
  {
    const x=await open('case=direct',1280);const state=await x.page.locator('[data-testid="umap-top"]').getAttribute('data-state');
    results.push({case:'Independent: existing direct evidence changes no-record state even with zero exams',passed:state!=='no_record',state});await x.page.close();
  }
} finally {
  if (browser) await browser.close(); await server.close()
  const report = { environment: 'actual Chromium + actual React GoalRecordBar; fixed data; no auth Next/DB', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.case, JSON.stringify({ ...r, case: undefined, passed: undefined }))
  console.log(report.passed, report.failed)
}
