// scripts/csat/__tests__/units-build.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildUnits, unitsHash, UNITS_VERSION } from '../lib-evidence-units.mjs'

const CLI = fileURLToPath(new URL('../units-build.mjs', import.meta.url))
const item = { id: 'H2603G3#18', type_id: 'R-TOPIC', passage: 'John B. Watson studied behavior. His work is discussed today.', input_hash: 'current-input' }
const current = buildUnits(item.passage)
const row = (version, units = current.units, input = item.input_hash) => ({
  item_id: item.id, units_version: version, units, input_hash: input, units_hash: unitsHash({ version, units }),
})

async function run(rows, commit = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-units-build-'))
  const writes = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/rest/v1/rpc/csat_units_build_input')) return res.end(JSON.stringify([item]))
    if (req.method === 'GET') return res.end(JSON.stringify(rows))
    writes.push(JSON.parse(body))
    res.end('[]')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, '--set', 'hakpyeong', ...(commit ? ['--commit'] : [])], {
      cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    return { code, output, writes }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('same boundaries keep old units and do not trigger published-analysis holds', async () => {
  const r = await run([row(1)])
  assert.equal(r.code, 0, r.output)
  assert.match(r.output, /경계 불변\(옛 버전 유지\) 1/)
  assert.deepEqual(r.writes, [])
})

test('changed middle-initial boundaries create only the current-version row; rerun writes nothing', async () => {
  const old = [{ start: 0, end: 7 }, { start: 8, end: 31 }, { start: 32, end: item.passage.length }]
  const r = await run([row(1, old)])
  assert.equal(r.code, 0, r.output)
  assert.equal(r.writes.length, 1)
  assert.deepEqual(r.writes[0], [row(UNITS_VERSION)])
  const again = await run([row(1, old), row(UNITS_VERSION)])
  assert.equal(again.code, 0, again.output)
  assert.deepEqual(again.writes, [])
})

test('equal boundaries belonging to a different source hash cannot suppress a new row', async () => {
  const r = await run([row(1, current.units, 'old-input')])
  assert.equal(r.code, 0, r.output)
  assert.deepEqual(r.writes, [[row(UNITS_VERSION)]])
})

test('same-version conflicting boundaries stop before all writes', async () => {
  const r = await run([{ ...row(UNITS_VERSION), units_hash: 'conflicting' }])
  assert.notEqual(r.code, 0)
  assert.match(r.output, /충돌 1/)
  assert.deepEqual(r.writes, [])
})

test('preview never writes even if units are missing', async () => {
  const r = await run([], false)
  assert.equal(r.code, 0, r.output)
  assert.match(r.output, /새로 1/)
  assert.deepEqual(r.writes, [])
})
