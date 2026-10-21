// apps/web/tests/e2e/admin-topic-corpus-drain.spec.ts
// Actual client and CSS, controlled API failures; native DB execution is audited separately.
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { adminFixtureCss } from './_support/admin-fixture-css'

const web = path.resolve(__dirname, '../..'), root = path.resolve(web, '../..')
const requireTool = createRequire(path.join(web, 'package.json'))
let server: http.Server, origin: string
interface FixtureBuild {
  onResolve(options: { filter: RegExp }, callback: () => { path: string; namespace: string }): void
  onLoad(options: { filter: RegExp; namespace: string }, callback: () => { contents: string; loader: 'js' }): void
}
test.beforeAll(async () => {
  const { build } = requireTool(requireTool.resolve('esbuild', { paths: [path.join(root, 'node_modules/.pnpm/node_modules')] }))
  const bundled = await build({
    stdin: { resolveDir: web, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';
      import{TopicCorpusClient}from'./src/app/admin/topic-corpus/TopicCorpusClient';
      window.refreshes=0;window.drainCalls=0;
      const nativeFetch=window.fetch;window.fetch=(url,options)=>{
        if(String(url).endsWith('/drain')){
          window.drainCalls++;
          const mode=new URL(location.href).searchParams.get('mode');
          const data=mode==='empty'?{claimed:0,failed:0}:mode==='partial'?{claimed:1,harvested:1,failed:1,message:'release failure'}:{claimed:1,harvested:0,failed:1,drained:false};
          return Promise.resolve(new Response(JSON.stringify(data),{status:mode==='partial'?500:200,headers:{'content-type':'application/json'}}));
        }
        return nativeFetch(url,options);
      };
      createRoot(document.getElementById('root')).render(<TopicCorpusClient loadError={null} rows={[{
        source_id:'owned-test',label_en:'Owned test',label_ko:'격리 주제',category_id:'owned-topic',license:'synthetic',is_active:true,
        queued:1,claimed:0,done:0,failed:0,docs:0,running_words:0,distinct_words:0,gap_words:0,promoted:0,last_harvest:null,
      }]}/>);
    ` },
    plugins: [{ name: 'router-refresh-boundary', setup(builder: FixtureBuild) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter=()=>({refresh:()=>{window.refreshes++}})', loader: 'js' }))
    } }],
    bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': path.join(web, 'src') },
    banner: { js: 'window.process={env:{NODE_ENV:"development"}};' }, define: { 'process.env.NODE_ENV': '"development"' },
  })
  const css = await adminFixtureCss(web)
  server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') {
      response.setHeader('content-type', 'application/javascript'); response.end(bundled.outputFiles[0].text); return
    }
    response.setHeader('content-type', 'text/html;charset=utf-8')
    response.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>${css}</style><body><main id="root" data-area="admin"></main><script src="/fixture.js"></script></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
})
test.afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())) })

test('일시 실패 뒤 자동 반복을 중단하고 갱신한다', async ({ page }) => {
  await page.goto(origin + '/?mode=retryable')
  await page.getByRole('button', { name: '드레인', exact: true }).click()
  await expect(page.getByText(/실패가 있어 자동 반복을 중단했습니다/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { refreshes: number }).refreshes)).toBe(1)
  expect(await page.evaluate(() => (window as unknown as { drainCalls: number }).drainCalls)).toBe(1)
  await expect(page.getByRole('button', { name: '드레인', exact: true })).toBeEnabled()
})
test('HTTP 실패에 부분 작업이 있으면 새로고침한다', async ({ page }) => {
  await page.goto(origin + '/?mode=partial')
  await page.getByRole('button', { name: '드레인', exact: true }).click()
  await expect(page.getByText('owned-test 드레인 실패 — release failure')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { refreshes: number }).refreshes)).toBe(1)
  expect(await page.evaluate(() => (window as unknown as { drainCalls: number }).drainCalls)).toBe(1)
})
test('처리 가능한 대기 없음은 실패 없음으로 표시하지 않는다', async ({ page }) => {
  await page.goto(origin + '/?mode=empty')
  await page.getByRole('button', { name: '드레인', exact: true }).click()
  await expect(page.getByText('owned-test 처리 가능한 대기 작업이 없습니다. 실패·재시도 상태를 확인하세요.')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { refreshes: number }).refreshes)).toBe(0)
  expect(await page.evaluate(() => (window as unknown as { drainCalls: number }).drainCalls)).toBe(1)
})
