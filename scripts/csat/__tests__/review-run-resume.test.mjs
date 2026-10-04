// scripts/csat/__tests__/review-run-resume.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../review-drain.mjs', import.meta.url))

async function run(kind, existing, solveAnswer = null, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-resume-'))
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    const url = decodeURIComponent(req.url)
    requests.push({ method: req.method, url, body: body ? JSON.parse(body) : null })
    res.setHeader('Content-Type', 'application/json')
    if (url.startsWith('/rest/v1/csat_item_analyses')) return res.end(JSON.stringify({ id: 'analysis', item_id: 'H2603G3#18', analyst_run: 'writer', csat_analysis_hash: 'analysis-hash' }))
    for (const [name, hash] of [['csat_item_input_hash', 'input-hash'], ['csat_item_answer_hash', 'answer-hash'], ['csat_current_units_hash', 'units-hash']]) {
      if (url.startsWith(`/rest/v1/rpc/${name}`)) return res.end(JSON.stringify(hash))
    }
    if (url.startsWith('/rest/v1/rpc/csat_rereview_parent')) return res.end(JSON.stringify(kind === 'rereview' || overrides.validParent ? 'parent' : null))
    if (url.startsWith('/rest/v1/rpc/csat_review_reveal')) return res.end(JSON.stringify([{ answer: 2, analysis: { item_id: 'H2603G3#18' } }]))
    if (url.startsWith('/rest/v1/csat_review_followups')) return res.end(JSON.stringify(overrides.invalidBlind ? [{ source: 'blind-invalid:parent' }] : overrides.excludedPending && url.includes('blind-invalid:pending') ? [{source:'blind-invalid:pending'}] : []))
    if (url.startsWith('/rest/v1/csat_review_runs')) {
      if (req.method === 'POST') return res.end(JSON.stringify({ id: 'new-run' }))
      if (url.includes('solve_committed_at=is.null')) return res.end(JSON.stringify(overrides.pendingBlind ? [{ id: 'pending', item_id: 'H2603G3#41' }] : []))
      if (url.includes('select=id,item_id,role,agent_run')) return res.end(JSON.stringify(overrides.history ?? []))
      if (url.includes('csat_independent_reviews')) return res.end(JSON.stringify(existing ? [{ id: 'existing-run', solve_answer: solveAnswer, solve_input_hash: 'input-hash', solve_answer_hash: 'answer-hash', csat_independent_reviews: [], ...overrides }] : []))
      return res.end(JSON.stringify({ id: 'parent', item_id: 'H2603G3#18', agent_run: 'reviewer', created_at: '2026-10-01T00:00:00Z', solve_answer: 2, solve_note: 'An independently committed solution.' }))
    }
    if (url.startsWith('/rest/v1/csat_items')) {
      const item={ id: 'H2603G3#18', exam_id: 'H2603G3', no: 18, stem: 'Which purpose?', passage: 'A synthetic passage.', choices: ['A', 'B', 'C', 'D', 'E'] }
      return res.end(JSON.stringify(url.includes('id=in.') ? [item] : item))
    }
    return res.end('[]')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const solveArgs=kind==='solve'?['--answer','2','--note',overrides.solveNote??'An independently committed solution.',...(overrides.omitItem?[]:['--item',overrides.submittedItem??'H2603G3#18'])]:[]
    const child = spawn(process.execPath, [CLI, kind, '--run', 'parent', '--analysis', 'analysis', '--persona', 'setter', '--agent-run', 'reviewer', '--out', '_out-test.json', '--before', '2026-10-03T21:34:35.336Z',...solveArgs], {
      cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    const file = path.join(dir, 'scripts/csat/review-drain-hakpyeong/_out-test.json')
    return { code, output, requests, result: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

for (const kind of ['start', 'rereview']) {
  test(`${kind} resumes only the same execution's unsubmitted run after lost output`, async () => {
    const r = await run(kind, true)
    assert.equal(r.code, 0, r.output)
    assert.equal(r.result.run_id, 'existing-run')
    assert.equal(r.result.resumed, true)
    assert.equal(r.requests.filter((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')).length, 0)
    const lookup = r.requests.find((q) => q.url.includes('csat_independent_reviews'))
    assert.match(lookup.url, /analysis_id=eq.analysis/)
    assert.match(lookup.url, /persona=eq.setter/)
    assert.match(lookup.url, /agent_run=eq.reviewer/)
    assert.match(lookup.url, /csat_independent_reviews=is.null/)
    if (kind === 'rereview') {
      assert.match(lookup.url, /parent_run_id=eq.parent/)
      assert.equal(r.result.item.stem, 'Which purpose?')
      assert.deepEqual(r.result.item.choices, ['A', 'B', 'C', 'D', 'E'])
    }
    else assert.equal('official_answer' in r.result, false)
  })
  test(`${kind} creates a run when this execution has no open one`, async () => {
    const r = await run(kind, false)
    assert.equal(r.code, 0, r.output)
    assert.equal(r.result.run_id, 'new-run')
    assert.equal(r.result.resumed, false)
    assert.equal(r.requests.filter((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')).length, 1)
  })
}

test('solve verifies the submitted item against the DB run before committing evidence',async()=>{
 const good=await run('solve',false)
 assert.equal(good.code,0,good.output)
 assert.equal(good.requests.filter(r=>r.url.startsWith('/rest/v1/rpc/csat_review_solve')).length,1)
 for(const overrides of [{submittedItem:'H2603G3#19'},{omitItem:true},{solveNote:'undefined'}]){
  const bad=await run('solve',false,null,overrides)
  assert.notEqual(bad.code,0)
  assert.equal(bad.requests.filter(r=>r.method==='POST').length,0)
 }
})

test('a resumed committed blind solve goes directly to reveal without solving twice', async () => {
  const r = await run('start', true, 2)
  assert.equal(r.code, 0, r.output)
  assert.match(r.result.next, /^reveal --run existing-run$/)
  assert.equal('official_answer' in r.result, false)
})

for (const field of ['reveal_input_hash', 'reveal_answer_hash', 'reveal_analysis_hash', 'reveal_units_hash']) {
  test(`rereview does not reuse an exposure with stale ${field}`, async () => {
    const r = await run('rereview', true, null, { revealed_at: '2026-10-01T00:00:00Z', reveal_input_hash: 'input-hash', reveal_answer_hash: 'answer-hash', reveal_analysis_hash: 'analysis-hash', reveal_units_hash: 'units-hash', [field]: 'old' })
    assert.equal(r.code, 0, r.output)
    assert.equal(r.result.run_id, 'new-run')
    assert.equal(r.result.resumed, false)
  })
}

for (const field of ['reveal_analysis_hash', 'reveal_units_hash']) {
  test(`start with only changed ${field} keeps its valid blind and requires rereview`, async () => {
    const r = await run('start', true, 2, { revealed_at: '2026-10-01T00:00:00Z', reveal_input_hash: 'input-hash', reveal_answer_hash: 'answer-hash', reveal_analysis_hash: 'analysis-hash', reveal_units_hash: 'units-hash', [field]: 'old' })
    assert.notEqual(r.code, 0)
    assert.match(r.output, /rereview --analysis analysis/)
    assert.equal(r.requests.filter((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')).length, 0)
  })
}

test('start cannot create another blind after a prior valid solution was submitted', async () => {
  const r = await run('start', false, null, { validParent: true })
  assert.notEqual(r.code, 0)
  assert.match(r.output, /rereview --analysis analysis/)
  assert.equal(r.requests.filter((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')).length, 0)
})

test('blind source changes do not reuse an old committed solve', async () => {
  const r = await run('start', true, 2, { solve_input_hash: 'old-input' })
  assert.equal(r.code, 0, r.output)
  assert.equal(r.result.run_id, 'new-run')
  assert.match(r.result.next, /^solve/)
})

test('an unsolved open blind cannot bypass a prior valid solution', async () => {
  const r = await run('start', true, null, { validParent: true })
  assert.notEqual(r.code, 0)
  assert.match(r.output, /rereview --analysis analysis/)
  assert.equal(r.result, null)
  assert.equal(r.requests.filter((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')).length, 0)
  assert.ok(r.requests.some((q) => q.url.includes('csat_rereview_parent')))
})

for (const kind of ['reveal', 'rereview']) {
  test(`${kind} can proceed on unrelated evidence when an old pending blind was permanently excluded`, async () => {
    const r=await run(kind,false,null,{pendingBlind:true,excludedPending:true})
    assert.equal(r.code,0,r.output)
    assert.ok(r.result)
    assert.ok(r.requests.some(q=>q.url.includes('csat_review_reveal')))
  })
  test(`${kind} cannot expose a sibling analysis before this execution commits its blind solve`, async () => {
    const r = await run(kind, false, null, { pendingBlind: true })
    assert.notEqual(r.code, 0)
    assert.equal(r.result, null)
    assert.match(r.output, /미저장 blind/)
    assert.ok(r.requests.every((q) => q.method !== 'POST'))
    const pending = r.requests.find((q) => q.url.includes('solve_committed_at=is.null'))
    assert.match(pending.url, /agent_run=eq.reviewer/)
    assert.match(pending.url, /kind=eq.blind/)
  })
  test(`${kind} refuses evidence explicitly excluded from the blind protocol`, async () => {
    const r = await run(kind, false, null, { invalidBlind: true })
    assert.notEqual(r.code, 0)
    assert.equal(r.result, null)
    assert.match(r.output, /독립 풀이 증거에서 제외/)
    assert.ok(!r.requests.some((q) => q.url.includes('csat_review_reveal')))
    assert.ok(!r.requests.some((q) => q.method === 'POST' && q.url.startsWith('/rest/v1/csat_review_runs')))
  })
}

test('reveal still exposes a committed blind when no other blind is pending', async () => {
  const r = await run('reveal', false)
  assert.equal(r.code, 0, r.output)
  assert.equal(r.result.your_solve, 2)
  assert.equal(r.result.official_answer, 2)
})

test('start cannot resume a disqualified committed blind as valid evidence', async () => {
  const r = await run('start', true, 2, { invalidBlind: true })
  assert.notEqual(r.code, 0)
  assert.equal(r.result, null)
  assert.ok(r.requests.every((q) => q.method !== 'POST'))
})

for (const kind of ['start','solve']) {
  test(`${kind} cannot replace an excluded or previously exposed blind after submission/version changes`, async () => {
    const r=await run(kind,false,null,{history:[{id:'parent',item_id:'H2603G3#18',role:'reviewer',agent_run:'reviewer',created_at:'2026-09-30T00:00:00Z',revealed_at:'2026-09-30T00:01:00Z'}],...(kind==='solve'?{}:{invalidBlind:true})})
    assert.notEqual(r.code,0)
    assert.equal(r.result,null)
    assert.ok(!r.requests.some(q=>q.method==='POST'&&(q.url.startsWith('/rest/v1/csat_review_runs')||q.url.includes('csat_review_solve'))))
  })
}

test('open-runs is a scoped read-only anti-join using the caller-provided cutoff', async () => {
  const r = await run('open-runs', true)
  assert.equal(r.code, 0, r.output)
  const lookup = r.requests.find((q) => q.url.includes('csat_independent_reviews'))
  assert.match(lookup.url, /item_id=like.H%/)
  assert.match(lookup.url, /created_at=lt.2026-10-03T21:34:35.336Z/)
  assert.match(lookup.url, /csat_independent_reviews=is.null/)
  assert.ok(r.requests.every((q) => q.method === 'GET'))
})
