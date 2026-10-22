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
const spec = JSON.parse(fs.readFileSync('docs/design/refs/3b/access-map/spec.json', 'utf8')).modal
fs.mkdirSync(out, { recursive: true })
const built = await build({
  entryPoints: ['scripts/design/fixtures/csat-map-dialog.tsx'], bundle: true, write: false, outdir: 'tmp/csat-dialog-built',
  platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'apps/web/tsconfig.json', nodePaths: [path.join(root, 'apps/web/node_modules')],
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolate-data-and-navigation', setup(p) {
    p.onResolve({ filter: /^next\/(link|navigation)$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    p.onResolve({ filter: /\/useCsatRecord$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    p.onResolve({ filter: /^@\/lib\/(analytics\/client|csat\/map\/v4\/compose)$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    p.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'jsx', resolveDir: path.join(root, 'apps/web'), contents:
      a.path === 'next/link' ? 'import React from "react";export default function Link({children,...props}){return <a {...props} onClick={e=>e.preventDefault()}>{children}</a>}' :
      a.path === 'next/navigation' ? 'export function useRouter(){return {refresh(){},push(){},replace(){}}}' :
      a.path.endsWith('/useCsatRecord') ? 'export function useCsatRecord(){return {record:{completed:[],predictions:[],queue:[],active:null,views:[],sessions:[]},synced:false,dueBefore:0,now:1792594800000}}' :
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
  for (const width of process.env.CSAT_ENTRY_ONLY ? [] : [1440, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (req.method() !== 'GET' || url.origin !== base) { forbidden.push(req.method() + ' ' + url.pathname); return route.abort() }
      if (url.pathname === '/api/csat/item-finder') return route.fulfill({ json: { ok: true, catalog: {
        items: [{ id: '2026#20', exam_id: '2026', no: 20, type_id: 'main', points: 2, lecture: false, sec: 0, map: true }],
        exams: [{ id: '2026', label: '합성 검증 회차', kind: 'suneung', year: 2026, month: null, grade: null, items: 1 }],
        types: [{ id: 'main', name: '글의 핵심', status: 'active', items: 1 }],
      } } })
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
    assert.equal(await page.getByTestId('ws-list').getAttribute('data-view'), 'list')
    await page.screenshot({ path: `${out}/map-list-${width}-${theme}.png`, fullPage: true })
    await node.click()
    let dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(await dialog.count(), 1)
    const hiddenCriterion = dialog.locator('details').filter({ hasText: '무엇을 확인하나요?' }).first()
    assert.equal(await hiddenCriterion.getAttribute('open'), null, 'Detailed criterion starts folded')
    await hiddenCriterion.locator('summary').click()
    assert.equal(await hiddenCriterion.locator('p').isVisible(), true)
    await hiddenCriterion.locator('summary').click()
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
    assert.equal(await page.locator('#learning-detail-panel').evaluate(el => el.parentElement.scrollTop), 0, 'A new tab starts at its heading')
    const planExplanation = page.getByTestId('plan-section').locator('details').filter({ hasText: '학습 목표 · 판단 기준' }).first()
    assert.equal(await planExplanation.getAttribute('open'), null)
    await planExplanation.locator('summary').click()
    assert.equal(await planExplanation.locator('p').first().isVisible(), true)
    await planExplanation.locator('summary').click()
    await page.getByTestId('plan-qty').first().waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await dialog.getAttribute('data-fixture-persistent'), 'same-dialog')
    await page.screenshot({ path: `${out}/plan-${width}-${theme}.png` })
    await page.getByTestId('ws-tab-overview').click()
    await page.getByTestId('detail-workspace-link').first().click()
    await page.getByTestId('ws-modal').waitFor()
    assert.equal(await dialog.count(), 1)
    assert.equal(await dialog.getAttribute('data-fixture-persistent'), 'same-dialog')
    await page.screenshot({ path: `${out}/workspace-${width}-${theme}.png` })
    assert.equal(await dialog.locator('ol > li svg').count() >= 4, true, 'Stages have distinct icons')
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
    // Workspaces stay in the list; selecting a row opens the same detail surface.
    assert.equal(await page.getByRole('group', { name: 'Workspace 표시 방식' }).count(), 0)
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
    for (const popup of ['finder', 'record', 'record-detail', 'step', 'goal']) {
      const popupPage = await context.newPage(), popupErrors = []
      popupPage.on('pageerror', e => popupErrors.push(e.message))
      await popupPage.goto(base, { waitUntil: 'networkidle' })
      await popupPage.getByTestId(`fixture-${popup}`).click()
      const popupDialog = popupPage.getByRole('dialog')
      await popupDialog.waitFor()
      const frame = popup.startsWith('record') ? popupDialog.locator(':scope > div').first() : popupDialog
      const measure = async () => frame.evaluate(el => {
        const rect = el.getBoundingClientRect(), head = el.firstElementChild.getBoundingClientRect(), foot = el.lastElementChild.getBoundingClientRect()
        return { box: [rect.width, rect.height], head: head.height, foot: foot.height, overflow: el.scrollWidth - el.clientWidth }
      })
      const dimensions = await measure()
      assert.deepEqual(dimensions, { box: [spec.w, spec.h], head: spec.headH, foot: spec.footH, overflow: 0 }, popup)
      if (popup === 'finder') {
        await popupPage.locator('[data-exam="2026"]').click()
        await popupPage.locator('[data-item="2026#20"]').click()
        await popupPage.getByTestId('item-finder-summary').getByText(/20번 · 글의 핵심/).waitFor()
        await popupPage.getByTestId('item-finder-extra').click()
        assert.equal(await popupPage.getByTestId('item-finder-extra-panel').isVisible(), true)
      }
      if (popup === 'record') {
        await popupPage.locator('select').last().selectOption('synthetic-exam')
        await popupPage.getByRole('button', { name: '답안', exact: true }).click()
      }
      if (popup === 'record-detail') await popupPage.getByRole('button', { name: '답안', exact: true }).click()
      if (popup === 'goal') {
        await popupPage.getByTestId('goal-more').locator('summary').click()
        assert.equal(await popupPage.getByTestId('goal-exam').isVisible(), true)
        await popupPage.keyboard.press('Escape')
        await popupDialog.waitFor({ state: 'detached' })
        assert.equal(await popupPage.getByTestId('fixture-goal').evaluate(el => el === document.activeElement), true)
        await popupPage.getByTestId('fixture-goal').click()
      }
      await popupPage.screenshot({ path: `${out}/${popup}-${width}-${theme}.png` })
      await popupPage.setViewportSize({ width, height: 720 })
      const short = await measure()
      assert.deepEqual(short.box, [spec.w, 656], 'Short PC viewport clamps height')
      assert.equal(short.head, spec.headH); assert.equal(short.foot, spec.footH)
      assert.equal(short.overflow, 0)
      await popupPage.screenshot({ path: `${out}/${popup}-${width}-${theme}-short.png` })
      assert.deepEqual(popupErrors, [])
      results.push({ popup, width, theme, dimensions, shortViewport: short, errors: popupErrors })
      await popupPage.close()
    }
    const homePage = await context.newPage(), homeErrors = []
    homePage.on('pageerror', e => homeErrors.push(e.message))
    await homePage.goto(base + '/?home', { waitUntil: 'networkidle' })
    const flow = homePage.getByRole('list', { name: '첫 학습 순서' })
    await flow.waitFor()
    assert.equal(await flow.getByRole('listitem').count(), 3)
    assert.equal(await flow.locator('svg').count(), 5)
    assert.equal(await homePage.getByTestId('home-banner-art').isVisible(), true)
    assert.equal(await homePage.getByTestId('home-tab-workspace').getAttribute('aria-selected'), 'true')
    assert.equal(await homePage.locator('#umap-h').isVisible(), false, 'First entry shows only the workspace surface')
    assert.equal(await homePage.getByTestId('csat-rail').getByTestId('home-mine').isVisible(), true)
    assert.equal(await homePage.getByTestId('csat-rail').getByTestId('home-finder-open').isVisible(), true)
    assert.ok(await homePage.getByTestId('home-mine').getByRole('link').first().evaluate(el => el.getBoundingClientRect().height) >= 44)
    await homePage.screenshot({ path: `${out}/home-${width}-${theme}.png`, fullPage: true })
    const homeWorkspace = homePage.getByTestId('ws-select').first()
    await homeWorkspace.click()
    assert.equal(await homePage.getByRole('dialog').count(), 1)
    await homePage.keyboard.press('Escape')
    await homePage.getByRole('dialog').waitFor({ state: 'detached' })
    assert.equal(await homeWorkspace.evaluate(el => el === document.activeElement), true)
    assert.equal(await homePage.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0)
    await homePage.screenshot({ path: `${out}/home-selected-${width}-${theme}.png`, fullPage: true })
    await homePage.getByTestId('home-tab-map').click()
    assert.equal(await homePage.locator('#umap-h').isVisible(), true)
    assert.equal(await homePage.getByTestId('home-workspace-panel').isVisible(), false)
    await homePage.getByTestId('home-tab-map').focus()
    await homePage.keyboard.press('ArrowLeft')
    assert.equal(await homePage.getByTestId('home-tab-workspace').getAttribute('aria-selected'), 'true')
    const homeMapLink = homePage.getByRole('button', { name: /지도에서 관련 TASK 보기/ }).first()
    await homeMapLink.click()
    assert.equal(await homePage.getByTestId('home-tab-map').getAttribute('aria-selected'), 'true')
    await homePage.locator('[data-node="r.central_meaning"]').waitFor({ state: 'visible' })
    await homePage.screenshot({ path: `${out}/home-map-${width}-${theme}.png`, fullPage: true })
    await homePage.getByTestId('home-tab-workspace').click()
    await homePage.goto(base + '/?home&resume', { waitUntil: 'networkidle' })
    assert.equal(await homePage.getByTestId('home-tab-map').getAttribute('aria-selected'), 'true', 'Learning return reveals the map immediately')
    assert.equal(await homePage.locator('#umap-h').isVisible(), true)
    assert.deepEqual(homeErrors, [])
    results.push({ home: true, width, theme, visualSteps: 3, workspaceFirst: true, mapInitiallyHidden: true, keyboardTabs: true, banner: true, errors: homeErrors })
    await homePage.close()
    await context.close()
    console.log(`PASS ${width} ${theme}: single dialog, tabs, workspace links, keyboard, workspace list`)
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
  assert.deepEqual(modal, [spec.w, spec.h])
  results.push({ fullMap: geometry, detailDialog: modal })
  await geometryPage.close()
  const entryPage = await browser.newPage({ viewport: { width: 1918, height: 982 } })
  await entryPage.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET' || url.origin !== base) { forbidden.push(request.method() + ' ' + url.pathname); return route.abort() }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { status: 'installed', rows: [], sources: 0 } })
    return route.continue()
  })
  await entryPage.goto(base + '/?home', { waitUntil: 'networkidle' })
  assert.equal(await entryPage.getByTestId('csat-rail').getAttribute('data-collapsed'), 'false', 'First device opens the full home rail')
  assert.equal(await entryPage.getByTestId('home-tab-workspace').getAttribute('aria-selected'), 'true')
  assert.equal(await entryPage.locator('#umap-h').isVisible(), false)
  assert.equal(await entryPage.getByTestId('home-banner-art').isVisible(), true)
  await entryPage.screenshot({ path: `${out}/home-first-entry-1918.png`, fullPage: true })
  results.push({ firstDevice: true, width: 1918, height: 982, workspaceDefault: true, expandedRail: true })
  await entryPage.close()
  assert.deepEqual(forbidden, [], 'No account, DB or mutation requests')
  console.table(results.filter(r => r.popup && r.width === 1440 && r.theme === 'light').map(r => ({ 팝업: r.popup, '참조(px)': `${spec.w}×${spec.h} / ${spec.headH} / ${spec.footH}`, '구현(px)': `${r.dimensions.box.join('×')} / ${r.dimensions.head} / ${r.dimensions.foot}` })))
} finally { await browser.close(); server.close(); fs.writeFileSync(`${out}/result.json`, JSON.stringify({ results, forbidden }, null, 2)) }
