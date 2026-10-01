// scripts/csat/__tests__/analysis-export-source.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildUnits, unitsHash } from '../lib-evidence-units.mjs'

const CLI = fileURLToPath(new URL('../analysis-drain-export.mjs', import.meta.url))
const item = { id: 'H2603G3#18', exam: 'H2603G3', no: 18, year: 2026, month: 3, in_scope: true,
  type_id: 'R-TOPIC', passage: 'A memory can change. Each recall rebuilds it.', stem: '주제를 고르시오.', choices: ['a', 'b', 'c', 'd', 'e'], answer: 3, answers: [3] }

async function run(dbItem, { existing = false, completed = false, changeDuringRead = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-export-source-'))
  const work = path.join(dir, 'scripts/csat/analysis-drain-hakpyeong')
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts/csat/data'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'scripts/csat/data/corpus-hakpyeong.json'), JSON.stringify({ items: [item] }))
  const input = path.join(work, 'chunk-R-TOPIC-H2603G3-18.json')
  const original = JSON.stringify({ items: [{ item_id: item.id, input_hash: 'old-export-input' }] })
  if (existing) fs.writeFileSync(input, original)
  if (completed) fs.writeFileSync(input.replace('.json', '.out.json'), JSON.stringify({ analyses: [{ item_id: item.id,
    reviews: ['setter', 'analyst', 'tutor'].map((persona) => ({ persona, verdict: 'pass' })) }] }))
  let reads = 0
  const units = buildUnits(dbItem.passage)
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/rest/v1/csat_items')) return res.end(JSON.stringify([dbItem]))
    reads += 1
    res.end(JSON.stringify([{ item_id: item.id, units_version: units.version, units_hash: unitsHash(units),
      input_hash: changeDuringRead && reads > 1 ? 'changed-input' : 'current-input', units: units.units }]))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, '--set', 'hakpyeong', '--limit', '1'], {
      cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    return { code, output, input: fs.existsSync(input) ? fs.readFileSync(input, 'utf8') : null, original }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

for (const [field, value] of [['passage', 'A memory may change. Each recall rebuilds it.'], ['stem', '다른 발문'], ['choices', ['e', 'd', 'c', 'b', 'a']], ['answer', 2]]) {
  test(`export cannot stamp a DB hash onto stale local ${field}`, async () => {
    const r = await run({ ...item, [field]: value })
    assert.notEqual(r.code, 0, r.output)
    assert.equal(r.input, null)
    assert.match(r.output, /원문|코퍼스/)
  })
}
test('export binds matching corpus text to current units', async () => {
  const r = await run(item)
  assert.equal(r.code, 0, r.output)
  assert.equal(JSON.parse(r.input).items[0].input_hash, 'current-input')
})
test('export refuses a source change during snapshot verification', async () => {
  const r = await run(item, { changeDuringRead: true })
  assert.notEqual(r.code, 0, r.output)
  assert.equal(r.input, null)
})
for (const completed of [false, true]) {
  test(`export preserves original hash provenance for ${completed ? 'completed' : 'in-flight'} chunks`, async () => {
    const r = await run(item, { existing: true, completed })
    assert.equal(r.code, 0, r.output)
    assert.equal(r.input, r.original, 'existing analysis input was removed or rebound to a new hash')
  })
}
