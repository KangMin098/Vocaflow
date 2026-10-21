// scripts/design/workspace-popup-isolated-check.mjs — real components, isolated props; NOT normal-route acceptance.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const root = process.cwd(), require = createRequire(path.join(root, 'apps/web/package.json'))
const fromVitest = createRequire(require.resolve('vitest/package.json'))
const { build } = fromVitest('esbuild'), { chromium } = require('@playwright/test')
const out = process.env.WORKSPACE_POPUP_OUT || 'tmp/workspace-popups/before'
fs.mkdirSync(out, { recursive: true })
const built = await build({
  entryPoints: ['scripts/design/fixtures/workspace-popups.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'apps/web/tsconfig.json',
  nodePaths: [path.join(root, 'apps/web/node_modules')], define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'no-learning-or-navigation', setup(plugin) {
    plugin.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'isolated' }))
    plugin.onResolve({ filter: /^@\/lib\/(library\/complete-chapter|supabase\/client)$/ }, args => ({ path: args.path, namespace: 'isolated' }))
    plugin.onLoad({ filter: /.*/, namespace: 'isolated' }, args => ({ loader: 'jsx', resolveDir: path.join(root, 'apps/web'), contents:
      args.path === 'next/link' ? 'import React from "react";export default function Link({children,onClick,...props}){return <a {...props} onClick={e=>{e.preventDefault();onClick?.(e)}}>{children}</a>}' :
      args.path === 'next/navigation' ? 'export function useRouter(){return{refresh(){throw Error("Navigation disabled in fixture")},push(){throw Error("Navigation disabled in fixture")}}}' :
      args.path.includes('complete-chapter') ? 'export function completeChapter(){throw Error("Learning writes disabled in fixture")}' :
      'export function createClient(){throw Error("Database access disabled in fixture")}' }))
  } }],
})
const html = '<!doctype html><html lang="ko" data-skin="tines"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><title>Isolated real workspace components</title><body><div id="root"></div><script>document.documentElement.dataset.theme=new URLSearchParams(location.search).get("theme")||"light"</script><script src="/fixture.js"></script></body></html>'
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html) }
  if (pathname === '/fixture.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(built.outputFiles[0].contents) }
  if (pathname === '/app.css') { res.setHeader('Content-Type', 'text/css'); return fs.createReadStream('apps/web/.next-dev/static/css/app/layout.css').pipe(res) }
  // Public font files only; arbitrary workspace/auth paths remain inaccessible.
  if (pathname.startsWith('/_next/static/media/')) {
    const name = pathname.slice('/_next/static/media/'.length)
    if (/^[a-z0-9._-]+\.woff2?$/i.test(name)) {
      const file = path.join(root, 'apps/web/.next-dev/static/media', name)
      if (fs.existsSync(file)) { res.setHeader('Content-Type', name.endsWith('woff2') ? 'font/woff2' : 'font/woff'); return fs.createReadStream(file).pipe(res) }
    }
  }
  res.writeHead(404); res.end()
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch(), results = [], forbidden = []
async function check(name, width, theme, run) {
  try { const detail = await run(); results.push({ name, width, theme, ok: true, detail }); console.log(`PASS ${name} ${width} ${theme}`) }
  catch (error) { results.push({ name, width, theme, ok: false, error: error.message.slice(0, 500) }); console.log(`FAIL ${name} ${width} ${theme}: ${error.message.slice(0, 180)}`) }
}
try {
  for (const width of [1440, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.route('**/*', async intercepted => {
      const request = intercepted.request(), url = new URL(request.url())
      if (url.origin !== base || request.method() !== 'GET') { forbidden.push({ method: request.method(), path: url.pathname }); return intercepted.abort('blockedbyclient') }
      return intercepted.continue()
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/?theme=${theme}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.getByRole('button', { name: '타이포 설정', exact: true }).waitFor()
    await check('type no open mutation, persistence, Escape focus', width, theme, async () => {
      const trigger = page.getByRole('button', { name: '타이포 설정', exact: true })
      const before = await page.locator('.reading-prose').evaluate(el => getComputedStyle(el).fontSize)
      await trigger.focus(); await trigger.press('Enter')
      const dialog = page.getByRole('dialog', { name: '타이포 설정' })
      await dialog.waitFor()
      assert.equal(await page.locator('.reading-prose').evaluate(el => getComputedStyle(el).fontSize), before)
      await dialog.getByRole('button', { name: '글자 크기 크게', exact: true }).click()
      assert.equal(await page.locator('.reading-prose').evaluate(el => getComputedStyle(el).fontSize), '19px')
      await page.screenshot({ path: `${out}/type@${width}-${theme}.png` })
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
      const restored = await trigger.evaluate(el => document.activeElement === el)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.reading-prose')).fontSize === '19px')
      await trigger.click(); await dialog.getByRole('button', { name: '글자 크기 기본', exact: true }).click()
      await page.keyboard.press('Escape')
      assert.equal(restored, true, 'Escape must return focus to the trigger')
      assert.equal(before, '15px')
      await trigger.focus(); await trigger.press('Enter'); await dialog.waitFor()
      assert.equal(await trigger.getAttribute('aria-controls'), await dialog.getAttribute('id'))
      await page.locator('#outside').focus(); await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.equal(await page.locator('#outside').evaluate(el => document.activeElement === el), true, 'Do not steal outside focus')
    })
    await check('chapter targets, Escape focus and outside focus', width, theme, async () => {
      const trigger = page.getByRole('button', { name: '목차', exact: true })
      await trigger.focus(); await trigger.press('Enter')
      const dialog = page.getByRole('dialog', { name: '장 목록' })
      await dialog.waitFor(); await dialog.getByRole('link').first().focus()
      const targets = await dialog.locator('button,a[href]').evaluateAll(nodes => nodes.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })))
      await page.screenshot({ path: `${out}/chapters@${width}-${theme}.png` })
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Chapter Escape focus')
      assert.ok(targets.every(t => t.width >= 44 && t.height >= 44), JSON.stringify(targets))
      await trigger.click(); await dialog.waitFor(); await page.locator('#outside').click(); await dialog.waitFor({ state: 'detached' })
      assert.equal(await page.locator('#outside').evaluate(el => document.activeElement === el), true, 'Outside click keeps its focus')
    })
    await check('insight initial focus, Tab trap, close and body restoration', width, theme, async () => {
      const trigger = page.getByRole('button', { name: /학습 인사이트 열기/ })
      await page.evaluate(() => { document.body.style.overflow = 'auto' })
      await trigger.focus(); await trigger.press('Enter')
      const dialog = page.getByRole('dialog', { name: '학습 인사이트' })
      await dialog.waitFor(); await page.waitForTimeout(500)
      const initialFocus = await dialog.evaluate(el => el.contains(document.activeElement))
      const close = dialog.getByRole('button', { name: '닫기', exact: true })
      await close.focus(); await page.keyboard.press('Tab')
      const trapped = await dialog.evaluate(el => el.contains(document.activeElement))
      const target = await close.boundingBox()
      await page.screenshot({ path: `${out}/insight@${width}-${theme}.png` })
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
      const restored = await trigger.evaluate(el => document.activeElement === el)
      assert.ok(initialFocus && trapped && restored, JSON.stringify({ initialFocus, trapped, restored }))
      assert.ok(target.width >= 44 && target.height >= 44, JSON.stringify(target))
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
    })
    await check('header toolbar targets and no overflow', width, theme, async () => {
      const targets = await page.getByRole('toolbar', { name: '액션' }).locator('button,a[href]').filter({ visible: true }).evaluateAll(nodes => nodes.filter(el => !el.disabled).map(el => ({ label: el.getAttribute('aria-label') || el.textContent, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })))
      assert.ok(targets.every(t => t.w >= 44 && t.h >= 44), JSON.stringify(targets))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
    })
    await context.close()
  }
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ mode: 'isolated-component-fixture', normalRouteAcceptance: false, source: ['UnifiedHeader', 'TypePopover', 'WorkspaceChapterNav', 'InsightPanel'], results, forbiddenRequests: forbidden }, null, 2))
}
if (results.some(row => !row.ok) || forbidden.length) process.exitCode = 1
