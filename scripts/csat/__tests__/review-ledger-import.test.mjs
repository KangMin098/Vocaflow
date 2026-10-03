// scripts/csat/__tests__/review-ledger-import.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareReviewLedgers, reviewLedgerSql } from '../lib-review-ledger.mjs'

const CLI = fileURLToPath(new URL('../review-drain.mjs', import.meta.url))
const batch = { batch: 'review-test', date: '2026-10-02', kind: 'blind', items: 1 }
const followup = { item_id: 'H2603G3#18', source: 'test', finding: '근거 번호를 다시 확인한다', severity: 'revise', status: 'open', date: '2026-10-02' }

test('data-only SQL holds both ledgers in one statement and safely quotes dollar tags', () => {
  const prepared = prepareReviewLedgers(JSON.stringify({ ...batch, note: "apostrophe ' and $csat_ledger$ ; drop table x;" }), JSON.stringify(followup), '2026-10-04T00:00:00Z')
  const sql = reviewLedgerSql(prepared)
  assert.match(sql, /with batch_write as/)
  assert.match(sql, /followup_write as/)
  assert.match(sql, /\$csat_ledger_\$/)
  const literals = [...sql.matchAll(/(\$csat_ledger_*\$)(.*?)\1::jsonb/gs)].map((m) => JSON.parse(m[2]))
  assert.deepEqual(literals, [prepared.batches, prepared.followups])
})

async function run(metrics, followups, rpcError = false, exportSql = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-ledger-'))
  const work = path.join(dir, 'scripts/csat/review-drain-hakpyeong')
  fs.mkdirSync(work, { recursive: true })
  fs.writeFileSync(path.join(work, '_metrics.jsonl'), metrics)
  fs.writeFileSync(path.join(work, '_followups.jsonl'), followups)
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/rest/v1/rpc/') && rpcError) {
      res.statusCode = 400
      return res.end(JSON.stringify({ message: 'invalid followup: entire transaction rolled back' }))
    }
    res.end('[]')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, 'ledger-import', ...(exportSql ? ['--sql-out', '_ledger-test.sql'] : ['--commit'])], {
      cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    return { code, output, requests, sql: fs.existsSync(path.join(work, '_ledger-test.sql')) ? fs.readFileSync(path.join(work, '_ledger-test.sql'), 'utf8') : null }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('SQL export works before the RPC exists and makes no database requests', async () => {
  const r = await run(JSON.stringify(batch), JSON.stringify(followup), true, true)
  assert.equal(r.code, 0, r.output)
  assert.deepEqual(r.requests, [])
  assert.match(r.sql, /review-test/)
  assert.match(r.sql, /근거 번호를 다시 확인한다/)
  assert.match(r.output, /DB 쓰기 없음/)
})

for (const [label, metrics, followups, location] of [
  ['missing batch', [{ ...batch, batch: undefined }], [followup], '_metrics.jsonl:1'],
  ['empty metric object', [{}], [followup], '_metrics.jsonl:1'],
  ['date-only metric object', [{ date: batch.date }], [followup], '_metrics.jsonl:1'],
  ['note missing its date', [{ note: '메모' }], [followup], '_metrics.jsonl:1'],
  ['annotation with invalid date', [{ date: '2026-02-30', note: '메모' }], [followup], '_metrics.jsonl:1'],
  ['annotation with numeric note', [{ date: batch.date, note: 42 }], [followup], '_metrics.jsonl:1'],
  ['annotation with null note', [{ date: batch.date, note: null }], [followup], '_metrics.jsonl:1'],
  ['annotation with empty note', [{ date: batch.date, note: '' }], [followup], '_metrics.jsonl:1'],
  ['annotation with whitespace note', [{ date: batch.date, note: '  ' }], [followup], '_metrics.jsonl:1'],
  ['unknown kind', [{ ...batch, kind: 're-review' }], [followup], '_metrics.jsonl:1'],
  ['Postgres character length', [batch], [{ ...followup, finding: '😀😀😀' }], '_followups.jsonl:1'],
  ['integer out of range', [{ ...batch, items: 2147483648 }], [followup], '_metrics.jsonl:1'],
  ['invalid finding type', [batch], [{ ...followup, finding: null }], '_followups.jsonl:1'],
  ['invalid date', [batch], [{ ...followup, date: '2026-02-30' }], '_followups.jsonl:1'],
  ['invalid severity', [batch], [{ ...followup, severity: 'typo' }], '_followups.jsonl:1'],
  ['unpaired high surrogate in finding', [batch], [{ ...followup, finding: '\ud800abcd' }], '_followups.jsonl:1'],
  ['unpaired low surrogate in source', [batch], [{ ...followup, source: 'test\udc00' }], '_followups.jsonl:1'],
  ['unpaired surrogate in nested token value', [{ ...batch, tokens: { details: ['\ud800'] } }], [followup], '_metrics.jsonl:1'],
  ['unpaired surrogate in nested detail key', [{ ...batch, extra: { ['\udc00']: 'value' } }], [followup], '_metrics.jsonl:1'],
]) {
  test(`ledger-import rejects ${label} before either table is written`, async () => {
    const r = await run(metrics.map(JSON.stringify).join('\n'), followups.map(JSON.stringify).join('\n'))
    assert.notEqual(r.code, 0, r.output)
    assert.ok(r.output.includes(location), r.output)
    assert.equal(r.requests.length, 0, 'invalid ledger caused a DB request')
  })
}

test('ledger-import skips note-only annotation lines but still rejects a batch line missing its name', async () => {
  const note = { date: '2026-09-29', note: '비용 해석 주의 — 주석 줄' }
  const ok = await run([note, batch].map(JSON.stringify).join('\n'), JSON.stringify(followup))
  assert.equal(ok.code, 0, ok.output)
  assert.match(ok.output, /장부 주석 1줄/)
  assert.equal(ok.requests.filter((q) => q.method === 'POST')[0].body.p_batches.length, 1, 'the annotation must not become a batch row')
  const bad = await run(JSON.stringify({ ...batch, batch: undefined }), JSON.stringify(followup))
  assert.notEqual(bad.code, 0)
  assert.match(bad.output, /_metrics\.jsonl:1/)
})

test('ledger-import reports physical line numbers including blank lines', async () => {
  const r = await run(`\n${JSON.stringify(batch)}\n\n{`, '')
  assert.notEqual(r.code, 0)
  assert.match(r.output, /_metrics\.jsonl:4/)
  assert.equal(r.requests.length, 0)
})

test('ledger-import upserts each natural key once using the last entry', async () => {
  const r = await run([batch, { ...batch, published: 1 }].map(JSON.stringify).join('\n'),
    [followup, { ...followup, status: 'fixed-published' }].map(JSON.stringify).join('\n'))
  assert.equal(r.code, 0, r.output)
  const writes = r.requests.filter((q) => q.method === 'POST')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].url, '/rest/v1/rpc/csat_review_ledgers_import')
  assert.equal(writes[0].body.p_batches.length, 1, 'duplicate batch would fail ON CONFLICT')
  assert.equal(writes[0].body.p_batches[0].published, 1)
  assert.equal(writes[0].body.p_followups.length, 1)
  assert.equal(writes[0].body.p_followups[0].status, 'fixed-published')
})

test('ledger-import preserves valid surrogate pairs in text and nested JSON', async () => {
  const r = await run(JSON.stringify({ ...batch, note: '정상 😀', tokens: { '😀': ['😎'] } }),
    JSON.stringify({ ...followup, finding: '😀abcd' }))
  assert.equal(r.code, 0, r.output)
  const writes = r.requests.filter((q) => q.method === 'POST')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].body.p_batches[0].note, '정상 😀')
  assert.deepEqual(writes[0].body.p_batches[0].tokens, { '😀': ['😎'] })
  assert.equal(writes[0].body.p_followups[0].finding, '😀abcd')
})

test('ledger RPC errors are reported without a partial table-write fallback', async () => {
  const r = await run(JSON.stringify(batch), JSON.stringify(followup), true)
  assert.notEqual(r.code, 0)
  assert.match(r.output, /entire transaction rolled back/)
  assert.equal(r.requests.filter((q) => q.method === 'POST').length, 1)
  assert.equal(r.requests.filter((q) => q.method === 'POST')[0].url, '/rest/v1/rpc/csat_review_ledgers_import')
})
