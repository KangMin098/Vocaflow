// scripts/design/csat-map-dialog-check.mjs — isolated real UI; no account/DB acceptance claim.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
const root = process.cwd(), require = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(require.resolve('vitest/package.json'))('esbuild')
const { chromium } = require('@playwright/test')
const out = process.env.CSAT_DIALOG_OUT || 'tmp/csat-map-dialog'
fs.mkdirSync(out, { recursive: true })
const built = await build({
  entryPoints: ['scripts/design/fixtures/csat-map-dialog.tsx'], bundle: true, write: false, outdir: 'tmp/csat-dialog-built',
  platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'apps/web/tsconfig.json', nodePaths: [path.join(root, 'apps/web/node_modules')],
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolate-data-and-navigation', setup(p) {
    p.onResolve({ filter: /^next\/(link|navigation)$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    p.onResolve({ filter: /^@\/lib\/(analytics\/client|csat\/map\/v4\/compose)$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    p.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'jsx', resolveDir: path.join(root, 'apps/web'), contents:
      a.path === 'next/link' ? 'import React from "react";export default function Link({children,...props}){return <a {...props} onClick={e=>e.preventDefault()}>{children}</a>}' :
      a.path === 'next/navigation' ? 'export function useRouter(){return {refresh(){},push(){},replace(){}}}' :
      a.path.includes('analytics') ? 'export function track(){}' : 'export function composeV4(){return globalThis.fixtureView} export function confirmLinksOf(){return {}} export function savedTransferOf(){return {}}' }))
  } }],
})
const css = fs.readFileSync('apps/web/.next-dev/static/css/app/layout.css', 'utf8') + '\n' + fs.readFileSync('packages/design-tokens/src/skins/csat-app.css', 'utf8') + '\n' + built.outputFiles.find(f => f.path.endsWith('.css')).text
const js = built.outputFiles.find(f => f.path.endsWith('.js')).text
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : req.url === '/app.css' ? 'text/css' : 'text/html; charset=utf-8')
  res.end(req.url === '/app.js' ? js : req.url === '/app.css' ? css : '<!doctype html><html lang="ko" data-skin="tines"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><title>CSAT synthetic UI regression</title><body><div id="root"></div><script src="/app.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch(), results = [], forbidden = []
try {
  for (const width of [1440, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (req.method() !== 'GET' || url.origin !== base) { forbidden.push(req.method() + ' ' + url.pathname); return route.abort() }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { status: 'installed', rows: [], sources: 0 } })
      return route.continue()
    })
    await context.addInitScript(t => { localStorage.setItem('csat-rail', 'open'); addEventListener('DOMContentLoaded', () => document.documentElement.dataset.theme = t) }, theme)
    const page = await context.newPage(), errors = []
    page.setDefaultTimeout(10000)
    page.on('pageerror', e => { errors.push(e.message); console.error('UI_ERROR', e.stack) })
    await page.goto(base, { waitUntil: 'networkidle' })
    const node = page.locator('[data-node="r.central_meaning"]')
    await node.waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.getByTestId('ws-list').getAttribute('data-view'), 'board')
    await page.screenshot({ path: `${out}/map-board-${width}-${theme}.png`, fullPage: true })
    await node.click()
    let dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await page.getByTestId('task-pop').count(), 0)
    assert.equal(await page.getByTestId('ins-drawer').count(), 0)
    await dialog.evaluate(el => el.dataset.fixturePersistent = 'same-dialog')
    await page.screenshot({ path: `${out}/task-overview-${width}-${theme}.png` })
    await page.getByTestId('detail-tab-evidence').click()
    await page.getByTestId('task-inspector').waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await dialog.getAttribute('data-fixture-persistent'), 'same-dialog')
    await page.screenshot({ path: `${out}/task-evidence-${width}-${theme}.png` })
    const legacy = page.getByTestId('inspector-evidence-detail')
    if (await legacy.count()) {
      const ancestors = dialog.locator('details').filter({ has: legacy })
      for (let i = 0; i < await ancestors.count(); i++) {
        if (await ancestors.nth(i).getAttribute('open') === null) await ancestors.nth(i).locator(':scope > summary').click()
      }
      await legacy.click()
      await page.locator('[data-step-sheet]').waitFor()
      assert.equal(await dialog.count(), 1, 'Legacy evidence stays embedded in the same dialog')
      assert.equal(await page.locator('[data-step-sheet]').getAttribute('role'), 'region')
      await page.getByRole('button', { name: '기출 근거 접기', exact: true }).click()
    }
    await page.getByTestId('ws-tab-plan').click()
    await page.getByTestId('plan-section').waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await dialog.getAttribute('data-fixture-persistent'), 'same-dialog')
    await page.screenshot({ path: `${out}/plan-${width}-${theme}.png` })
    await page.getByTestId('ws-tab-overview').click()
    await page.getByTestId('detail-workspace-link').first().click()
    await page.getByTestId('ws-modal').waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await dialog.getAttribute('data-fixture-persistent'), 'same-dialog')
    await page.screenshot({ path: `${out}/workspace-${width}-${theme}.png` })
    // Arrow keys change tabs within the same dialog. Tab remains trapped; Escape restores the node.
    await page.getByTestId('ws-tab-overview').focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.getByTestId('detail-tab-evidence').getAttribute('aria-selected'), 'true')
    await dialog.locator('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]').last().focus()
    await page.keyboard.press('Tab')
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true)
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
    assert.equal(await node.evaluate(el => document.activeElement === el), true)
    assert.equal(await page.locator('body').evaluate(el => el.style.overflow), '')
    // Both list and card entry points open the same detail surface.
    await page.getByTestId('ws-view-list').click()
    assert.equal(await page.getByTestId('ws-list').getAttribute('data-view'), 'list')
    await page.screenshot({ path: `${out}/workspace-list-${width}-${theme}.png`, fullPage: true })
    const trigger = page.getByTestId('ws-select').first()
    await trigger.click(); await page.getByTestId('ws-modal').waitFor()
    assert.equal(await dialog.count(), 1)
    await dialog.locator('..').click({ position: { x: 2, y: 2 } })
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate(el => document.activeElement === el), true)
    const hold = page.locator('[data-testid="umap-node"][data-hold="true"]').first()
    await hold.click(); await dialog.waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await page.getByTestId('ws-tab-plan').isDisabled(), true)
    await page.getByTestId('detail-tab-evidence').click()
    await page.getByTestId('task-inspector').waitFor()
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
    assert.equal(await hold.evaluate(el => document.activeElement === el), true)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    assert.equal(overflow, 0)
    assert.deepEqual(errors, [])
    results.push({ width, theme, dialogs: 1, sameDialogAcrossTabs: true, focusRestored: true, overflow, errors })
    await context.close()
    console.log(`PASS ${width} ${theme}: single dialog, tabs, workspace links, keyboard, board/list`)
  }
  const geometryPage = await browser.newPage({ viewport: { width: 2094, height: 950 } })
  await geometryPage.route('**/api/**', r => r.fulfill({ json: { status: 'installed', rows: [], sources: 0 } }))
  await geometryPage.goto(base + '/?full', { waitUntil: 'networkidle' })
  const geometry = await geometryPage.evaluate(() => {
    const node = document.querySelector('[data-testid="umap-node"]').getBoundingClientRect()
    const cols = [...document.querySelectorAll('section[data-domain]')].map(el => el.getBoundingClientRect().x)
    return { node: [node.width, node.height], pitch: cols[1] - cols[0] }
  })
  assert.deepEqual(geometry, { node: [206, 46], pitch: 272 })
  await geometryPage.locator('[data-node="r.central_meaning"]').click()
  await geometryPage.getByRole('dialog').waitFor()
  const modal = await geometryPage.getByRole('dialog').evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height] })
  assert.deepEqual(modal, [1040, 800])
  results.push({ fullMap: geometry, detailDialog: modal })
  await geometryPage.close()
  assert.deepEqual(forbidden, [], 'No account, DB or mutation requests')
} finally { await browser.close(); server.close(); fs.writeFileSync(`${out}/result.json`, JSON.stringify({ results, forbidden }, null, 2)) }
