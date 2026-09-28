// scripts/csat/__tests__/drain-chunk-select.test.mjs
//
// 분석 드레인 `--chunk` — 게이트와 적재가 같은 파일 목록을 쓰는가.
// 실제 import·validate 스크립트를 임시 작업 폴더와 가짜 PostgREST 서버로 돌려 DB 요청을 전부 센다.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chunkArgs, DrainSelectError, selectOutFiles } from '../lib-drain-select.mjs'

const IMPORT = fileURLToPath(new URL('../analysis-drain-import.mjs', import.meta.url))

const PASSAGE =
  'People often assume that memory works like a recorder. In fact, each recall rebuilds the event from fragments, and every rebuilding can change it slightly.'
const CHOICES = ['a stable archive', 'a precise camera', 'an active reconstruction', 'a fading photograph', 'a shared diary']

const item = (id) => ({ id, exam: 'H2603G3', no: Number(id.split('#')[1]), passage: PASSAGE, choices: CHOICES, answer: 3 })

/** 게이트를 통과하는 최소 분석 */
const goodAnalysis = (id) => ({
  item_id: id,
  analyst_run: 'fix-rev-test-000001',
  measured_ability: '기억이 재구성된다는 주장을 사례 없이 추상 진술로 파악하는 능력',
  design_intent: '통념(기록 장치)과 필자 주장(재구성)을 대비시켜 주장 쪽을 고르게 한다',
  answer_locus: { sentences: [2], quote: 'each recall rebuilds the event from fragments' },
  choices: [
    { n: 1, verdict: 'distractor', trap: '반대 진술', why_tempting: '통념 문장의 단어를 그대로 쓴다', how_to_reject: '1번 문장은 통념이고 2번 문장이 반박한다' },
    { n: 2, verdict: 'distractor', trap: '어휘 함정', why_tempting: 'recorder 와 camera 가 연상된다', how_to_reject: '1번 문장의 recorder 는 반박 대상이다' },
    { n: 3, verdict: 'correct', why_correct: 'an active reconstruction 은 2번 문장 each recall rebuilds the event 를 그대로 바꿔 말한 것이다' },
    { n: 4, verdict: 'distractor', trap: '무관', why_tempting: '변한다는 말이 흐려진다로 읽힌다', how_to_reject: '2번 문장의 change 는 재구성이지 퇴색이 아니다' },
    { n: 5, verdict: 'distractor', trap: '무관', why_tempting: '기억을 공유한다는 연상이 생긴다', how_to_reject: '지문 어느 문장에도 공유 언급이 없다' },
  ],
  solve_procedure: [
    { step: '첫 문장이 통념 제시인지 확인한다', on_fail: 'In fact 를 찾아 전환점을 잡는다' },
    { step: 'In fact 뒤 문장에서 주장 동사를 찾는다', on_fail: 'rebuilds 를 표시한다' },
    { step: '주장 동사를 바꿔 말한 선지를 고른다', on_fail: '통념 단어를 쓴 선지부터 지운다' },
  ],
  time_budget_sec: 90,
  difficulty: { predicted: 0.5, drivers: ['통념 대비'] },
  required_vocab: ['rebuild'],
  reviews: ['setter', 'analyst', 'tutor'].map((persona) => ({ persona, verdict: 'pass', findings: [`${persona} ${id}`], checked: ['인용 대조'] })),
})
const badAnalysis = (id) => ({ item_id: id, analyst_run: 'wave2-templated-01', measured_ability: '짧다', reviews: [] })

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-chunk-select-'))
  const work = path.join(dir, 'scripts/csat/analysis-drain-hakpyeong')
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts/csat/data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'apps/web'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'apps/web/.env.local'), '')
  const ids = ['H2603G3#18', 'H2603G3#19', 'H2603G3#20']
  fs.writeFileSync(path.join(dir, 'scripts/csat/data/corpus-hakpyeong.json'), JSON.stringify({ items: ids.map(item) }))
  const put = (name, analyses) => fs.writeFileSync(path.join(work, `chunk-${name}.out.json`), JSON.stringify({ analyst_run: 'fix-rev-test-000001', analyses }))
  put('revise-test', [goodAnalysis('H2603G3#18')])
  put('R-WAVE2-H2603G3-19', [badAnalysis('H2603G3#19')]) // 선택하지 않은 wave-2 — 게이트 오류가 있다
  put('broken', [badAnalysis('H2603G3#20')])
  return { dir, work }
}

async function withServer(fn) {
  const reqs = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    reqs.push({ method: req.method, url: decodeURIComponent(req.url), body: body ? JSON.parse(body) : null })
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'GET') return res.end('[]')
    if (req.method === 'POST') return res.end(JSON.stringify({ id: '00000000-0000-0000-0000-00000000000' + reqs.length }))
    res.end('[]')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try { return await fn(`http://127.0.0.1:${server.address().port}`, reqs) } finally { server.close() }
}

async function runImport(dir, url, args) {
  const child = spawn(process.execPath, [IMPORT, '--set', 'hakpyeong', ...args], {
    cwd: dir,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (x) => { output += x })
  child.stderr.on('data', (x) => { output += x })
  const code = await new Promise((r) => child.on('close', r))
  return { code, output }
}

test('selectOutFiles: exact names only — missing, empty, and path selections throw', () => {
  const { dir, work } = setup()
  try {
    assert.deepEqual(selectOutFiles(work, ['revise-test']), ['chunk-revise-test.out.json'])
    assert.deepEqual(selectOutFiles(work, ['chunk-revise-test.out.json', 'chunk-broken']), ['chunk-broken.out.json', 'chunk-revise-test.out.json'])
    assert.equal(selectOutFiles(work, null).length, 3)
    assert.throws(() => selectOutFiles(work, ['revise']), DrainSelectError) // 조각은 strict 에서 안 된다
    assert.throws(() => selectOutFiles(work, ['nope']), DrainSelectError)
    assert.throws(() => selectOutFiles(work, []), DrainSelectError)
    assert.throws(() => selectOutFiles(work, ['']), DrainSelectError)
    assert.throws(() => selectOutFiles(work, ['../analysis-drain/chunk-x']), DrainSelectError)
    assert.throws(() => selectOutFiles(work, ['C:revise-test']), DrainSelectError)
    assert.deepEqual(selectOutFiles(work, ['revise'], { loose: true }), ['chunk-revise-test.out.json'])
    assert.throws(() => chunkArgs(['--chunk']), DrainSelectError)
    assert.deepEqual(chunkArgs(['--chunk', 'a,b', '--chunk', 'c']), ['a', 'b', 'c'])
    assert.equal(chunkArgs(['--commit']), null)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('unselected wave-2 errors do not block; only selected items are written, as in_review', async () => {
  const { dir } = setup()
  try {
    await withServer(async (url, reqs) => {
      const preview = await runImport(dir, url, ['--chunk', 'revise-test'])
      assert.equal(preview.code, 0, preview.output)
      assert.match(preview.output, /선택한 파일: chunk-revise-test\.out\.json/)
      assert.match(preview.output, /적재 대상 문항\(1\): H2603G3#18/)
      assert.equal(reqs.length, 0, '미리보기는 DB 에 가지 않는다')

      const r = await runImport(dir, url, ['--chunk', 'revise-test', '--commit'])
      assert.equal(r.code, 0, r.output)
      assert.match(r.output, /PASS/)
      const touched = reqs.map((q) => q.url + JSON.stringify(q.body))
      assert.ok(touched.every((s) => !s.includes('#19') && !s.includes('#20')), '선택 밖 문항에 요청이 갔다')
      const writes = reqs.filter((q) => q.method !== 'GET')
      assert.deepEqual(writes.map((q) => q.method), ['POST', 'PATCH'])
      assert.equal(writes[0].body.item_id, 'H2603G3#18')
      assert.equal(writes[0].body.status, 'draft')
      assert.equal(writes[1].body.status, 'in_review')
      assert.ok(!reqs.some((q) => JSON.stringify(q.body ?? '').includes('published')), '발행을 시도했다')
      assert.ok(!reqs.some((q) => /csat_analysis_reviews|csat_independent_reviews/.test(q.url)), '검수 행을 썼다')
    })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('selected chunk errors block the import with zero DB requests', async () => {
  const { dir } = setup()
  try {
    await withServer(async (url, reqs) => {
      const r = await runImport(dir, url, ['--chunk', 'revise-test,broken', '--commit'])
      assert.equal(r.code, 1, r.output)
      assert.match(r.output, /검수 게이트 실패/)
      assert.equal(reqs.length, 0)
    })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('missing, empty, or out-of-folder selections fail instead of falling back to the whole folder', async () => {
  const { dir } = setup()
  try {
    await withServer(async (url, reqs) => {
      for (const args of [['--chunk', 'nope', '--commit'], ['--chunk', '', '--commit'], ['--chunk', '--commit'], ['--chunk', '../x', '--commit']]) {
        const r = await runImport(dir, url, args)
        assert.equal(r.code, 1, `${args.join(' ')}\n${r.output}`)
      }
      assert.equal(reqs.length, 0)
      // 선택이 없으면 예전처럼 폴더 전체 — wave-2 오류가 게이트를 막는다
      const all = await runImport(dir, url, ['--commit'])
      assert.equal(all.code, 1, all.output)
      assert.equal(reqs.length, 0)
    })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('units: analysis whose units_hash differs from its chunk list is blocked at the gate with zero DB requests', async () => {
  const { dir, work } = setup()
  try {
    const units = [{ n: 1, text: PASSAGE.split('. ')[0] + '.' }, { n: 2, text: PASSAGE.split('. ')[1] }]
    const it = { ...item('H2603G3#18'), item_id: 'H2603G3#18', units_version: 1, units_hash: 'a'.repeat(64), units }
    fs.writeFileSync(path.join(work, 'chunk-revise-test.json'), JSON.stringify({ items: [it] }))
    const a = { ...goodAnalysis('H2603G3#18'), units_version: 1, units_hash: 'b'.repeat(64), answer_locus: { sentence_index: [2], quote: 'each recall rebuilds the event from fragments' } }
    fs.writeFileSync(path.join(work, 'chunk-revise-test.out.json'), JSON.stringify({ analyst_run: 'fix-rev-test-000001', analyses: [a] }))
    await withServer(async (url, reqs) => {
      const r = await runImport(dir, url, ['--chunk', 'revise-test', '--commit'])
      assert.equal(r.code, 1, r.output)
      assert.match(r.output, /units_hash 가 청크의 목록과 다르다/)
      assert.equal(reqs.length, 0)
    })
    // 같은 해시·맞는 번호면 게이트를 통과한다
    fs.writeFileSync(path.join(work, 'chunk-revise-test.out.json'), JSON.stringify({ analyst_run: 'fix-rev-test-000001', analyses: [{ ...a, units_hash: 'a'.repeat(64) }] }))
    await withServer(async (url) => {
      const r = await runImport(dir, url, ['--chunk', 'revise-test'])
      assert.equal(r.code, 0, r.output)
    })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
