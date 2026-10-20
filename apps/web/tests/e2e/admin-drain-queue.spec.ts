// apps/web/tests/e2e/admin-drain-queue.spec.ts
// Actual banner with controlled GET completion order and polling ticks; no DB.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
const web = path.resolve(__dirname, '../..'), root = path.resolve(web, '../..')
const requireTool = createRequire(path.join(web, 'package.json'))
let server: http.Server, origin: string
test.beforeAll(async () => {
  const { build } = requireTool(requireTool.resolve('esbuild', { paths: [path.join(root, 'node_modules/.pnpm/node_modules')] }))
  const bundle = await build({
    stdin: { resolveDir: web, loader: 'tsx', contents: `
      import {useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
      import {DrainQueueBanner} from './src/components/admin/curation/DrainQueueBanner';
      window.queueResolvers={voice:[],quiz:[],review:[]};
      const interval=window.setInterval;window.setInterval=(callback,ms,...args)=>ms===8000?(window.pollQueue=callback,987654):interval(callback,ms,...args);
      function Fixture(){const [key,K]=useState(0);useEffect(()=>{window.reloadQueue=()=>K(k=>k+1)},[]);return <DrainQueueBanner reloadKey={key}/>}
      createRoot(document.getElementById('root')).render(<Fixture/>);
    ` },
    plugins: [{ name: 'controlled-read-completion', setup(builder: { onResolve: Function; onLoad: Function }) {
      builder.onResolve({ filter: /^@\/lib\/library\/curation-queue-client$/ }, () => ({ path: 'read', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const readCurationQueue=kind=>new Promise(resolve=>window.queueResolvers[kind].push(resolve));`, loader: 'js' }))
    } }], bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': path.join(web, 'src') },
    define: { 'process.env.NODE_ENV': '"development"' },
  })
  const cssDir = path.join(web, process.env.ADMIN_DIALOG_CSS_DIST ?? '.next-lineage-build', 'static')
  const css = fs.readdirSync(cssDir, { recursive: true }).map(String).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n')
  server = http.createServer((request, response) => {
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return }
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><main id="root" data-area="admin"></main><script>${bundle.outputFiles[0].text}</script></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
})
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())) })
type ControlledWindow = { queueResolvers: Record<string, Array<(value: unknown) => void>>; pollQueue: () => void; reloadQueue: () => void }
async function finish(page: import('@playwright/test').Page, index: number, active: boolean) {
  await page.evaluate(({ index, active }) => {
    const fixture = window as unknown as ControlledWindow
    const row = { id: 'job', bookId: 'book', bookTitle: '검증 도서', status: 'running', mode: 'dev_process', step: '준비', progress: 0 }
    for (const kind of ['voice', 'quiz', 'review']) fixture.queueResolvers[kind][index]({ ok: true, data: active && kind === 'voice' ? [row] : [] })
  }, { index, active })
}
async function setup(page: import('@playwright/test').Page) {
  await page.goto(origin)
  await expect.poll(() => page.evaluate(() => (window as unknown as ControlledWindow).queueResolvers.voice.length)).toBe(1)
  await finish(page, 0, true)
  await expect(page.getByRole('region', { name: '큐레이션 드레인 큐 상태' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as ControlledWindow).pollQueue)).toBe('function')
}
test('늦은 이전 조회가 새 작업 표시를 지워 폴링을 중단시키지 않는다', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => (window as unknown as ControlledWindow).pollQueue())
  await page.evaluate(() => (window as unknown as ControlledWindow).reloadQueue())
  await expect.poll(() => page.evaluate(() => (window as unknown as ControlledWindow).queueResolvers.voice.length)).toBe(3)
  await finish(page, 2, true)
  await finish(page, 1, false)
  await page.waitForTimeout(100)
  await expect(page.getByRole('region', { name: '큐레이션 드레인 큐 상태' })).toBeVisible({ timeout: 1500 })
})
test('느린 조회 중 폴링은 중복하지 않고 완료 뒤 다시 조회한다', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { const fixture = window as unknown as ControlledWindow; fixture.pollQueue(); fixture.pollQueue(); fixture.pollQueue() })
  expect(await page.evaluate(() => (window as unknown as ControlledWindow).queueResolvers.voice.length)).toBe(2)
  await finish(page, 1, true)
  await expect(page.getByRole('button', { name: '드레인 큐 새로고침', exact: true })).toBeEnabled()
  await page.evaluate(() => (window as unknown as ControlledWindow).pollQueue())
  expect(await page.evaluate(() => (window as unknown as ControlledWindow).queueResolvers.voice.length)).toBe(3)
})
