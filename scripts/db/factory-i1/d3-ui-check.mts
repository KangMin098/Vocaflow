// scripts/db/factory-i1/d3-ui-check.mts
// Permanent PC harness for the real component + compiled application CSS. No dotenv/auth/DB.
// pnpm exec tsx --tsconfig apps/web/scripts/tsconfig.harness.json scripts/db/factory-i1/d3-ui-check.mts
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { ProductOrderLineageView } from '../../../apps/web/src/components/admin/csat-diagnosis/ProductOrderLineageView'
import type { ProductOrderLineage } from '../../../apps/web/src/lib/admin/product-order-lineage'

const require = createRequire(import.meta.url)
const web = path.resolve('apps/web')
const resolve = (name: string) => require.resolve(name, { paths: [web] })
const { createElement } = require(resolve('react'))
const { renderToStaticMarkup } = require(resolve('react-dom/server'))
const { chromium } = require(resolve('@playwright/test'))
const { default: AxeBuilder } = await import(pathToFileURL(resolve('@axe-core/playwright')).href)
const build = path.join(web, '.next-lineage-build')
const staticDir = path.join(build, 'static')
const cssFiles = fs
  .readdirSync(staticDir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.css'))
assert.ok(cssFiles.length, 'Compile production CSS before visual QA')
const css = cssFiles.map((f) => fs.readFileSync(path.join(staticDir, f), 'utf8')).join('\n')
const out = path.resolve('.agent-logs/d3-ui')
fs.mkdirSync(out, { recursive: true })
const row = (
  status: 'current' | 'withdrawn' | 'superseded' | 'personal_order_changed',
  i: number
) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  order_id: '00000000-0000-4000-8000-000000000001',
  product_order_id: `TPO-example-${i}`,
  order_revision: i,
  order_hash: 'a'.repeat(64),
  quantity: 2,
  product_quantity: 4,
  created_at: '2026-10-20T00:00:00Z',
  product_current: status === 'current' || status === 'personal_order_changed',
  personal_current: status !== 'personal_order_changed',
  status,
})
const cases: Record<string, ProductOrderLineage> = {
  not_installed: { status: 'not_installed' },
  error: { status: 'error' },
  empty: { status: 'installed', rows: [], total: 0, limited: false },
  history: {
    status: 'installed',
    total: 4,
    limited: false,
    rows: ['current', 'withdrawn', 'superseded', 'personal_order_changed'].map((s, i) =>
      row(s as Parameters<typeof row>[0], i + 1)
    ),
  },
}
const html = (
  result: ProductOrderLineage
) => `<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><title>주문 계보 PC 검증</title><style>${css}</style></head>
<body><main data-area="admin" class="min-h-screen bg-[var(--bg2)] p-6"><section class="rounded border border-[var(--bd)] bg-[var(--bg)] p-6"><h1 class="text-lg font-semibold">공용 생산 주문 계보 — 격리 표시 검증</h1><p class="text-sm">실제 컴포넌트와 빌드 CSS · 고정 fixture · 공유 DB 미연결</p>${renderToStaticMarkup(createElement(ProductOrderLineageView, { result }))}</section></main></body></html>`
const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', 'http://localhost')
  const name = url.pathname.slice(1)
  if (cases[name]) {
    res.setHeader('content-type', 'text/html;charset=utf-8')
    res.end(html(cases[name]))
    return
  }
  if (url.pathname.startsWith('/_next/static/')) {
    const file = path.resolve(staticDir, url.pathname.slice('/_next/static/'.length))
    if (
      file.startsWith(staticDir + path.sep) &&
      fs.existsSync(file) &&
      fs.statSync(file).isFile()
    ) {
      res.end(fs.readFileSync(file))
      return
    }
  }
  res.writeHead(404)
  res.end()
})
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const address = server.address() as { port: number }
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch()
const results: unknown[] = []
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  await page.route(
    '**/*',
    (route: {
      request: () => { url: () => string }
      continue: () => Promise<void>
      abort: () => Promise<void>
    }) =>
      route
        .request()
        .url()
        .startsWith(origin + '/')
        ? route.continue()
        : route.abort()
  )
  for (const name of Object.keys(cases)) {
    await page.goto(`${origin}/${name}`)
    const summary = page.locator('[data-product-order-lineage] summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('[data-product-order-lineage]').getAttribute('open'), '')
    const box = await summary.boundingBox()
    assert.ok(box && box.height >= 44)
    assert.notEqual(
      await summary.evaluate((el: HTMLElement) => getComputedStyle(el).outlineStyle),
      'none'
    )
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    )
    if (name === 'history') {
      assert.equal(await page.locator('tbody tr').count(), 4)
      for (const text of ['현재 계획 연결', '철회된 주문', '이전 주문 판', '개인 계획·주문 변경'])
        assert.ok((await page.textContent('main')).includes(text))
    }
    const a11y = await new AxeBuilder({ page }).analyze()
    assert.deepEqual(
      a11y.violations.map((v: { id: string }) => v.id),
      []
    )
    const screenshot = path.join(out, `${name}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    results.push({ name, screenshot, summaryHeight: box.height, a11yViolations: 0 })
  }
  assert.deepEqual(errors, [])
  fs.writeFileSync(
    path.join(out, 'proof.json'),
    JSON.stringify(
      {
        viewport: { width: 1440, height: 900 },
        cssFiles,
        results,
        limitation:
          'Real component rendered with fixtures and compiled CSS. No production authentication, populated shared-DB lineage or whole-screen pixel equivalence claim.',
      },
      null,
      2
    ) + '\n'
  )
  process.stdout.write(
    '4 PC component states PASS; keyboard, 44px, overflow, axe; shared DB calls 0\n'
  )
} finally {
  await browser.close()
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
}
