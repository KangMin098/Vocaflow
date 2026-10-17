// scripts/research/v2-f1/panel-f1-browser.mjs
//
// V2-F1 — 실제 ContextSensePanel(React)을 격리 Chromium 에서 렌더해 「정답 단서(뜻 선택지)가 B 확정 전 DOM 에 없는가」를 본다.
// 출시 콘텐츠 · DB 쓰기 없음. task-meta 만 대역(요청 키 재사용 규칙은 같다), 네트워크는 page.route 로 가로챈다. 합성 뜻 문자열만 쓴다.
//   node scripts/research/v2-f1/panel-f1-browser.mjs --out <dir>
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '../../..')
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const { chromium } = req('@playwright/test')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const out = path.resolve(root, arg('--out', 'tmp/v2-f1-panel'))
fs.mkdirSync(out, { recursive: true })
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim()
const DIRTY = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root }).toString().trim().length > 0
const actualMeta = process.argv.includes('--actual-meta')
const SENSE = ['SENSE_DECREASE_FIXTURE', 'SENSE_INCREASE_FIXTURE', 'SENSE_SAME_FIXTURE']
const panel = 'apps/web/src/components/csat/theater/ContextSensePanel.tsx'
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {ContextSensePanel} from './${panel}';
const q=new URLSearchParams(location.search);const markers=q.get('m')==='letter'?['(a)','(b)','(c)','(d)','(e)']:['①','②','③','④','⑤'];
createRoot(document.getElementById('root')).render(React.createElement(ContextSensePanel,{slug:'t-30',principle:'Context sense fixture',why:'Synthetic instrument only',sentenceCount:8,targets:[1,2,3,5,6],markers,cueGraded:true}));`
const stub = `import {useRef} from 'react';export function useTaskMeta(){const s=useRef(crypto.randomUUID()),p=useRef(null);return {async meta(key,sec){if(p.current?.key===key)return p.current.meta;const meta={clientSessionId:s.current,clientMutationId:crypto.randomUUID(),answeredAt:new Date().toISOString(),helpLevel:'independent',sec};p.current={key,meta};return meta},settled(){p.current=null},restart(){s.current=crypto.randomUUID();p.current=null}}}`
const built = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, nodePaths: [root + '/apps/web/node_modules'], bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'fixture', setup(b) {
    if (!actualMeta) b.onResolve({ filter: /task-meta$/ }, () => ({ path: 'meta', namespace: 'stub' }))
    if (actualMeta) {
      b.onResolve({ filter: /^@\/lib\/csat\/session\/store$/ }, () => ({ path: 'store', namespace: 'io' }))
      b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'auth', namespace: 'io' }))
      b.onLoad({ filter: /.*/, namespace: 'io' }, (a) => ({ contents: a.path === 'auth'
        ? "export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'isolated'}}}})}}}"
        : "export async function loadDissectionRecord(){return {sessions:[]}}", loader: 'ts' }))
    }
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, resolveDir: root + '/apps/web', loader: 'tsx' }))
    b.onResolve({ filter: /^@\// }, (a) => ({ path: root + '/apps/web/src/' + a.path.slice(2) + '.ts' }))
  } }],
})
const css = (await req('postcss')([req('tailwindcss')({ content: [path.join(root, panel)] })])
  .process('@tailwind base;@tailwind utilities;', { from: undefined })).css
const tokens = fs.readFileSync(path.join(root, 'packages/design-tokens/src/tokens.css'), 'utf8')
const server = http.createServer((q, s) => {
  if (q.url === '/bundle.js') { s.setHeader('content-type', 'application/javascript'); s.end(built.outputFiles[0].contents) }
  else { s.setHeader('content-type', 'text/html'); s.end('<html lang="ko"><head><meta charset="UTF-8"><style>' + tokens + css + 'body{margin:24px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch()
const rows = []
const rec = (id, ok, detail) => { rows.push({ id, pass: !!ok, detail: detail ?? null }); console.log((ok ? 'PASS ' : 'FAIL ') + id) }
const leak = (html) => SENSE.some((s) => html.includes(s))
const right = { outcome: 'inserted', grade: { misfitOk: true, cueOk: true, isCorrect: true, followUp: { senseOptions: SENSE, senseCorrect: 0 } } }
const wrong = { outcome: 'inserted', grade: { misfitOk: false, cueOk: false, isCorrect: false, followUp: null } }
try {
  for (const width of [1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const requests = []
    let reply = { status: 200, body: right }, lost = false, delay = 0
    await page.route('**/api/csat/item/*/task', async (route) => {
      requests.push(JSON.parse(route.request().postData()))
      if (delay) await new Promise((r) => setTimeout(r, delay))
      if (lost) { lost = false; await route.abort('failed') } else await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
    })
    const html = () => page.evaluate(() => document.documentElement.outerHTML)
    const privateStateLeaks = () => page.getByTestId('principle-panel').evaluate((el, senses) => {
      let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))]
      while (fiber && fiber.type?.name !== 'ContextSensePanel') fiber = fiber.return
      if (!fiber) throw Error('Panel React fiber missing')
      const values = [fiber.memoizedProps]
      for (let hook = fiber.memoizedState; hook; hook = hook.next) values.push(hook.memoizedState)
      return senses.some(s => JSON.stringify(values).includes(s))
    }, SENSE)
    const open = async (m) => { await page.goto(base + (m ? `?m=${m}` : '')); await page.getByText('직접 확인하기', { exact: true }).click() }

    await open()
    rec(`${width} F1 열기 직후 DOM(숨김 포함)에 뜻 선택지 없음`, !leak(await html()) && (await page.locator('[data-sense]').count()) === 0)
    rec(`${width} React props 및 hook 상태에 D 없음`, !(await privateStateLeaks()))
    await page.locator('[data-misfit="3"]').click()
    await page.locator('[data-cue="4"]').click()
    rec(`${width} F1 B 선택 뒤 · 제출 전에도 뜻 선택지 없음 · 제출 가능`, !leak(await html()) && (await page.getByTestId('cs-submit').isEnabled()))
    await page.screenshot({ path: path.join(out, `${width}-before-submit.png`) })

    reply = { status: 200, body: wrong }
    await page.getByTestId('cs-submit').click()
    await page.getByTestId('principle-result').waitFor()
    rec(`${width} F1 B 오답 응답 뒤에도 뜻 선택지 없음`, !leak(await html()) && (await page.getByTestId('cs-sense-practice').count()) === 0)
    rec(`${width} B 오답 뒤 React 상태에도 D 없음`, !(await privateStateLeaks()))
    rec(`${width} 첫 제출 본문에 sense 없음`, requests.every((r) => !('sense' in r.response)), { keys: Object.keys(requests.at(-1).response) })

    reply = { status: 200, body: right }
    await open()
    await page.locator('[data-misfit="3"]').click()
    await page.getByTestId('cs-submit').click()
    await page.getByTestId('cs-sense-practice').waitFor()
    rec(`${width} B 정답 저장 뒤에만 뜻 연습 등장`, leak(await html()))
    rec(`${width} 뜻 연습 중 B · 근거 수정 불가(잠김)`, (await page.locator('[data-misfit="0"]').isDisabled()) && (await page.locator('[data-cue="0"]').isDisabled()))
    const nReq = requests.length
    await page.locator('[data-sense="0"]').click()
    await page.getByTestId('cs-sense-feedback').waitFor()
    rec(`${width} 뜻 연습 선택은 서버에 기록하지 않음`, requests.length === nReq && (await page.getByTestId('cs-sense-feedback').getAttribute('data-right')) === 'true')
    await page.screenshot({ path: path.join(out, `${width}-sense-practice.png`) })

    await page.reload()
    rec(`${width} 새로고침 → 결과 · 뜻 연습 사라짐(재제출은 원장에서 반복 시도)`, !leak(await html()) && (await page.getByTestId('principle-result').count()) === 0)

    for (const status of [401, 400, 409, 500]) {
      reply = { status, body: { error: 'save failed' } }
      await open(); await page.locator('[data-misfit="3"]').click(); await page.getByTestId('cs-submit').click()
      await page.getByRole('alert').waitFor()
      rec(`${width} HTTP ${status} → 결과 · 뜻 연습 없음`, (await page.getByTestId('principle-result').count()) === 0 && !leak(await html()))
    }
    reply = { status: 200, body: { outcome: 'inserted', grade: { misfitOk: false, cueOk: null, isCorrect: false, followUp: { senseOptions: SENSE, senseCorrect: 0 } } } }
    await open(); await page.locator('[data-misfit="0"]').click(); await page.getByTestId('cs-submit').click(); await page.getByRole('alert').waitFor()
    rec(`${width} B 오답인데 선택지가 온 응답은 버림(완료 아님 · 단서 미표시)`, (await page.getByTestId('principle-result').count()) === 0 && !leak(await html()))
    for (const body of [{ grade: right.grade }, { outcome: 'conflict', grade: right.grade }, { outcome: 'inserted', grade: { ...right.grade, isCorrect: false } }]) {
      reply = { status: 200, body }
      await open(); await page.locator('[data-misfit="3"]').click(); await page.getByTestId('cs-submit').click(); await page.getByRole('alert').waitFor()
      rec(`${width} 잘못된 200 (${body.outcome ?? 'missing receipt'}/${body.grade.isCorrect}) → 결과 · D 없음`, (await page.getByTestId('principle-result').count()) === 0 && !leak(await html()) && !(await privateStateLeaks()))
    }

    reply = { status: 200, body: right }
    await open(); await page.locator('[data-misfit="3"]').click(); lost = true
    await page.getByTestId('cs-submit').click(); await page.getByRole('alert').waitFor()
    const first = requests.at(-1)
    rec(`${width} 응답 유실 → 결과 없음`, (await page.getByTestId('principle-result').count()) === 0)
    reply = { status: 200, body: { ...right, outcome: 'duplicate' } }
    await page.getByTestId('cs-submit').click(); await page.getByTestId('principle-result').waitFor()
    rec(`${width} 재시도는 같은 요청 키 · 같은 본문`, JSON.stringify(first) === JSON.stringify(requests.at(-1)))

    reply = { status: 200, body: right }
    await open(); await page.locator('[data-misfit="3"]').click(); delay = 350
    const n = requests.length
    await page.getByTestId('cs-submit').evaluate((el) => { el.click(); el.click() })
    await page.waitForTimeout(50)
    rec(`${width} 제출 중 B 잠김`, await page.locator('[data-misfit="0"]').isDisabled())
    rec(`${width} 저장 대기 중 결과 · D · React 단서 없음`, !leak(await html()) && !(await privateStateLeaks()) && (await page.getByTestId('principle-result').count()) === 0)
    await page.screenshot({ path: path.join(out, `${width}-saving.png`) })
    await page.waitForTimeout(500)
    rec(`${width} 동시 이중 클릭 → 요청 1건`, requests.length === n + 1)
    delay = 0

    await open('letter')
    rec(`${width} F5 X-VOCAB 표지 (a)~(e)`, (await page.locator('[data-misfit="0"]').innerText()).startsWith('(a)') && (await page.locator('[data-misfit="4"]').innerText()).startsWith('(e)'))
    await page.locator('[data-misfit="1"]').focus(); await page.keyboard.press('Enter')
    const sizes = await page.locator('[data-misfit], [data-cue], [data-testid="cs-submit"]').evaluateAll((xs) => xs.map(x => { const r = x.getBoundingClientRect(); return { w: r.width, h: r.height } }))
    rec(`${width} 키보드 선택 · Tailwind 실제 44px · 가로 넘침 0`, (await page.locator('[data-misfit="1"]').getAttribute('aria-pressed')) === 'true' && sizes.every(r => r.w >= 44 && r.h >= 44) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { sizes })
    await page.screenshot({ path: path.join(out, `${width}-letter-keyboard.png`) })
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((r) => server.close(r))
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sha: SHA, dirtyTree: DIRTY, actualMeta, tailwind: true, isolated: true, contentReleased: false, pass: rows.filter((r) => r.pass).length, fail: rows.filter((r) => !r.pass).length, rows }, null, 2))
}
console.log(`PASS ${rows.filter((r) => r.pass).length} · FAIL ${rows.filter((r) => !r.pass).length}`)
if (rows.some((r) => !r.pass)) process.exitCode = 1
