// scripts/csat/__tests__/review-publish-precheck.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildUnits } from '../lib-evidence-units.mjs'

const CLI = fileURLToPath(new URL('../review-drain.mjs', import.meta.url))
const passage = 'A father realized that he had been wrong.'
const units = buildUnits(passage).units

test('publish keeps failed prechecks out of the publication RPC while publishing eligible rows', async () => {
  const rows = [
    { id: 'bad-rule', item_id: 'H2603G3#44', version: 1, status: 'in_review', solve_procedure: [{ step: '같은 문장에 다른 인물이 이름으로 따로 불리면 밑줄은 그 인물이 아니다' }] },
    { id: 'bad-quote', item_id: 'H2603G3#43', version: 1, status: 'in_review', answer_locus: { quote: 'A fabricated quotation.', sentence_index: [1] } },
    { id: 'good', item_id: 'H2603G3#18', version: 1, status: 'in_review', answer_locus: { quote: passage, sentence_index: [1] } },
  ]
  const writes = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    const url = decodeURIComponent(req.url)
    res.setHeader('Content-Type', 'application/json')
    if (url.startsWith('/rest/v1/csat_item_analyses')) return res.end(JSON.stringify(rows))
    if (url.startsWith('/rest/v1/rpc/csat_current_units_many')) return res.end(JSON.stringify(rows.map((row) => ({ item_id: row.item_id, units, units_version: 3, units_hash: 'units', input_hash: 'input' }))))
    if (url.startsWith('/rest/v1/rpc/csat_publish_hakpyeong')) {
      writes.push(JSON.parse(body))
      return res.end(JSON.stringify([{ item_id: 'H2603G3#18', ok: true }]))
    }
    res.statusCode = 500
    res.end(JSON.stringify({ message: 'Unexpected request' }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, 'publish'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)), windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (part) => { output += part })
    child.stderr.on('data', (part) => { output += part })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    assert.equal(code, 0, output)
    assert.deepEqual(writes, [{ p_analyses: ['good'] }])
    assert.match(output, /발행 1 · 게이트 거부 2/)
    assert.match(output, /H2603G3#44: 사전 검사 거부/)
    assert.match(output, /H2603G3#43: 사전 검사 거부/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
