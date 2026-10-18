// apps/web/scripts/final-independent/probe-observation-inspector144.mjs
// Actual frozen TaskInspector in Chromium; synthetic state injection, no DB or learner data.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../../../..')
const head = '14446db1048258752acb22ba08171196e8b33566'
const run = fs.mkdtempSync(path.join(root, '.agent-logs/final-independent/observation-inspector144-'))
const snapshot = path.join(run, 'snapshot')
fs.mkdirSync(snapshot)
execFileSync('git', ['archive', head, '--format=tar', '--output=' + path.join(run, 'source.tar'), 'apps/web/src', 'apps/web/package.json', 'apps/web/tsconfig.json', 'packages', 'tsconfig.base.json'], { cwd: root, windowsHide: true })
execFileSync('tar.exe', ['-xf', path.join(run, 'source.tar'), '-C', snapshot], { windowsHide: true })
for (const directory of ['node_modules', 'apps/web/node_modules']) fs.symlinkSync(path.join(root, directory), path.join(snapshot, directory), 'junction')
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const { chromium } = req('@playwright/test')
const pathSource = fs.readFileSync(path.join(snapshot, 'apps/web/src/lib/csat/map/learner-path.ts'), 'utf8').replaceAll('\r\n', '\n')
const pathLabels = ['STAGE_WORD', 'EVIDENCE_LABEL'].map(name => {
  const match = pathSource.match(new RegExp('export const ' + name + ':[^=]+=(\\s*\\{[\\s\\S]*?\\n\\})'))
  assert.ok(match, name)
  return 'export const ' + name + '=' + match[1]
}).join('\n')
const entry = `
import React from 'react'
import {createRoot} from 'react-dom/client'
import {build} from './apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-fixture'
import {TaskInspector} from './apps/web/src/components/csat/diagnosis/map/TaskInspector'
import {partsOf} from './apps/web/src/lib/csat/map/v4/definition'
import {taskInspector} from './apps/web/src/lib/csat/map/v62/graph'
import {ranksOf} from './apps/web/src/lib/csat/map/v62/rank'
const root=createRoot(document.getElementById('root'))
window.mount=({task,state})=>{
 const b=build({goalSet:false,attempts:[],activity:[],asOfDay:12,saved:false,fq:{status:'not_installed'}})
 const parts=partsOf(task)
 for(const id of parts) b.view.asIs.tasks[id]={...b.view.asIs.tasks[id],status:'resolved',basis:'direct_check'}
 if(parts[0]&&state==='insufficient') b.view.asIs.tasks[parts[0]]={...b.view.asIs.tasks[parts[0]],status:'observed',basis:'axis_proxy'}
 if(parts[0]&&state==='unmeasurable') b.view.asIs.tasks[parts[0]]={...b.view.asIs.tasks[parts[0]],status:'unmeasurable',check:null}
 const ins=taskInspector(task,b.view,ranksOf(b.view),null)
 root.render(<TaskInspector key={task+state} ins={ins} view={b.view} data={b.data} past={false} restoreWs={null} planOpen={false} onTogglePlan={()=>{}} returned={null}/>)
 return {parts}
}
`
const built = await build({ stdin: { contents: entry, resolveDir: snapshot, loader: 'tsx' }, bundle: true, write: false, outdir: 'out', metafile: true, platform: 'browser', jsx: 'automatic', nodePaths: [path.join(root, 'apps/web/node_modules')], tsconfig: path.join(snapshot, 'apps/web/tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolated-adapters', setup(b) {
  const stubs = {
    'next/navigation': 'export const useRouter=()=>({refresh(){},push(){}});export const usePathname=()=>"/csat/diagnosis";export const useSearchParams=()=>new URLSearchParams()',
    '@/lib/analytics/client': 'export const track=()=>{}',
    '@/lib/csat/map/learner-path': 'export const learnerPath=()=>({read:[],listen:[]});\n' + pathLabels,
    'next/link': "import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}",
  }
  for (const name of Object.keys(stubs)) b.onResolve({ filter: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }, () => ({ path: name, namespace: 'adapter' }))
  b.onLoad({ filter: /.*/, namespace: 'adapter' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: snapshot }))
} }] })
const js = built.outputFiles.find(f => f.path.endsWith('.js')).contents
const css = built.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? ''
const tokens = fs.readFileSync(path.join(snapshot, 'packages/design-tokens/src/tokens.css'), 'utf8')
const output = path.join(root, 'docs/research/final-independent-20261018/observation-inspector144')
fs.mkdirSync(output, { recursive: true })
const server = http.createServer((q, s) => {
  s.setHeader('content-type', q.url === '/bundle.js' ? 'application/javascript' : 'text/html;charset=utf-8')
  s.end(q.url === '/bundle.js' ? js : `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;--bg:#fff;--bg2:#f8f8fa;--t1:#18181b;--t2:#71717a;--bd:#e4e4e7;--p:#18181b;--on-p:#fff;font-family:Arial,sans-serif}*{box-sizing:border-box}button{font:inherit}#root{width:1000px;max-width:calc(100% - 48px);margin:24px auto}</style><div id="root"></div><script src="/bundle.js"></script></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = 'http://127.0.0.1:' + server.address().port, browser = await chromium.launch()
const rows = [], errors = [], external = []
const models = ['s.o.sentence_meaning_model', 'r.o.global_meaning_model', 'e.o.final_judgment']
const labels = { unmeasurable: '측정 불가', insufficient: '근거 부족', observable: '통합 관찰 가능' }
try {
  for (const width of [1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-10-18T12:50:00Z') })
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(base)) { external.push(route.request().url()); return route.abort() }
      return route.continue()
    })
    await page.goto(base)
    for (const task of models) {
      for (const state of Object.keys(labels)) {
        const { parts } = await page.evaluate(input => window.mount(input), { task, state })
        const section = page.getByTestId('inspector-observation')
        await section.waitFor()
        await page.waitForFunction(expected => document.querySelector('[data-testid="inspector-observation"]')?.getAttribute('data-state') === expected, state)
        assert.equal(await section.getAttribute('data-state'), state)
        assert.ok((await section.locator('h3').textContent()).includes(labels[state]))
        assert.equal(await section.locator('[data-part]').count(), parts.length)
        if (state === 'observable') {
          assert.equal(await section.locator('[data-evidence="direct"]').count(), parts.length)
          assert.ok((await section.textContent()).includes('숙달 점수는 매기지'))
        } else {
          const weak = state === 'insufficient' ? 'no_direct' : 'no_instrument'
          assert.equal(await section.locator('[data-part="' + parts[0] + '"]').getAttribute('data-evidence'), weak)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        rows.push({ width, task, state, partCount: parts.length, labelCorrect: true, noOverflow: true })
        if (task === 's.o.sentence_meaning_model') await page.screenshot({ path: path.join(output, width + '-' + state + '.png'), fullPage: true })
      }
    }
    for (const task of ['r.central_meaning', 'x.o.whole_test_stability']) {
      await page.evaluate(input => window.mount(input), { task, state: 'observable' })
      await page.waitForFunction(() => !document.querySelector('[data-testid="inspector-observation"]'))
      rows.push({ width, task, state: 'excluded', noInventedObservation: true })
    }
    await page.close()
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
const report = { head, complete: rows.length === 22, rows, runtimeErrors: errors, externalRequests: external, scope: 'Actual frozen TaskInspector and canonical observation function/relations in Chromium with injected synthetic child states. Fixture builds actual map DTOs before state injection. LearnerPath/analytics/navigation/Link adapted; no actual route/shell/auth/API/DB/G2/PLAN persistence or reference-design equivalence.', sourceHashes: ['apps/web/src/components/csat/diagnosis/map/TaskInspector.tsx', 'apps/web/src/lib/csat/map/v4/observation.ts'].map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(snapshot, file))).digest('hex') })) }
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ head, observations: rows.length, runtimeErrors: errors.length, externalRequests: external.length, complete: report.complete }))
