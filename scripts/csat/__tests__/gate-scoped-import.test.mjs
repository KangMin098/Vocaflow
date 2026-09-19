// scripts/csat/__tests__/gate-scoped-import.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('scoped importer previews, preserves other JSON keys, uses CAS, and resumes without rewrites', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-gate-test-'))
  fs.mkdirSync(path.join(dir, 'apps/web'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'apps/web/.env.local'), '')
  const row = { id: '11111111-1111-1111-1111-111111111111', content: 'A list of radio frequencies, not a reading passage.', updated_at: '2026-09-18T00:00:00Z', status: 'ready', source: 'voa', feed_id: null, csat_fit: { answer: { correct: 2 } } }
  let writes = 0, race = false
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'GET') { res.end(JSON.stringify([{ ...row, gate: row.csat_fit.gate }])); return }
    let body = ''
    for await (const part of req) body += part
    const params = new URL(req.url, 'http://localhost').searchParams
    if (race || params.get('updated_at') !== `eq.${row.updated_at}`) { res.end('[]'); return }
    assert.equal(params.get('id'), `eq.${row.id}`)
    Object.assign(row, JSON.parse(body), { updated_at: '2026-09-19T00:00:00Z' })
    writes++
    res.end(JSON.stringify([row]))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  const review = { id: row.id, source_updated_at: row.updated_at, body_sha256: crypto.createHash('sha256').update(row.content).digest('hex'), verdict: 'reject', genre: 'reference', why: 'The whole text is a frequency table rather than prose.' }
  const input = path.join(dir, 'review.json')
  const run = async (commit = false, exportName = null) => {
    fs.writeFileSync(input, JSON.stringify([review]))
    fs.writeFileSync(path.join(dir, 'ids.txt'), row.id)
    const args = commit === 'legacy'
      ? [fileURLToPath(new URL('../gate-import.mjs', import.meta.url)), '--commit']
      : exportName
      ? [fileURLToPath(new URL('../gate-article-export.mjs', import.meta.url)), '--ids-file', path.join(dir, 'ids.txt'), '--output', path.join(dir, exportName)]
      : [fileURLToPath(new URL('../gate-mixed-import.mjs', import.meta.url)), '--input', input, ...(commit ? ['--commit'] : [])]
    const child = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' }, windowsHide: true })
    let output = ''
    child.stdout.on('data', x => { output += x }); child.stderr.on('data', x => { output += x })
    const code = await new Promise(resolve => child.on('close', resolve))
    return { code, output }
  }
  assert.equal((await run(false, 'source.json')).code, 0)
  const legacy = await run('legacy')
  assert.notEqual(legacy.code, 0)
  assert.match(legacy.output, /Title-keyed gate commits retired/)
  assert.equal(writes, 0)
  const exported = JSON.parse(fs.readFileSync(path.join(dir, 'source.json')))
  assert.equal(exported[0].body_sha256, review.body_sha256)
  assert.equal(exported[0].content, row.content)
  assert.notEqual((await run(false, 'source.json')).code, 0) // preserve evidence
  assert.equal((await run()).code, 0)
  assert.equal(writes, 0)
  assert.equal((await run(true)).code, 0)
  assert.equal(writes, 1)
  assert.deepEqual(row.csat_fit.answer, { correct: 2 })
  assert.equal(row.status, 'ready')
  assert.match((await run(false, 'already-judged.json')).output, /"exported":0/)
  assert.match((await run(true)).output, /"changed":0/)
  assert.equal(writes, 1)
  review.why += ' A changed judgment.'
  assert.notEqual((await run(true)).code, 0) // stale review
  review.source_updated_at = row.updated_at
  race = true
  assert.notEqual((await run(true)).code, 0) // concurrent update wins
  assert.equal(writes, 1)
  race = false
  review.body_sha256 = '0'.repeat(64)
  assert.notEqual((await run(true)).code, 0)
  assert.equal(writes, 1)
})
