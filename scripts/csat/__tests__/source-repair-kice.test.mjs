// scripts/csat/__tests__/source-repair-kice.test.mjs
// 평가원(수능·모평) 원문 수리가 원장 재생성에서 살아남는지 — 대량작업 C(2026-10-24): 2014A#29 각주 · 선지 끝 잔여물이
// 재생성 때마다 되살아났고, 재생성 원장을 전체 동기화하면 DB 정정값을 덮어쓸 수 있었다.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { repairPdfFolder, repairRecipeFile, repairSetOf, sourceDigest, sourceOverwrites } from '../lib-source-repair.mjs'

const repo = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const BUILD = path.join(repo, 'scripts/csat/build-corpus.mjs')

test('문항 ID 로 집합 · 수리 목록 · 공식 문제지 폴더를 고른다', () => {
  assert.equal(repairSetOf('2014A#29'), 'kice')
  assert.equal(repairSetOf('M2509#25'), 'kice')
  assert.equal(repairSetOf('H2603G1#26'), 'hakpyeong')
  assert.equal(repairSetOf('X#1'), null)
  assert.equal(repairRecipeFile('kice'), 'kice-source-repairs.json')
  assert.equal(repairRecipeFile('hakpyeong'), 'hakpyeong-source-repairs.json')
  const env = { CSAT_KICE_SUNEUNG_DIR: '/s', CSAT_KICE_MOCK_DIR: '/m', CSAT_HAKPYEONG_DIR: '/h' }
  assert.equal(repairPdfFolder('2017#24', env), '/s')
  assert.equal(repairPdfFolder('M2509#25', env), '/m')
  assert.equal(repairPdfFolder('H2603G1#26', env), '/h')
  assert.throws(() => repairPdfFolder('X#1', env), /집합/)
})

test('전체 동기화 가드 — DB 와 다른 지문·선지만 잡고, 같은 값 · DB 에 없는 새 문항은 통과', () => {
  const db = [
    { id: 'A#1', passage: 'fixed * footnote.', choices: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'A#2', passage: 'same', choices: ['a', 'b', 'c', 'd', 'e.'] },
    { id: 'A#3', passage: 'same', choices: ['a', 'b', 'c', 'd', 'e'] },
  ]
  const corpus = [
    { id: 'A#1', passage: 'fixed month.', choices: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'A#2', passage: 'same', choices: ['a', 'b', 'c', 'd', 'e. 8'] },
    { id: 'A#3', passage: 'same', choices: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'A#4', passage: 'new', choices: ['a', 'b', 'c', 'd', 'e'] },
  ]
  assert.deepEqual(sourceOverwrites(db, corpus), ['A#1', 'A#2'])
})

// source-repair CLI — 가짜 Supabase(REST) 로 평가원 계획을 커밋한다. 수리 기록은 평가원 목록 · 평가원 원장에 남는다.
async function runCli(rows, repairs, env = {}) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-repair-kice-'))
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    requests.push(req.method)
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'GET') return res.end(JSON.stringify(rows))
    if (req.method === 'PATCH') return res.end(JSON.stringify([{ id: rows[0].id }]))
    res.statusCode = 405
    res.end('{}')
  })
  try {
    fs.mkdirSync(path.join(fixture, 'scripts/csat/data'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'paper.pdf'), Buffer.from('fictional kice paper'))
    fs.writeFileSync(path.join(fixture, 'plan.json'), JSON.stringify({ repairs }))
    fs.writeFileSync(path.join(fixture, 'scripts/csat/data/corpus.json'), JSON.stringify({ items: rows }))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = `http://127.0.0.1:${server.address().port}`
    const child = spawn(process.execPath, [path.join(repo, 'scripts/csat/source-repair.mjs'), '--file', 'plan.json', '--commit'], {
      cwd: fixture,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: address, SUPABASE_URL: address, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', CSAT_KICE_SUNEUNG_DIR: fixture, CSAT_KICE_MOCK_DIR: fixture, CSAT_HAKPYEONG_DIR: fixture, ...env },
    })
    let log = ''
    child.stdout.on('data', (b) => { log += b })
    child.stderr.on('data', (b) => { log += b })
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
    const read = (f) => (fs.existsSync(path.join(fixture, 'scripts/csat/data', f)) ? JSON.parse(fs.readFileSync(path.join(fixture, 'scripts/csat/data', f), 'utf8')) : null)
    return { code, log, requests, recipe: read('kice-source-repairs.json'), hakRecipe: read('hakpyeong-source-repairs.json'), corpus: read('corpus.json') }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(fixture, { recursive: true, force: true })
  }
}

test('source-repair CLI: 평가원 계획은 평가원 수리 목록 · corpus.json 에 남는다', async () => {
  const row = { id: '2017#24', type_id: 'R-CHART', stem: 'Synthetic chart question', passage: 'Synthetic passage.', choices: ['a', 'b', 'c', 'd', 'e. 8'], answer: 3, answers: [3], body_ok: true }
  const repair = { item_id: row.id, pdf_file: 'paper.pdf', pdf_sha256: sourceDigest(Buffer.from('fictional kice paper')), before: { choices: row.choices }, after: { choices: ['a', 'b', 'c', 'd', 'e.'] } }
  const r = await runCli([row], [repair])
  assert.equal(r.code, 0, r.log)
  assert.deepEqual(r.recipe.repairs, [repair])
  assert.equal(r.hakRecipe, null)
  assert.deepEqual(r.corpus.items[0].choices, repair.after.choices)
  assert.deepEqual(r.requests, ['GET', 'PATCH'])
})

test('source-repair CLI: 학평과 평가원을 한 계획에 섞으면 DB 를 읽기 전에 거부한다', async () => {
  const pdf = sourceDigest(Buffer.from('fictional kice paper'))
  const repairs = [
    { item_id: '2017#24', pdf_file: 'paper.pdf', pdf_sha256: pdf, before: { passage: 'x' }, after: { passage: 'y' } },
    { item_id: 'H2603G1#26', pdf_file: 'paper.pdf', pdf_sha256: pdf, before: { passage: 'x' }, after: { passage: 'y' } },
  ]
  const r = await runCli([], repairs)
  assert.notEqual(r.code, 0)
  assert.match(r.log, /한 집합/)
  assert.deepEqual(r.requests, [])
})

// corpus-sync 전체 동기화 가드 — DB 원문이 원장과 다르면 쓰기 요청 없이 멈춘다.
async function runSync(dbRows, item) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-sync-guard-'))
  const methods = []
  const server = http.createServer(async (req, res) => {
    for await (const _ of req);
    methods.push(req.method)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(req.method === 'GET' ? dbRows : []))
  })
  try {
    fs.mkdirSync(path.join(fixture, 'scripts/csat/data'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'scripts/csat/data/corpus.json'), JSON.stringify({ items: [item] }))
    fs.writeFileSync(path.join(fixture, 'scripts/csat/data/classified.json'), JSON.stringify({ types: [] }))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = `http://127.0.0.1:${server.address().port}`
    const child = spawn(process.execPath, [path.join(repo, 'scripts/csat/corpus-sync.mjs'), '--commit'], {
      cwd: fixture,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: address, SUPABASE_URL: address, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key' },
    })
    let log = ''
    child.stdout.on('data', (b) => { log += b })
    child.stderr.on('data', (b) => { log += b })
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
    return { code, log, methods }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(fixture, { recursive: true, force: true })
  }
}
const syncItem = { id: '2014A#29', exam: '2014A', exam_label: '2014 수능 A', exam_kind: 'suneung', year: 2014, month: 11, no: 29, section: '독해', in_scope: true, type_id: null, stem: 's', passage: 'Hours * 5:00 p.m. month. Fees', choices: ['a', 'b', 'c', 'd', 'e'], answer: 3, answers: [3], points: 2, high_score: false }

test('corpus-sync: 재생성 원장이 DB 정정 원문과 다르면 쓰지 않고 멈춘다', async () => {
  const r = await runSync([{ id: '2014A#29', passage: 'Hours* 5:00 p.m. * The museum is closed on the first Monday of every month. Fees', choices: syncItem.choices }], syncItem)
  assert.notEqual(r.code, 0)
  assert.match(r.log, /DB 원문과 다른 문항 1개/)
  assert.ok(r.methods.every((m) => m === 'GET'), `쓰기 요청이 있었다: ${r.methods}`)
})

test('corpus-sync: 원문이 같으면 가드는 통과하고 동기화가 진행된다', async () => {
  const r = await runSync([{ id: '2014A#29', passage: syncItem.passage, choices: syncItem.choices }], syncItem)
  assert.doesNotMatch(r.log, /DB 원문과 다른/)
  assert.ok(r.methods.includes('POST'), `upsert 가 없었다: ${r.methods} ${r.log}`)
})

// 실제 build-corpus 를 임시 작업 폴더(입력 사본)에서 돌린다 — 저장소의 corpus.json 은 건드리지 않는다.
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kice-repair-'))
  fs.cpSync(path.join(repo, 'scripts/csat/data'), path.join(dir, 'scripts/csat/data'), {
    recursive: true,
    filter: (src) => !/(^|[\\/])(corpus|corpus-hakpyeong)\.json$|kice-source-repairs\.json$/.test(src),
  })
  fs.mkdirSync(path.join(dir, 'pdf'))
  return dir
}
const build = (dir) => spawnSync(process.execPath, [BUILD], { cwd: dir, encoding: 'utf8', env: { ...process.env, CSAT_KICE_SUNEUNG_DIR: path.join(dir, 'pdf') } })
const corpusOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'scripts/csat/data/corpus.json'), 'utf8'))

test('build-corpus 가 평가원 수리 목록을 입히고, 정본 PDF 가 바뀌면 멈춘다', { timeout: 300_000 }, () => {
  const dir = sandbox()
  try {
    assert.equal(build(dir).status, 0, '수리 없는 기준 재생성')
    const baseline = corpusOf(dir).items
    const base = baseline.find((x) => x.id === '2017#24')
    const after = base.choices.map((c, i) => (i === 4 ? c.replace(/\s+8$/, '') : c))
    assert.notDeepEqual(after, base.choices, '현재 추출에는 쪽번호 잔여물이 있다(전제)')
    const pdf = Buffer.from('fictional 2017 paper')
    fs.writeFileSync(path.join(dir, 'pdf', 'paper.pdf'), pdf)
    const recipe = { repairs: [{ item_id: '2017#24', pdf_file: 'paper.pdf', pdf_sha256: sourceDigest(pdf), before: { choices: base.choices }, after: { choices: after } }] }
    fs.writeFileSync(path.join(dir, 'scripts/csat/data/kice-source-repairs.json'), JSON.stringify(recipe))

    assert.equal(build(dir).status, 0, '수리 목록을 입힌 재생성')
    const repaired = corpusOf(dir).items
    assert.deepEqual(repaired.find((x) => x.id === '2017#24').choices, after)
    // 목록 밖 문항은 수리 전 원장과 같아야 한다(Codex T-0153 P2: 재생성 파일끼리 비교하면 아무것도 못 잡는다)
    const changedOthers = repaired.filter((x) => x.id !== '2017#24' && JSON.stringify(x) !== JSON.stringify(baseline.find((b) => b.id === x.id)))
    assert.deepEqual(changedOthers.map((x) => x.id), [], '목록에 없는 문항은 그대로')
    assert.equal(repaired.length, baseline.length)

    fs.writeFileSync(path.join(dir, 'pdf', 'paper.pdf'), Buffer.from('another paper'))
    const changed = build(dir)
    assert.notEqual(changed.status, 0)
    assert.match(changed.stderr, /PDF 정본 해시/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
