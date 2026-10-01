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

async function run(dbItem, { existing = false, completed = false, changeDuringRead = false, redo = false, unclaimed = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-export-source-'))
  const work = path.join(dir, 'scripts/csat/analysis-drain-hakpyeong')
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts/csat/data'), { recursive: true })
  const normal = { ...item, id: unclaimed ? 'H2603G3#19' : 'H2603G3#17', no: unclaimed ? 19 : 17 }
  fs.writeFileSync(path.join(dir, 'scripts/csat/data/corpus-hakpyeong.json'), JSON.stringify({ items: redo || unclaimed ? [normal, item] : [item] }))
  const input = path.join(work, 'chunk-R-TOPIC-H2603G3-18.json')
  const original = JSON.stringify({ items: [{ item_id: item.id, input_hash: 'old-export-input' }] })
  if (existing) fs.writeFileSync(input, original)
  if (completed) fs.writeFileSync(input.replace('.json', '.out.json'), JSON.stringify({ analyses: [{ item_id: item.id,
    reviews: ['setter', 'analyst', 'tutor'].map((persona) => ({ persona, verdict: 'pass' })) }] }))
  let reads = 0
  const units = buildUnits(dbItem.passage)
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/rest/v1/csat_items')) return res.end(JSON.stringify(redo || unclaimed ? [normal, dbItem] : [dbItem]))
    reads += 1
    res.end(JSON.stringify((redo || unclaimed ? [normal, item] : [item]).map((it) => ({ item_id: it.id, units_version: units.version, units_hash: unitsHash(units),
      input_hash: changeDuringRead && reads > 1 ? 'changed-input' : 'current-input', units: units.units }))))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, '--set', 'hakpyeong', '--limit', '1', ...(redo ? ['--redo', item.id] : [])], {
      cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    const corrections = fs.readdirSync(work).filter((f) => f.startsWith('chunk-redo-')).map((f) => JSON.parse(fs.readFileSync(path.join(work, f), 'utf8')))
    const fresh = path.join(work, 'chunk-R-TOPIC-H2603G3-19.json')
    return { code, output, input: fs.existsSync(input) ? fs.readFileSync(input, 'utf8') : null, original, corrections,
      fresh: fs.existsSync(fresh) ? JSON.parse(fs.readFileSync(fresh, 'utf8')) : null }
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
test('explicit redo gets a new chunk even with an earlier unfinished same-type item and limit one', async () => {
  const r = await run(item, { existing: true, redo: true })
  assert.equal(r.code, 0, r.output)
  assert.equal(r.input, r.original)
  assert.equal(r.corrections.length, 1)
  assert.deepEqual(r.corrections[0].items.map((it) => it.item_id), [item.id])
})
test('an existing earlier item does not swallow a fresh later item into a filename collision', async () => {
  const r = await run(item, { existing: true, unclaimed: true })
  assert.equal(r.code, 0, r.output)
  assert.equal(r.input, r.original)
  assert.deepEqual(r.fresh?.items.map((it) => it.item_id), ['H2603G3#19'])
})
for (const completed of [false, true]) {
  test(`export preserves original hash provenance for ${completed ? 'completed' : 'in-flight'} chunks`, async () => {
    const r = await run(item, { existing: true, completed })
    assert.equal(r.code, 0, r.output)
    assert.equal(r.input, r.original, 'existing analysis input was removed or rebound to a new hash')
  })
}
