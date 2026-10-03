// scripts/csat/__tests__/trap-atlas-scope.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const CLI = fileURLToPath(new URL('../build-trap-atlas.mjs', import.meta.url))

test('hakpyeong atlas scopes grade and organizer, counts distractors only, exports no source examples', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-atlas-'))
  const ids = ['2026#18', 'H2603G1#18', 'H2603G2#18', 'H2603G3#18']
  const items = ids.map((id) => ({ id, exam_id: id.split('#')[0], no: 18, type_id: 'R-PURPOSE' }))
  const exams = items.map((i) => ({ id: i.exam_id, label: i.exam_id, year: 2026 }))
  const analyses = ids.flatMap((item_id) => [1, 2].map((version) => ({ item_id, version, status: 'published', choice_analysis: [
    ...Array.from({ length: 8 }, (_, n) => ({ n: n + 1, verdict: 'distractor', trap: '무관', why_tempting: 'SOURCE MUST STAY IN DB', how_to_reject: 'SOURCE MUST STAY IN DB' })),
    { n: 9, verdict: 'correct', trap: '정답에 남은 옛 라벨' },
  ] })))
  items.push({ id: 'H2603G2#19', exam_id: 'H2603G2', no: 19, type_id: 'R-PURPOSE' })
  analyses.push({ ...analyses.find((a) => a.item_id === 'H2603G2#18'), item_id: 'H2603G2#19' },
    { item_id: 'H2603G2#19', version: 3, status: 'in_review', choice_analysis: [] })
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const table = req.url.split('?')[0].split('/').at(-1)
    res.end(JSON.stringify({ csat_items: items, csat_exams: exams, csat_types: [{ id: 'R-PURPOSE', name: '목적', status: 'active' }], csat_item_analyses: analyses }[table] ?? []))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, [CLI, '--set', 'hakpyeong', '--grade', '2', '--write'], { cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' } })
    let output = ''
    child.stdout.on('data', (s) => { output += s })
    child.stderr.on('data', (s) => { output += s })
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
    assert.equal(code, 0, output)
    const file = path.join(dir, 'apps/web/src/lib/csat/trap-atlas-hakpyeong-g2.json')
    const raw = fs.readFileSync(file, 'utf8')
    const atlas = JSON.parse(raw)
    assert.equal(atlas.organizer, 'edu_office')
    assert.equal(atlas.grade, 2)
    assert.equal(atlas.corpus.items, 2)
    assert.equal(atlas.corpus.analyzed, 1)
    assert.equal(atlas.corpus.distractors, 8, 'latest version only, no correct-choice trap')
    assert.deepEqual(atlas.traps[0].examples, [])
    assert.doesNotMatch(raw, /SOURCE MUST STAY IN DB|정답에 남은 옛 라벨/)
    assert.equal(fs.existsSync(path.join(dir, 'apps/web/src/lib/csat/trap-atlas.json')), false)
    fs.writeFileSync(file, '{}\n')
    const check = spawn(process.execPath, [CLI, '--set', 'hakpyeong', '--grade', '2', '--check'], { cwd: dir, windowsHide: true,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' } })
    let checkOutput = ''
    check.stdout.on('data', (s) => { checkOutput += s })
    check.stderr.on('data', (s) => { checkOutput += s })
    const checkCode = await new Promise((resolve, reject) => { check.on('error', reject); check.on('close', resolve) })
    assert.equal(checkCode, 1)
    assert.match(checkOutput, /build-trap-atlas\.mjs --set hakpyeong --grade 2 --write/)
    assert.equal(fs.readFileSync(file, 'utf8'), '{}\n')
    assert.equal(fs.existsSync(path.join(dir, 'apps/web/src/lib/csat/trap-atlas.json')), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
