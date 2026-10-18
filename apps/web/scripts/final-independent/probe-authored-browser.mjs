// apps/web/scripts/final-independent/probe-authored-browser.mjs
// Actual frozen React components/CSS in Chromium; synthetic API responses, no live DB.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
const root = path.resolve(import.meta.dirname, '../../../..')
const snapshot = path.join(root, '.agent-logs/final-independent/owner52')
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const { chromium } = req('@playwright/test')
const files = ['apps/web/src/components/csat/authored/AuthoredRunner.tsx', 'apps/web/src/components/csat/diagnosis/map/AuthoredSupplyCard.tsx']
for (const f of files) if (fs.readFileSync(path.join(snapshot, f), 'utf8') !== execFileSync('git', ['show', '52a31d988:' + f], { cwd: root, encoding: 'utf8' })) throw new Error('Frozen snapshot mismatch: ' + f)
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {AuthoredRunner} from './apps/web/src/components/csat/authored/AuthoredRunner';
import {AuthoredSupplyCard} from './apps/web/src/components/csat/diagnosis/map/AuthoredSupplyCard';
const root=createRoot(document.getElementById('root'));
window.renderFixture=(kind,props)=>root.render(kind==='runner'?<AuthoredRunner key={props.role+String(props.done)+String(props.hints)} {...props}/>:<AuthoredSupplyCard key={JSON.stringify(props)} {...props}/>);
`
const built = await build({ stdin: { contents: entry, resolveDir: snapshot, loader: 'tsx' }, tsconfig: path.join(snapshot, 'apps/web/tsconfig.json'), nodePaths: [path.join(root, 'apps/web/node_modules')], bundle: true, write: false, outdir: 'out', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'local-navigation', setup(b) { b.onResolve({ filter: /^next\/link$/ }, a => ({ path: a.path, namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}`, loader: 'tsx', resolveDir: snapshot })) } }] })
const js = built.outputFiles.find(f => f.path.endsWith('.js')).contents
const css = built.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? ''
const tokens = fs.readFileSync(path.join(snapshot, 'packages/design-tokens/src/tokens.css'), 'utf8')
const server = http.createServer((q, s) => { s.setHeader('content-type', q.url === '/bundle.js' ? 'application/javascript' : 'text/html; charset=utf-8'); s.end(q.url === '/bundle.js' ? js : `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;--bg:#fff;--bg2:#f8f8fa;--bg3:#f4f4f5;--t1:#18181b;--t2:#71717a;--bd:#e4e4e7;--p:#18181b;--on-p:#fff;font-family:Arial,sans-serif}#root{width:672px;max-width:calc(100% - 48px);margin:24px auto}button{font:inherit}*{box-sizing:border-box}</style><div id="root"></div><script src="/bundle.js"></script></html>`) })
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch()
const out = path.join(root, 'docs/research/final-independent-20261018/authored-browser')
fs.mkdirSync(out, { recursive: true })
const contentOnly = process.argv.includes('--content-only')
const authoredSet = JSON.parse(execFileSync('git', ['show', '52a31d988:apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json'], { cwd: root, encoding: 'utf8' }))
const results = [], runtimeErrors = [], external = [], submissions = []
const record = (id, ok, detail) => { results.push({ id, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + id) }
const props = { id: 'isolated-case', role: 'independent_check', sentences: ['A useful strategy connects evidence to a clear claim.', 'For example, learners can compare two possible explanations.', 'The comparison reveals which explanation fits the evidence.'], stem: '글의 요지는?', choices: ['근거와 주장을 연결해 판단하라.', '비교를 언제나 피하라.', '설명은 중요하지 않다.', '생각을 모두 외워라.', '한 가지 사례만 보라.'], teach: null, hints: null, probe: 1, done: null, returnHref: '/csat/diagnosis?tab=map&view=full' }
const reveal = { gist: '연결된 근거로 설명을 판단한다.', answer: 0, claim: 0, claimRestated: [], support: [1, 2], opposed: [], distractors: [] }
const grade = { isCorrect: true, claimOk: true, claimRestated: false, supportOk: true, supportMissed: [], relationOk: true, choiceOk: true, choiceDesign: null }
try {
  for (const width of [1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    page.on('pageerror', e => runtimeErrors.push(e.message))
    let scenario = 'empty', failOnce = true
    await page.route('**/*', async route => {
      const request = route.request(), url = request.url()
      if (!url.startsWith(base)) { external.push(url); return route.abort() }
      if (!url.includes('/api/')) return route.continue()
      let data
      if (url.endsWith('/attempt')) {
        submissions.push(request.postDataJSON())
        if (failOnce) { failOnce = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '격리 시험: 응답 유실 후 다시 제출' }) }) }
        data = { grade, reveal, binding: 'bound' }
      } else if (url.endsWith('/supply')) data = { status: 'ok', lines: [{ role: 'independent_check', requested: 2, delivered: [], rejected: [], orderOpened: false }] }
      else data = scenario === 'missing' ? { status: 'not_installed' } : { status: 'installed', rows: [] }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(base)
    if (contentOnly) {
      for (const item of authoredSet.items) {
        const p = { ...props, id: item.id, role: item.role, sentences: item.body.sentences, stem: item.body.stem, choices: item.body.choices, teach: item.body.teach ?? null, hints: item.body.hints ?? null, probe: item.gold.relationProbe.sentence }
        await page.evaluate(p => window.renderFixture('runner', p), p)
        await page.getByRole('button', { name: '맞춰 보기', exact: true }).waitFor()
        await page.waitForFunction(id => document.querySelector('[data-testid="authored-runner"]')?.textContent?.includes(id), item.body.sentences[0])
        const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth-innerWidth, undersized: [...document.querySelectorAll('button:not(:disabled),a')].filter(e=>e.getBoundingClientRect().height<44-0.1).map(e=>e.textContent) }))
        record(width+'-'+item.id+'-actual-content-layout', m.overflow<=0 && m.undersized.length===0, m)
        if (item.id==='r5-cm-teach-1' || item.id==='r5-cm-ind-1') await page.screenshot({ path: path.join(out, width+'-'+item.id+'.png'), fullPage: true })
      }
      await page.close()
      continue
    }
    await page.evaluate(p => window.renderFixture('runner', p), props)
    await page.getByTestId('authored-runner').waitFor()
    const submit = page.getByRole('button', { name: '맞춰 보기', exact: true })
    record(`${width}-incomplete-disabled`, await submit.isDisabled(), null)
    const passage = page.locator('[aria-labelledby="passage-h"] button')
    await passage.nth(0).focus(); await page.keyboard.press('Enter')
    record(`${width}-keyboard-claim`, await passage.nth(0).getAttribute('aria-pressed') === 'true', await passage.nth(0).evaluate(e => ({ outline: getComputedStyle(e).outlineStyle, width: getComputedStyle(e).outlineWidth })))
    await passage.nth(1).click(); await passage.nth(2).click()
    await page.getByRole('button', { name: '예를 들어 주장을 보여 준다', exact: true }).click()
    await page.getByRole('button', { name: '① 근거와 주장을 연결해 판단하라.', exact: true }).click()
    record(`${width}-answer-ready`, await submit.isEnabled(), null)
    await page.screenshot({ path: path.join(out, `${width}-independent.png`), fullPage: true })
    await submit.click(); await page.getByRole('alert').waitFor()
    record(`${width}-error-retry-enabled`, await submit.isEnabled(), await page.getByRole('alert').textContent())
    await submit.click(); await page.getByTestId('authored-result').waitFor()
    const pair = submissions.slice(-2)
    record(`${width}-retry-id-stable`, pair[0].clientMutationId === pair[1].clientMutationId, { sameId: true, firstAt: pair[0].answeredAt, retryAt: pair[1].answeredAt, sameAnsweredAt: pair[0].answeredAt === pair[1].answeredAt })
    record(`${width}-return-link`, await page.getByRole('link', { name: '학습 지도로 돌아가 변화 보기' }).getAttribute('href') === props.returnHref, { scope: 'href only, not actual map restoration' })
    record(`${width}-no-horizontal-overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null)
    await page.screenshot({ path: path.join(out, `${width}-result.png`), fullPage: true })
    scenario = 'empty'
    await page.evaluate(() => window.renderFixture('supply', { task: 'r.central_meaning', template: 'ws.central-meaning', planSaved: false, past: false }))
    await page.getByTestId('ws-authored-empty').waitFor()
    record(`${width}-no-plan`, await page.getByTestId('ws-authored-request').isDisabled(), await page.getByTestId('ws-authored-empty').textContent())
    await page.evaluate(() => window.renderFixture('supply', { task: 'r.central_meaning', template: 'ws.central-meaning', planSaved: true, past: false }))
    await page.getByTestId('ws-authored-request').click()
    await page.getByTestId('ws-authored-msg').waitFor()
    record(`${width}-shortage-message-observed`, true, { apiOrderOpened: false, text: await page.getByTestId('ws-authored-msg').textContent() })
    await page.screenshot({ path: path.join(out, `${width}-shortage.png`), fullPage: true })
    scenario = 'missing'
    await page.evaluate(() => window.renderFixture('supply', { task: 'r.central_meaning', template: 'ws.central-meaning', planSaved: true, past: true }))
    await page.getByTestId('ws-authored-preparing').waitFor()
    record(`${width}-not-installed`, await page.getByTestId('ws-authored-request').count() === 0, await page.getByTestId('ws-authored-preparing').textContent())
    await page.close()
  }
  record('no-runtime-errors-or-external-network', runtimeErrors.length === 0 && external.length === 0, { runtimeErrors, external })
} finally {
  await browser.close(); await new Promise(r => server.close(r))
  fs.writeFileSync(path.join(out, contentOnly ? 'content-layout.json' : 'results.json'), JSON.stringify({ frozenCommit: '52a31d988', scope: 'Real components/CSS, synthetic API and local navigation wrapper. No actual shell, route auth, DB, map restore, or whole-product E2E claim.', results, submissions }, null, 2) + '\n')
}
process.exitCode = results.some(r => !r.ok) ? 1 : 0
