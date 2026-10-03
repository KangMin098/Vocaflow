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

async function run(kind, existing, solveAnswer = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-resume-'))
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    const url = decodeURIComponent(req.url)
    requests.push({ method: req.method, url, body: body ? JSON.parse(body) : null })
    res.setHeader('Content-Type', 'application/json')
    if (url.startsWith('/rest/v1/csat_item_analyses')) return res.end(JSON.stringify({ id: 'analysis', item_id: 'H2603G3#18', analyst_run: 'writer' }))
    if (url.startsWith('/rest/v1/rpc/csat_rereview_parent')) return res.end('"parent"')
    if (url.startsWith('/rest/v1/rpc/csat_review_reveal')) return res.end(JSON.stringify([{ answer: 2, analysis: { item_id: 'H2603G3#18' } }]))
    if (url.startsWith('/rest/v1/csat_review_runs')) {
      if (req.method === 'POST') return res.end(JSON.stringify({ id: 'new-run' }))
      if (url.includes('csat_independent_reviews')) return res.end(JSON.stringify(existing ? [{ id: 'existing-run', solve_answer: solveAnswer, csat_independent_reviews: [] }] : []))
      return res.end(JSON.stringify({ id: 'parent', solve_answer: 2, solve_note: 'An independently committed solution.' }))
    }
    if (url.startsWith('/rest/v1/csat_items')) return res.end(JSON.stringify({ id: 'H2603G3#18', passage: 'A synthetic passage.' }))
    return res.end('[]')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, kind, '--analysis', 'analysis', '--persona', 'setter', '--agent-run', 'reviewer', '--out', '_out-test.json'], {
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
    assert.match(lookup.url, /csat_independent_reviews.id=is.null/)
    if (kind === 'rereview') assert.match(lookup.url, /parent_run_id=eq.parent/)
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

test('a resumed committed blind solve goes directly to reveal without solving twice', async () => {
  const r = await run('start', true, 2)
  assert.equal(r.code, 0, r.output)
  assert.match(r.result.next, /^reveal --run existing-run$/)
  assert.equal('official_answer' in r.result, false)
})
