// apps/web/scripts/final-independent/probe-segment-alternatives-candidate.mjs
// FI-014 candidate only: actual frozen format module + four item-specific draft alternatives.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import http from 'node:http'

const root = path.resolve(import.meta.dirname, '../../../..')
const head = '14446db1048258752acb22ba08171196e8b33566'
const folder = path.join(root, 'docs/research/final-independent-20261018')
const snapshot = path.join(root, '.agent-logs/final-independent/owner-de5')
const source = file => execFileSync('git', ['show', `${head}:${file}`], { cwd: root, encoding: 'utf8', windowsHide: true })
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const file = 'apps/web/src/lib/knowledge/authored/formats.ts'
const original = source(file)
const replaceOnce = (value, before, after) => {
  assert.equal(value.split(before).length, 2, 'Source anchor must occur once')
  return value.replace(before, after)
}
const helper = `/** Item-specific draft alternatives remain inside the revision-bound Gold. */
function segmentAlternatives(g: Record<string, unknown>): { reason: SegmentReason; why: string }[] | null {
  const raw = g.reasonAlternatives
  if (raw === undefined) return []
  if (!Array.isArray(raw) || raw.length === 0 || raw.length >= SEGMENT_REASONS.length) return null
  const reasons = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const x = entry as { reason?: unknown; why?: unknown }
    if (!SEGMENT_REASONS.includes(x.reason as SegmentReason) || x.reason === g.reason || typeof x.why !== 'string' || x.why.trim().length < 8 || reasons.has(x.reason as string)) return null
    reasons.add(x.reason as string)
  }
  return raw as { reason: SegmentReason; why: string }[]
}

`
const start = original.indexOf('const segmentChoice: FormatSpec = {')
const end = original.indexOf('// ── equivalence', start)
assert.ok(start >= 0 && end > start)
let segment = original.slice(start, end)
segment = replaceOnce(segment, "    if (!SEGMENT_REASONS.includes(gg.reason)) errs.push('이유 범주')", "    if (!SEGMENT_REASONS.includes(gg.reason)) errs.push('이유 범주')\n    if (segmentAlternatives(g) === null) errs.push('문항별 대체 이유와 설명')")
segment = replaceOnce(segment, '    const reasonOk = r.reason === gg.reason', '    const alternatives = segmentAlternatives(g)\n    if (alternatives === null) return null\n    const reasonOk = r.reason === gg.reason || alternatives.some((a) => a.reason === r.reason)')
segment = replaceOnce(segment, 'reason: g.reason, why: g.why, segments: g.segments', 'reason: g.reason, reasonAlternatives: g.reasonAlternatives, why: g.why, segments: g.segments')
const candidate = original.slice(0, start) + helper + segment + original.slice(end)
for (const dependency of ['claim-support.ts', 'claim-support-labels.ts']) {
  const p = 'apps/web/src/lib/knowledge/' + dependency
  assert.equal(source(p), fs.readFileSync(path.join(snapshot, p), 'utf8'))
}
const frozen = { name: 'frozen-csat', setup(b) {
  b.onResolve({ filter: /^@\/lib\/csat\/(inquiry\/structure-check|design)$/ }, args => ({ path: args.path.replace('@/', 'apps/web/src/'), namespace: 'frozen' }))
  b.onResolve({ filter: /^\.\.\/design$/, namespace: 'frozen' }, () => ({ path: 'apps/web/src/lib/csat/design', namespace: 'frozen' }))
  b.onLoad({ filter: /.*/, namespace: 'frozen' }, args => ({ contents: source(args.path + '.ts'), loader: 'ts' }))
} }
const compile = async text => {
  const built = await build({ stdin: { contents: text, resolveDir: path.join(snapshot, 'apps/web/src/lib/knowledge/authored'), loader: 'ts' }, plugins: [frozen], bundle: true, write: false, platform: 'node', format: 'cjs', tsconfig: path.join(snapshot, 'apps/web/tsconfig.json') })
  const mod = { exports: {} }
  new Function('module', 'exports', built.outputFiles[0].text)(mod, mod.exports)
  return mod.exports
}
const old = await compile(original), fixed = await compile(candidate)
const runnerFile = 'apps/web/src/components/csat/authored/AuthoredRunner.tsx'
const runnerOriginal = source(runnerFile)
const revealLine = "          <p><b>정답 덩어리</b> — {SEGMENT_REASON_LABEL[rv.reason as string] ?? String(rv.reason)}. {String(rv.why ?? '')}</p>"
const runnerCandidate = replaceOnce(runnerOriginal, revealLine, revealLine + '\n          {((rv.reasonAlternatives as { reason: string; why: string }[] | undefined) ?? []).map((a) => <p key={a.reason}><b>함께 맞는 이유</b> — {SEGMENT_REASON_LABEL[a.reason] ?? a.reason}. {a.why}</p>)}')
const drafts = {
  'cb-guided-1': { reason: 'main_verb', why: 'refused는 주절의 정형 본동사를 시작하므로 문장의 본동사라는 이유도 맞다.' },
  'cb-ind-1': { reason: 'clause_boundary', why: 'their children에서 주어와 동사를 갖춘 believe의 목적어절이 시작되므로 절의 경계라는 이유도 맞다.' },
  'cb-ind-2': { reason: 'main_subject', why: '선택한 전체 명사구가 worried의 주어이며 주어 전체를 찾으라는 발문에 직접 답한다.' },
  'cb-delayed-1': { reason: 'clause_boundary', why: 'the family had forgotten은 box를 꾸미는 관계절의 시작이므로 절의 경계라는 이유도 맞다.' },
}
const rows = [], changes = []
let combinations = 0
for (const setName of ['s-chunk-boundary.v1', 's-sentence-core.v1', 's-attachment.v1', 's-structural-relation.v1']) {
  const setFile = 'apps/web/src/lib/knowledge/authored/' + setName + '.json'
  const originalBytes = source(setFile), set = JSON.parse(originalBytes)
  for (const item of set.items) {
    const before = structuredClone(item.gold)
    const alternative = drafts[item.id]
    if (alternative) item.gold.reasonAlternatives = [alternative]
    assert.deepEqual(fixed.FORMAT_SPECS.segment_choice.validate(item.body, item.gold), [])
    const canonical = { choice: item.gold.answer, reason: item.gold.reason }
    assert.equal(fixed.FORMAT_SPECS.segment_choice.grade(item.body, item.gold, canonical, 'v1').grade.isCorrect, true)
    let additionalAccepted = 0
    for (let choice = 0; choice < item.body.segments.length; choice++) {
      for (const reason of fixed.SEGMENT_REASONS) {
        const response = { choice, reason }
        const baseline = old.FORMAT_SPECS.segment_choice.grade(item.body, before, response, 'v1').grade.isCorrect
        const after = fixed.FORMAT_SPECS.segment_choice.grade(item.body, item.gold, response, 'v1').grade.isCorrect
        const expected = choice === item.gold.answer && (reason === item.gold.reason || reason === alternative?.reason)
        assert.equal(after, expected, item.id + ':' + choice + ':' + reason)
        if (after !== baseline) {
          assert.equal(baseline, false)
          additionalAccepted++
        }
        combinations++
      }
    }
    assert.equal(additionalAccepted, alternative ? 1 : 0)
    assert.equal(fixed.FORMAT_SPECS.segment_choice.grade(item.body, item.gold, { choice: -1, reason: 'main_subject' }, 'v1'), null)
    assert.equal(fixed.FORMAT_SPECS.segment_choice.grade(item.body, item.gold, { choice: item.gold.answer, reason: 'unknown' }, 'v1'), null)
    rows.push({ id: item.id, originalReason: before.reason, addedReason: alternative?.reason ?? null, canonicalPreserved: true, additionalAccepted, bodyUnchanged: true, role: item.role })
  }
  if (set.items.some(i => drafts[i.id])) {
    let patched = originalBytes
    for (const item of set.items.filter(i => drafts[i.id])) {
      const start = patched.indexOf('"id": "' + item.id + '"')
      const goldStart = patched.indexOf('"gold": {', start)
      const reason = '"reason": "' + item.gold.reason + '",'
      const index = patched.indexOf(reason, goldStart) + reason.length
      assert.ok(start >= 0 && goldStart > start && index > goldStart)
      patched = patched.slice(0, index) + '\n        "reasonAlternatives": [' + JSON.stringify(drafts[item.id]) + '],' + patched.slice(index)
    }
    assert.deepEqual(JSON.parse(patched), set)
    changes.push({ file: setFile, original: originalBytes, candidate: patched })
  }
}
const chunk = JSON.parse(source('apps/web/src/lib/knowledge/authored/s-chunk-boundary.v1.json')).items.find(i => i.id === 'cb-ind-2')
const malformed = [null, 'main_subject', [], [{ reason: 'unknown', why: 'A sufficiently long explanation.' }], [{ reason: 'main_subject', why: '' }], [{ reason: chunk.gold.reason, why: 'A sufficiently long explanation.' }], [drafts['cb-ind-2'], drafts['cb-ind-2']]]
for (const reasonAlternatives of malformed) {
  const gold = { ...chunk.gold, reasonAlternatives }
  assert.ok(fixed.FORMAT_SPECS.segment_choice.validate(chunk.body, gold).length > 0)
  assert.equal(fixed.FORMAT_SPECS.segment_choice.grade(chunk.body, gold, { choice: gold.answer, reason: gold.reason }, 'v1'), null)
}
const run = fs.mkdtempSync(path.join(root, '.agent-logs/final-independent/fi014-candidate-'))
for (const change of [{ file, original, candidate }, { file: runnerFile, original: runnerOriginal, candidate: runnerCandidate }, ...changes]) {
  const beforeFile = path.join(run, 'before', change.file), afterFile = path.join(run, 'after', change.file)
  fs.mkdirSync(path.dirname(beforeFile), { recursive: true }); fs.mkdirSync(path.dirname(afterFile), { recursive: true })
  fs.writeFileSync(beforeFile, change.original); fs.writeFileSync(afterFile, change.candidate)
}
const diff = spawnSync('git', ['diff', '--no-index', '--no-prefix', '--', 'before', 'after'], { cwd: run, encoding: 'utf8', windowsHide: true, stdio: 'pipe' })
assert.equal(diff.status, 1, diff.stderr)
const patchFile = path.join(folder, 'fi014-segment-alternatives-candidate.patch')
fs.writeFileSync(patchFile, diff.stdout.replaceAll('before/apps/', 'a/apps/').replaceAll('after/apps/', 'b/apps/'))
execFileSync('git', ['apply', '--check', '--directory=' + path.relative(root, path.join(run, 'before')).replaceAll('\\', '/'), patchFile], { cwd: root, encoding: 'utf8', windowsHide: true })
const report = { head, result: 'PASS', items: rows.length, combinations, invalidGoldRejected: malformed.length, rows,
  scope: 'Actual frozen format grader/validator with isolated code + four unapproved item-specific Gold drafts. Exhaustive finite choice/reason combinations for 24 segment items. Browser scope, when requested, is recorded separately. No product modification, DB/hash execution, G2 or human Gold/rights approval.',
  productApplied: false, humanApproved: false, patchContextCheck: 'PASS against isolated frozen files', sources: [{ file, originalSha256: createHash('sha256').update(original).digest('hex'), candidateSha256: createHash('sha256').update(candidate).digest('hex') }, { file: runnerFile, originalSha256: createHash('sha256').update(runnerOriginal).digest('hex'), candidateSha256: createHash('sha256').update(runnerCandidate).digest('hex') }],
  note: 'Gold JSON content changes require the actual registration revision/hash and fresh human review; no prior qualification is carried over by this candidate.' }
if (process.argv.includes('--browser')) {
  const { chromium } = req('@playwright/test')
  const cssFile = 'apps/web/src/components/knowledge/practice.module.css'
  assert.equal(source(cssFile), fs.readFileSync(path.join(snapshot, cssFile), 'utf8'))
  const built = await build({ stdin: { contents: "import React from 'react';import {createRoot} from 'react-dom/client';import {AuthoredRunner} from 'candidate-runner';const root=createRoot(document.getElementById('root'));window.mount=p=>root.render(<AuthoredRunner key={p.id} {...p}/>);", resolveDir: snapshot, loader: 'tsx' }, bundle: true, write: false, outdir: 'out', metafile: true, platform: 'browser', jsx: 'automatic', nodePaths: [path.join(root, 'apps/web/node_modules')], tsconfig: path.join(snapshot, 'apps/web/tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'candidate-runner', setup(b) {
    b.onResolve({ filter: /^candidate-runner$/ }, () => ({ path: 'runner', namespace: 'candidate' }))
    b.onLoad({ filter: /.*/, namespace: 'candidate' }, () => ({ contents: runnerCandidate, loader: 'tsx', resolveDir: path.join(snapshot, 'apps/web/src/components/csat/authored') }))
    b.onResolve({ filter: /^@\/lib\/knowledge\/authored\/labels$/ }, () => ({ path: 'labels', namespace: 'labels' }))
    b.onLoad({ filter: /.*/, namespace: 'labels' }, () => ({ contents: source('apps/web/src/lib/knowledge/authored/labels.ts'), loader: 'ts' }))
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'link' }))
    b.onLoad({ filter: /.*/, namespace: 'link' }, () => ({ contents: "import React from 'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}", loader: 'tsx', resolveDir: snapshot }))
  } }] })
  assert.deepEqual(Object.keys(built.metafile.inputs).filter(p => /authored\/.*\.json$/.test(p.replaceAll('\\', '/'))), [])
  const js = built.outputFiles.find(f => f.path.endsWith('.js')).contents
  const css = built.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? ''
  const tokens = fs.readFileSync(path.join(snapshot, 'packages/design-tokens/src/tokens.css'), 'utf8')
  const server = http.createServer((q, s) => {
    s.setHeader('content-type', q.url === '/bundle.js' ? 'application/javascript' : 'text/html;charset=utf-8')
    s.end(q.url === '/bundle.js' ? js : `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${tokens}\n${css}\nbody{margin:0;--bg:#fff;--bg2:#f8f8fa;--t1:#18181b;--t2:#71717a;--bd:#e4e4e7;--p:#18181b;--on-p:#fff;font-family:Arial,sans-serif}*{box-sizing:border-box}button{font:inherit}#root{width:672px;max-width:calc(100% - 48px);margin:24px auto}</style><div id="root"></div><script src="/bundle.js"></script></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port, browser = await chromium.launch()
  const output = path.join(folder, 'fi014-candidate-ui'), observations = [], errors = [], external = []
  fs.mkdirSync(output, { recursive: true })
  const set = JSON.parse(changes[0].candidate)
  const fixtures = Object.entries(drafts).map(([id, alternative]) => ({ id, item: set.items.find(i => i.id === id), response: { choice: set.items.find(i => i.id === id).gold.answer, reason: alternative.reason }, expected: true }))
  const independent = set.items.find(i => i.id === 'cb-ind-2')
  fixtures.push({ id: 'wrong-segment', item: independent, response: { choice: 1, reason: 'main_subject' }, expected: false }, { id: 'unrelated-reason', item: independent, response: { choice: 0, reason: 'object' }, expected: false })
  const labels = { main_verb: '문장의 본동사', main_subject: '문장의 주어', clause_boundary: '절의 경계', object: '목적어' }
  try {
    for (const width of [1280, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.on('pageerror', error => errors.push(error.message))
      await page.clock.install({ time: new Date('2026-10-18T12:40:00Z') })
      let active, posted
      await page.route('**/*', async route => {
        const q = route.request()
        if (!q.url().startsWith(base)) { external.push(q.url()); return route.abort() }
        if (!q.url().includes('/api/')) return route.continue()
        posted = q.postDataJSON()
        const result = fixed.FORMAT_SPECS.segment_choice.grade(active.item.body, active.item.gold, posted.response, 'v1')
        return route.fulfill({ status: result ? 200 : 400, contentType: 'application/json', body: JSON.stringify(result ? { grade: result.grade, reveal: { format: 'segment_choice', ...fixed.FORMAT_SPECS.segment_choice.reveal(active.item.gold) }, binding: { status: 'bound', evidence: false } } : { error: 'Invalid synthetic response' }) })
      })
      await page.goto(base)
      for (const f of fixtures) {
        active = f
        const { sentences, stem, choices, ...extra } = f.item.body
        await page.evaluate(p => window.mount(p), { id: f.id, deliveryId: '20000000-0000-4000-8000-000000000001', role: f.item.role, format: 'segment_choice', sentences, stem, choices: choices ?? [], extra, teach: null, hints: f.item.body.hints ?? null, probe: null, done: null, returnHref: '/csat/diagnosis?tab=map&view=full' })
        const group = page.getByTestId('authored-segments'), submit = page.getByRole('button', { name: '맞춰 보기', exact: true })
        await group.waitFor(); assert.equal(await submit.isDisabled(), true)
        await group.locator('[data-segment="' + f.response.choice + '"]').click()
        await group.getByRole('button', { name: labels[f.response.reason], exact: true }).click()
        await submit.click(); await page.getByTestId('authored-result').waitFor()
        const text = await page.getByTestId('authored-result').textContent()
        assert.deepEqual(posted.response, f.response)
        assert.ok(text.includes(f.expected ? '정확히 해냈어요' : '이번에는 어긋났어요'))
        assert.ok(text.includes('함께 맞는 이유'))
        if (f.expected) assert.ok(text.includes('이유: 맞음'))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        observations.push({ width, id: f.id, correct: f.expected, alternativeExplanationVisible: true, noOverflow: true })
        if (f.id === 'cb-ind-2' || f.id === 'unrelated-reason') await page.screenshot({ path: path.join(output, width + '-' + f.id + '.png'), fullPage: true })
      }
      await page.close()
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
  report.browser = { observations, runtimeErrors: errors.length, externalRequests: external.length, goldJsonBrowserInputs: 0, scope: 'Actual candidate Runner/CSS and candidate grader. Local synthetic API/Link; no route auth, actual DB/G2/PLAN or human approval.' }
}
fs.writeFileSync(path.join(folder, 'fi014-segment-alternatives-candidate.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ items: rows.length, combinations, invalidGoldRejected: malformed.length, changedItems: rows.filter(r => r.addedReason).length, result: 'PASS' }))
