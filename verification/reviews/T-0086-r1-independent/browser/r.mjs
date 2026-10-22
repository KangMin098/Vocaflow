// T-0086 — 실제 React(VocabLearningCard · WordVaultStudyClient · WordVaultBrowseClient) + Chromium 1440/1280 · 인증 Next/DB 아님
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
const wt = 'D:/workspace/Vocaflow-final-product'
const req = createRequire(`${wt}/apps/web/package.json`)
const vite = createRequire(req.resolve('vitest/package.json'))('vite')
const { chromium } = req('@playwright/test');const tw=req('tailwindcss/loadConfig')(`${wt}/apps/web/tailwind.config.ts`);tw.content=[`${wt}/apps/web/src/components/wordvault/**/*.tsx`,`${wt}/apps/web/src/components/csat/diagnosis/map/VocabLearningCard.tsx`,`${wt}/apps/web/src/components/layout/ResourceContext.tsx`,path.join(dir,'main.tsx')]
const alias = [
  { find: 'server-only', replacement: `${wt}/apps/web/src/test/server-only-stub.ts` },
  { find: '@', replacement: `${wt}/apps/web/src` },
  { find: 'next/link', replacement: path.join(dir, 'link.tsx') },
  { find: 'next/navigation', replacement: path.join(dir, 'nav.ts') },
  { find: /^lucide-react$/, replacement: path.dirname(req.resolve('lucide-react/package.json')) },
  { find: /^react$/, replacement: req.resolve('react') },
  { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') },
  { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') },
  { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') },
]
const server = await vite.createServer({ configFile: false, css:{postcss:{plugins:[req('tailwindcss')(tw)]}}, root: dir, logLevel: 'error', define: { 'process.env': '{}' }, esbuild: { jsx: 'automatic' }, resolve: { alias }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, wt] } } })
const MAP = 'from=map&map_task=v.core_meaning&ws=ws.vocab-context&map_ws=11111111-2222-4333-8444-555555555555&map_plan=3&map_goal=7'
const KEYS = ['from', 'map_task', 'ws', 'map_ws', 'map_plan', 'map_goal']
const want = new URLSearchParams(MAP)
const ctxOk = (h) => {
  const u = new URL(h, 'http://x')
  return KEYS.every((k) => u.searchParams.get(k) === want.get(k)) && !u.searchParams.has('map_item') && !u.searchParams.has('map_attempt')
}
const SCENES = [
  ['card', `scene=card&${MAP}&map_item=authored:x&map_attempt=42`],
  ['review-empty-map', `scene=review-empty&${MAP}`],
  ['review-empty-plain', 'scene=review-empty'],
  ['browse-map', `scene=browse&${MAP}&filter=set:s1&book=b1&chapter=1&map_attempt=42`],
  ['browse-plain', 'scene=browse&filter=set:s1&book=b1&chapter=1'],
]
const results = []
let browser
try {
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 1280]) for (const [name, qs] of SCENES) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    const writes = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('request', (r) => { if (r.method() !== 'GET') writes.push(r.url()) })
    await page.goto(`http://127.0.0.1:${port}/?${qs}`, { waitUntil: 'load', timeout: 300000 })
    await page.locator('a, button').first().waitFor({ timeout: 300000 })
    await page.waitForTimeout(500)
    const links = await page.locator('a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href') ?? '', id: a.getAttribute('data-testid') })))
    const browse = links.filter((l) => l.href.startsWith('/wordvault/browse'))
    const review = links.filter((l) => l.href.startsWith('/wordvault/review'))
    const ret = links.find((l) => l.id === 'vocab-map-return')
    let chapterPush = null
    if (name.startsWith('browse')) {
      const ch = page.getByLabel('챕터 선택').first()
      if (await ch.count()) {
        await ch.focus()
        await ch.selectOption({ index: 1 })
        await page.waitForTimeout(300)
        chapterPush = await page.evaluate(() => window.__nav.at(-1) ?? null)
      }
    }
    await page.evaluate(() => document.activeElement?.blur())
    await page.keyboard.press('Tab')
    const focusTag = await page.evaluate(() => document.activeElement?.tagName)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: path.join(dir, `${name}-${width}.png`) })
    const isMap = !name.endsWith('plain')
    const checks = {
      returnBar: name === 'card' ? true : isMap ? !!ret && ret.href.startsWith('/csat/diagnosis?tab=map&view=full&map_task=v.core_meaning') : !ret,
      browseCtx: name.startsWith('browse') ? true : isMap ? browse.length > 0 && browse.every((l) => ctxOk(l.href)) : browse.length > 0 && browse.every((l) => l.href === '/wordvault/browse'),
      reviewCtx: name === 'browse-map' ? review.length > 0 && review.every((l) => ctxOk(l.href)) : name === 'browse-plain' ? review.every((l) => !l.href.includes('from=map')) : true,
      chapterKeepsCtx: name === 'browse-map' ? !!chapterPush && ctxOk(chapterPush) && chapterPush.includes('chapter=2') : name === 'browse-plain' ? !!chapterPush && !chapterPush.includes('map_task') : true,
      noWrites: writes.length === 0,
      keyboard: ['A', 'BUTTON', 'INPUT', 'SELECT'].includes(focusTag),
      overflow: overflow <= 1,
      errors: errors.length === 0,
    }
    results.push({ width, name, passed: Object.values(checks).every(Boolean), checks, chapterPush, browse: browse.map((l) => l.href), review: review.map((l) => l.href), errors })
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ environment: 'actual Chromium + actual React VocabLearningCard/WordVaultStudyClient/WordVaultBrowseClient · next/navigation shim(router.push 기록) · source globals/Tailwind applied · 인증 Next/DB 아님', results, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }, null, 2) + '\n')
  for (const r of results) console.log(r.passed ? 'PASS' : 'FAIL', r.width, r.name, JSON.stringify(r.checks), r.errors.join('|').slice(0, 200))
}
