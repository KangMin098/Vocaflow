// tests/control.test.mjs — node --test --test-concurrency=1 tests/control.test.mjs
//
// 모든 테스트는 임시 VFC_ROOT 에서 돈다(실제 state/ · runtime/ 를 건드리지 않는다).
// CLI 를 실제 자식 프로세스로 실행한다 — 잠금·원자 쓰기·동시성은 프로세스 경계에서만 의미가 있다.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(REPO, 'bin', 'vfc.mjs')
const sleepers = []
const OWNER = 'r0-learning-journey'

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-test-'))
}

function run(rootDir, args, extraEnv = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { env: { ...process.env, VFC_ROOT: rootDir, VFC_REVIEW_VERDICTS: path.join(rootDir, "verdicts.jsonl"), ...extraEnv }, encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

function runAsync(rootDir, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, VFC_ROOT: rootDir, VFC_REVIEW_VERDICTS: path.join(rootDir, "verdicts.jsonl"), ...extraEnv } })
    let out = ''
    let err = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (err += d))
    c.on('close', (code) => resolve({ code, out, err }))
  })
}

/** 살아 있는 「에이전트」 역할 프로세스. 잠금 소유자 pid 로 쓴다. */
function sleeper() {
  const c = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 600000)'], { stdio: 'ignore' })
  sleepers.push(c)
  return c
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function state(rootDir, name) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'state', name), 'utf8'))
}

function mkWorktree(branch = 'feat/test') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-wt-'))
  execFileSync('git', ['init', '-q', '-b', branch, d])
  return d
}

function writeJson(dir, name, obj) {
  const f = path.join(dir, name)
  fs.writeFileSync(f, JSON.stringify(obj))
  return f
}

function taskSpec(over = {}) {
  return {
    goal_id: 'VG-L3-A2-01',
    title: 'test task',
    description: 'test',
    priority: 'P2',
    owner_id: OWNER,
    allowed_paths: ['docs/x/**'],
    forbidden_paths: ['supabase/migrations/**'],
    acceptance: ['조건 0', '조건 1'],
    ...over,
  }
}

/** init + 테스트 owner 의 worktree 바인딩까지 마친 루트 */
function setup({ branch = 'feat/test' } = {}) {
  const root = mkRoot()
  const r = run(root, ['init', '--by', 'test'])
  assert.equal(r.code, 0, r.err)
  const wt = mkWorktree(branch)
  assert.equal(run(root, ['owner', 'bind-worktree', OWNER, wt, '--branch', branch]).code, 0)
  fs.mkdirSync(path.join(root, 'verification', 'tests'), { recursive: true })
  fs.mkdirSync(path.join(root, 'verification', 'reviews'), { recursive: true })
  fs.writeFileSync(path.join(root, 'verification', 'tests', 'run.log'), 'ok')
  fs.writeFileSync(path.join(root, 'verification', 'reviews', 'r.md'), '# review')
  return { root, wt }
}

function addTask(root, over) {
  const f = writeJson(root, `spec-${crypto.randomBytes(4).toString('hex')}.json`, taskSpec(over))
  const r = run(root, ['task', 'add', '--file', f, '--json'])
  assert.equal(r.code, 0, r.err)
  return JSON.parse(r.out)
}

function start(root, id, pid, owner = OWNER, extraEnv) {
  return run(root, ['task', 'start', id, '--owner', owner, '--agent', 'claude', '--session', `s-${pid}`, '--pid', String(pid), '--json'], extraEnv)
}

function evidence(root, id, over = {}, by = OWNER) {
  const f = writeJson(root, `ev-${crypto.randomBytes(4).toString('hex')}.json`, { type: 'unit', command_or_protocol: 'node --test', result: 'pass', skip_count: 0, artifact_path_or_url: 'verification/tests/run.log', observed_at: new Date().toISOString(), covers: [0, 1], ...over })
  return run(root, ['task', 'evidence', id, '--file', f, '--by', by])
}

const locks = (root) => JSON.parse(run(root, ['lock', 'list', '--json']).out)

after(() => {
  for (const s of sleepers) s.kill()
})

// ── 1. 정본 로드 · JSON 검증 ─────────────────────────────────────────────

test('정본 로드: 실제 STEP 2 정본이 검증을 통과한다', () => {
  const r = run(mkRoot(), ['goals', 'validate', '--json'])
  assert.equal(r.code, 0, r.out)
  const v = JSON.parse(r.out)
  assert.equal(v.ok, true)
  assert.equal(v.facts.canon_version, '1.1.0')
  assert.equal(v.facts.sealed_version, '1.1.0')
  assert.equal(v.facts.criteria_count, 40)
  assert.deepEqual(v.facts.level_counts, { 0: 1, 1: 4, 2: 10, 3: 20, 4: 5 })
  assert.equal(v.facts.approved_at, '2026-10-09')
})

function canonCopy(mutate) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-goals-'))
  for (const f of fs.readdirSync(path.join(REPO, 'goals'))) fs.copyFileSync(path.join(REPO, 'goals', f), path.join(d, f))
  mutate(d)
  return d
}

const editCriteria = (fn, keepSeal = false) =>
  canonCopy((d) => {
    if (!keepSeal) fs.rmSync(path.join(d, 'CANON_MANIFEST.json'), { force: true })
    const f = path.join(d, 'GOAL_ACCEPTANCE_CRITERIA.json')
    const j = JSON.parse(fs.readFileSync(f, 'utf8'))
    fn(j)
    fs.writeFileSync(f, JSON.stringify(j))
  })

const validateIn = (dir) => run(mkRoot(), ['goals', 'validate'], { VFC_GOALS_DIR: dir })

test('봉인: 정본 변조 · 빈 manifest · 봉인 버전 불일치를 거부한다', () => {
  const tampered = canonCopy((d) => fs.appendFileSync(path.join(d, 'PROJECT_GOAL.md'), '\n무단 수정\n'))
  const r = run(mkRoot(), ['goals', 'validate', '--json'], { VFC_GOALS_DIR: tampered })
  assert.equal(r.code, 1)
  assert.match(r.out, /해시 불일치/)
  const empty = canonCopy((d) => {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'CANON_MANIFEST.json'), 'utf8'))
    m.files = {}
    fs.writeFileSync(path.join(d, 'CANON_MANIFEST.json'), JSON.stringify(m))
  })
  assert.match(validateIn(empty).out, /manifest 에 정본 PROJECT_GOAL\.md 가 없다/)
  const ver = canonCopy((d) => {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'CANON_MANIFEST.json'), 'utf8'))
    m.canon_version = '9.9.9'
    fs.writeFileSync(path.join(d, 'CANON_MANIFEST.json'), JSON.stringify(m))
  })
  assert.match(validateIn(ver).out, /봉인 버전 9\.9\.9/)
  const nul = canonCopy((d) => fs.writeFileSync(path.join(d, 'CANON_MANIFEST.json'), 'null'))
  assert.match(validateIn(nul).out, /manifest 는 객체/)
})

test('재봉인은 사용자 APPROVED canon_change 결정 없이는 거부한다', () => {
  const root = mkRoot()
  run(root, ['init'])
  const d = canonCopy(() => {})
  assert.match(run(root, ['goals', 'seal'], { VFC_GOALS_DIR: d }).err, /ALREADY_SEALED/)
  assert.match(run(root, ['goals', 'seal', '--decision', 'DL-0001'], { VFC_GOALS_DIR: d }).err, /RESEAL_NOT_APPROVED/)
  assert.match(run(root, ['goals', 'seal', '--decision', 'whatever'], { VFC_GOALS_DIR: d }).err, /RESEAL_NOT_APPROVED/)
})

test('JSON 검증: 깨진 JSON · 중복 id · 끊긴 parent · CSAT 축소 · 타입 · 승인 상태 · 전략 불일치를 거부한다', () => {
  const broken = canonCopy((d) => {
    fs.rmSync(path.join(d, 'CANON_MANIFEST.json'))
    fs.writeFileSync(path.join(d, 'GOAL_ACCEPTANCE_CRITERIA.json'), '{ "criteria": [ ')
  })
  assert.match(validateIn(broken).out, /파싱 실패/)
  const cases = [
    [(j) => j.criteria.push({ ...j.criteria[5] }), /goal id 중복/],
    [(j) => (j.criteria.find((c) => c.id === 'VG-L3-A2-01').parent_id = 'VG-L2-ZZ'), /parent VG-L2-ZZ 가 없다/],
    [(j) => (j.criteria.find((c) => c.id === 'VG-L0').title = '수능 영어 점수 향상 플랫폼'), /수능\/CSAT 로 축소/],
    [(j) => (j.policy.skip_is_pass = true), /skip_is_pass/],
    [(j) => (j.criteria.find((c) => c.id === 'VG-L3-A2-01').acceptance[0].condition = null), /condition 은 비지 않은 문자열/],
    [(j) => (j.criteria.find((c) => c.id === 'VG-L3-A2-01').acceptance[0].required_evidence = []), /required_evidence/],
    [(j) => (j.criteria.find((c) => c.id === 'VG-L3-A2-01').acceptance[0].status = null), /status 는 비지 않은 문자열/],
    [(j) => (j.strategic_decisions[0].approval_status = 'not_approved'), /approval_status=not_approved/],
    [(j) => (j.r0_scope.target_learner = '고3 수능 대비'), /R0 대상이 수능/],
    [(j) => (j.r0_scope.entry = 'signup_first'), /SD-R0-02/],
    [(j) => (j.r0_scope.required_journey = j.r0_scope.required_journey.filter((x) => x !== 'unseen_transfer')), /unseen_transfer/],
  ]
  for (const [fn, re] of cases) {
    const r = validateIn(editCriteria(fn))
    assert.equal(r.code, 1, String(re))
    assert.match(r.out, re)
  }
  const noScope = canonCopy((d) => {
    fs.rmSync(path.join(d, 'CANON_MANIFEST.json'))
    const f = path.join(d, 'PROJECT_GOAL.md')
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/듣기/g, 'listening'))
  })
  assert.match(validateIn(noScope).out, /플랫폼 영역이 빠졌다: 듣기/)
})

test('init 은 멱등이고 근거 없는 목표는 UNKNOWN 이다', () => {
  const root = mkRoot()
  assert.equal(run(root, ['init']).code, 0)
  const second = JSON.parse(run(root, ['init', '--json']).out)
  assert.deepEqual(second, { goals: 0, gates: 0, owners: 0, decisions: 0, tasks: 0, upgraded: 0 })
  const gs = state(root, 'GOAL_STATUS.json')
  assert.equal(Object.keys(gs.goals).length, 35)
  for (const g of Object.values(gs.goals)) {
    assert.notEqual(g.status, 'PASS', `${g.id} 가 근거 없이 PASS`)
    if (g.status === 'FAIL') assert.ok(g.evidence_paths.every((e) => e.startsWith('verification/')))
  }
})

// ── 2. 잘못된 goal_id 거부 · 작업 등록 · 소유권 ─────────────────────────

test('잘못된 입력을 거부한다(goal_id · related · owner · approval_required · task_id 형식)', () => {
  const { root } = setup()
  for (const [over, re] of [
    [{ goal_id: 'VG-L3-NOPE' }, /정본에 없다/],
    [{ goal_id: 'VG-L2-A2' }, /L3 여야 한다/],
    [{ goal_id: 'VG-L4-TEMPLATE-TEST' }, /템플릿/],
    [{ related_goal_ids: ['VG-X'] }, /related goal VG-X/],
    [{ owner_id: 'vocaflow-f5' }, /등록되지 않았다/],
    [{ approval_required: true }, /approval_kinds 를 하나 이상/],
    [{ approval_required: false, db_scope: { mode: 'write', targets: ['dev:x'] } }, /승인을 끌 수 없다/],
    [{ task_id: 'X-1' }, /형식/],
  ]) {
    const f = writeJson(root, 'bad.json', taskSpec(over))
    const r = run(root, ['task', 'add', '--file', f])
    assert.equal(r.code, 2, JSON.stringify(over))
    assert.match(r.err, re)
  }
})

test('명시적 task_id 뒤 자동 id 가 겹치지 않는다', () => {
  const { root } = setup()
  addTask(root, { task_id: 'T-0007' })
  const ids = [addTask(root).task_id, addTask(root).task_id, addTask(root).task_id]
  const all = state(root, 'TASK_QUEUE.json').tasks.map((t) => t.task_id)
  assert.equal(new Set(all).size, all.length, all.join(','))
  assert.ok(!ids.includes('T-0007'))
})

test('작업 등록과 소유권: 세션이 바뀌어도 작업은 owner_id 에 남는다', () => {
  const { root } = setup()
  const t = addTask(root)
  assert.equal(t.status, 'READY')
  assert.equal(run(root, ['owner', 'bind-session', OWNER, '--agent', 'claude', '--session', 'vocaflow-f5']).code, 0)
  assert.equal(run(root, ['owner', 'bind-session', OWNER, '--agent', 'claude', '--session', 'vocaflow-f9']).code, 0)
  const o = state(root, 'OWNERSHIP_REGISTRY.json').owners[OWNER]
  assert.equal(o.current_session.label, 'vocaflow-f9')
  assert.equal(o.session_history.at(-1).label, 'vocaflow-f5')
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).owner_id, OWNER)
  assert.equal(run(root, ['owner', 'add', 'Vocaflow F5', '--purpose', 'x']).code, 2)
})

test('남의 worktree 는 묶을 수 없고, 대소문자만 다른 경로도 같은 worktree 다', () => {
  const { root, wt } = setup()
  assert.match(run(root, ['owner', 'bind-worktree', 'content-pipeline', wt]).err, /이미 r0-learning-journey/)
  assert.match(run(root, ['owner', 'bind-worktree', 'content-pipeline', wt.toUpperCase()]).err, /이미 r0-learning-journey/)
})

test('DB 쓰기 소유자는 대상별 하나이고, 기존 범위 변경은 승인 결정이 필요하다', () => {
  const root = mkRoot()
  run(root, ['init'])
  assert.match(run(root, ['owner', 'add', 'content-pipeline', '--db', 'dev:jajenrevcbmrpaliomxv']).err, /DB_SCOPE_CHANGE|DB_SCOPE_TAKEN/)
  assert.match(run(root, ['owner', 'add', 'new-owner', '--purpose', 'x', '--db', 'dev:jajenrevcbmrpaliomxv']).err, /DB_SCOPE_TAKEN/)
  assert.match(run(root, ['owner', 'add', 'data-contract', '--db', '']).err, /DB_SCOPE_CHANGE/)
})

// ── 3. 중복 실행 · worktree 잠금 · 반납 ──────────────────────────────────

test('worktree 없는 작업은 시작할 수 없다(잠금 없이 파일을 바꾸지 못하게)', () => {
  const { root } = setup()
  const t = addTask(root)
  assert.match(start(root, t.task_id, sleeper().pid).err, /WORKTREE_REQUIRED/)
})

test('같은 작업의 중복 실행을 거부하고, 남이 내 작업을 시작·제출할 수 없다', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  assert.match(start(root, t.task_id, sleeper().pid, 'content-pipeline').err, /NOT_OWNER/)
  const s = sleeper()
  assert.equal(start(root, t.task_id, s.pid).code, 0)
  assert.match(start(root, t.task_id, s.pid).err, /ALREADY_RUNNING/)
  assert.equal(evidence(root, t.task_id).code, 0)
  assert.match(run(root, ['task', 'submit', t.task_id, '--by', 'content-pipeline']).err, /NOT_OWNER/)
  assert.match(run(root, ['task', 'block', t.task_id, '--by', 'content-pipeline', '--reason', 'x']).err, /NOT_OWNER/)
  assert.match(run(root, ['task', 'fail', t.task_id, '--by', 'content-pipeline', '--reason', 'x']).err, /NOT_OWNER/)
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).status, 'IN_PROGRESS')
})

test('동시 프로세스 8개가 같은 작업을 시작하면 정확히 하나만 성공한다', async () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  const pids = Array.from({ length: 8 }, () => sleeper().pid)
  const rs = await Promise.all(pids.map((pid) => runAsync(root, ['task', 'start', t.task_id, '--owner', OWNER, '--agent', 'claude', '--session', `c${pid}`, '--pid', String(pid)])))
  assert.equal(rs.filter((r) => r.code === 0).length, 1, rs.map((r) => r.err).join('\n'))
  assert.equal(rs.filter((r) => r.code === 2).length, 7)
  assert.equal(state(root, 'ACTIVE_TASKS.json').tasks.length, 1)
})

test('같은 worktree 의 두 작업은 동시에 돌 수 없고, 반납 후에는 된다(제품 .agent-lock 포함)', async () => {
  const { root, wt } = setup()
  const a = addTask(root, { worktree: wt, branch: 'feat/test', title: 'A' })
  const b = addTask(root, { worktree: wt, branch: 'feat/test', title: 'B' })
  const [pa, pb] = [sleeper().pid, sleeper().pid]
  const rs = await Promise.all([
    runAsync(root, ['task', 'start', a.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'sa', '--pid', String(pa)]),
    runAsync(root, ['task', 'start', b.task_id, '--owner', OWNER, '--agent', 'codex', '--session', 'sb', '--pid', String(pb)]),
  ])
  assert.equal(rs.filter((r) => r.code === 0).length, 1)
  assert.match(rs.find((r) => r.code !== 0).err, /LOCK_HELD.*worktree/s)
  const winner = rs[0].code === 0 ? a : b
  const other = winner === a ? b : a
  assert.ok(!locks(root).some((l) => l.name.includes(other.task_id)), '진 쪽은 task 잠금을 남기지 않는다')
  const pl = JSON.parse(fs.readFileSync(path.join(wt, '.agent-lock'), 'utf8'))
  assert.ok(pl.vfc_token, 'vfc 가 제품 .agent-lock 도 잡는다')
  assert.equal(evidence(root, winner.task_id).code, 0)
  assert.equal(run(root, ['task', 'submit', winner.task_id, '--by', OWNER]).code, 0)
  assert.deepEqual(locks(root), [])
  assert.ok(!fs.existsSync(path.join(wt, '.agent-lock')), '제출 후 제품 잠금도 반납')
  assert.equal(start(root, other.task_id, sleeper().pid).code, 0)
})

test('제품 worktree 의 .agent-lock 이 남의 것이거나 읽을 수 없으면 시작을 거부한다', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  const holder = sleeper()
  fs.writeFileSync(path.join(wt, '.agent-lock'), JSON.stringify({ agent: 'codex', pid: holder.pid, host: os.hostname(), branch: 'feat/test' }))
  assert.match(start(root, t.task_id, sleeper().pid).err, /PRODUCT_LOCK_HELD/)
  fs.writeFileSync(path.join(wt, '.agent-lock'), '{ broken')
  assert.match(start(root, t.task_id, sleeper().pid).err, /PRODUCT_LOCK_UNREADABLE/)
  assert.deepEqual(locks(root), [], '거부 시 vfc 잠금도 되돌린다')
  // 같은 에이전트 pid 가 이미 제품 잠금을 쥐고 있으면 허용(그리고 반납하지 않는다)
  const me = sleeper()
  fs.writeFileSync(path.join(wt, '.agent-lock'), JSON.stringify({ agent: 'claude', pid: me.pid, host: os.hostname(), branch: 'feat/test' }))
  assert.equal(start(root, t.task_id, me.pid).code, 0)
  evidence(root, t.task_id)
  run(root, ['task', 'submit', t.task_id, '--by', OWNER])
  assert.ok(fs.existsSync(path.join(wt, '.agent-lock')), '내가 만들지 않은 제품 잠금은 지우지 않는다')
})

test('worktree 브랜치가 작업 브랜치와 다르면 거부한다', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/other' })
  assert.match(start(root, t.task_id, sleeper().pid).err, /BRANCH_MISMATCH/)
})

// ── 4. 비정상 종료 후 복구 ───────────────────────────────────────────────

test('실행 프로세스가 죽으면 reap 으로 BLOCKED + 잠금 정리, 살아 있는 남의 잠금은 복구 거부', async () => {
  const { root, wt } = setup()
  const wt2 = mkWorktree('feat/test')
  run(root, ['owner', 'bind-worktree', OWNER, wt2, '--branch', 'feat/test'])
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  const t2 = addTask(root, { worktree: wt2, branch: 'feat/test', title: 'live one' })
  const live = sleeper()
  const dying = sleeper()
  assert.equal(start(root, t2.task_id, live.pid).code, 0)
  assert.equal(start(root, t.task_id, dying.pid, OWNER, { VFC_LOCK_TTL_MS: '300' }).code, 0)
  const liveLock = locks(root).find((l) => l.name.includes(t2.task_id))
  const refuse = run(root, ['lock', 'recover', liveLock.name])
  assert.equal(refuse.code, 2)
  assert.match(refuse.out, /not stale/)
  dying.kill()
  await wait(600)
  const reap = JSON.parse(run(root, ['task', 'reap', '--json']).out)
  assert.deepEqual(reap.map((x) => x.task_id), [t.task_id])
  const q = state(root, 'TASK_QUEUE.json')
  assert.equal(q.tasks.find((x) => x.task_id === t.task_id).status, 'BLOCKED')
  assert.equal(q.tasks.find((x) => x.task_id === t2.task_id).status, 'IN_PROGRESS', '살아 있는 작업은 건드리지 않는다')
  assert.ok(!fs.existsSync(path.join(wt, '.agent-lock')))
  const t3 = addTask(root, { worktree: wt, branch: 'feat/test', title: 'after crash' })
  assert.equal(start(root, t3.task_id, sleeper().pid).code, 0)
})

test('죽은 소유자의 stale 잠금은 다음 획득자가 회수하고 기록을 남긴다', async () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  const dying = sleeper()
  assert.equal(start(root, t.task_id, dying.pid, OWNER, { VFC_LOCK_TTL_MS: '200' }).code, 0)
  dying.kill()
  await wait(500)
  fs.rmSync(path.join(wt, '.agent-lock')) // 제품 잠금 정리는 제품 도구의 몫 — 여기서는 사람이 정리했다고 본다
  const t2 = addTask(root, { worktree: wt, branch: 'feat/test', title: 'next' })
  assert.equal(start(root, t2.task_id, sleeper().pid).code, 0)
  const recovered = fs.readdirSync(path.join(root, 'runtime', 'locks', 'recovered'))
  assert.ok(recovered.some((f) => f.startsWith('worktree--')), recovered.join(','))
  assert.match(fs.readFileSync(path.join(root, 'runtime', 'logs', 'events.jsonl'), 'utf8'), /lock\.(recover_stale|remove_orphan)/)
})

test('세대 마커: 이미 반납·재획득된 잠금을 옛 token 으로 지우거나 heartbeat 하지 못한다', async () => {
  const root = mkRoot()
  const lib = path.join(REPO, 'lib', 'lock.mjs').replace(/\\/g, '/')
  const script = `
    import { acquire, release, heartbeat, readLock } from 'file:///${lib}'
    const a = acquire('task--X', { owner_id: 'a' })
    release('task--X', a.token)
    const b = acquire('task--X', { owner_id: 'b' })
    const r1 = release('task--X', a.token)
    const r2 = heartbeat('task--X', a.token)
    console.log(JSON.stringify({ r1: r1.ok, r2: r2.ok, holder: readLock('task--X').meta.owner_id, same: readLock('task--X').meta.token === b.token }))`
  const f = path.join(root, 's.mjs')
  fs.writeFileSync(f, script)
  const r = spawnSync(process.execPath, [f], { env: { ...process.env, VFC_ROOT: root }, encoding: 'utf8' })
  assert.deepEqual(JSON.parse(r.stdout), { r1: false, r2: false, holder: 'b', same: true })
})

test('동시 회수 경쟁: 죽은 잠금 하나를 6개 프로세스가 동시에 노려도 소유자는 하나다', async () => {
  const root = mkRoot()
  const lib = path.join(REPO, 'lib', 'lock.mjs').replace(/\\/g, '/')
  const dead = sleeper()
  const seedLock = `import { acquire } from 'file:///${lib}'; console.log(acquire('task--Y', { owner_id: 'dead', pid: ${dead.pid}, ttl_ms: 100 }).ok)`
  fs.writeFileSync(path.join(root, 'seed.mjs'), seedLock)
  spawnSync(process.execPath, [path.join(root, 'seed.mjs')], { env: { ...process.env, VFC_ROOT: root } })
  dead.kill()
  await wait(300)
  const grab = `import { acquire } from 'file:///${lib}'; const r = acquire('task--Y', { owner_id: 'p'+process.pid }); console.log(JSON.stringify({ ok: r.ok, token: r.token }))`
  fs.writeFileSync(path.join(root, 'grab.mjs'), grab)
  const rs = await Promise.all(
    Array.from({ length: 6 }, () => new Promise((res) => {
      const c = spawn(process.execPath, [path.join(root, 'grab.mjs')], { env: { ...process.env, VFC_ROOT: root } })
      let o = ''
      c.stdout.on('data', (d) => (o += d))
      c.on('close', () => res(JSON.parse(o)))
    })),
  )
  const winners = rs.filter((r) => r.ok)
  assert.equal(winners.length, 1, JSON.stringify(rs))
  const held = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'locks', 'task--Y.lock'), 'utf8'))
  assert.equal(held.token, winners[0].token, '디스크의 잠금 = 승자의 token')
})

// ── 5. 승인 없는 DB 변경 차단 ────────────────────────────────────────────

test('DB 쓰기 작업은 사용자 승인·SQL 해시·DB 소유권 없이 시작할 수 없고, 동시에 둘은 안 된다', async () => {
  const { root, wt } = setup()
  const spec = { worktree: wt, branch: 'feat/test', db_scope: { mode: 'write', targets: ['dev:jajenrevcbmrpaliomxv'] } }
  const t = addTask(root, spec)
  assert.equal(t.approval_required, true)
  assert.match(start(root, t.task_id, sleeper().pid).err, /APPROVAL_REQUIRED/)
  assert.match(run(root, ['task', 'approve', t.task_id, '--by', 'claude', '--ref', 'x']).err, /APPROVAL_NOT_USER/)
  assert.match(run(root, ['task', 'approve', t.task_id, '--by', 'user', '--ref', '대화']).err, /APPROVAL_NO_SQL_HASH/)
  const sha = crypto.createHash('sha256').update('alter table x add column y int').digest('hex')
  assert.equal(run(root, ['task', 'approve', t.task_id, '--by', 'user', '--ref', '대화', '--sql-sha256', sha]).code, 0)
  assert.match(start(root, t.task_id, sleeper().pid).err, /DB_SCOPE_NOT_OWNED/)
  const [w1, w2] = [mkWorktree('feat/test'), mkWorktree('feat/test')]
  for (const w of [w1, w2]) run(root, ['owner', 'bind-worktree', 'data-contract', w, '--branch', 'feat/test'])
  const d1 = addTask(root, { ...spec, worktree: w1, owner_id: 'data-contract', title: 'd1' })
  const d2 = addTask(root, { ...spec, worktree: w2, owner_id: 'data-contract', title: 'd2' })
  for (const d of [d1, d2]) run(root, ['task', 'approve', d.task_id, '--by', 'user', '--ref', 'ok', '--sql-sha256', sha])
  const rs = await Promise.all([d1, d2].map((d) => runAsync(root, ['task', 'start', d.task_id, '--owner', 'data-contract', '--agent', 'claude', '--session', d.title, '--pid', String(sleeper().pid)])))
  assert.equal(rs.filter((r) => r.code === 0).length, 1)
  assert.match(rs.find((r) => r.code !== 0).err, /LOCK_HELD.*db--/s)
})

// ── 6. 완료 판정 규칙 ────────────────────────────────────────────────────

test('검증 근거 없이 COMPLETED 로 갈 수 없다(증거·artifact·covers·skip·자기/가짜 리뷰어·리뷰 기록)', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  assert.match(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).err, /NO_EVIDENCE/)
  assert.match(evidence(root, t.task_id, { artifact_path_or_url: 'verification/none.log' }).err, /artifact .* 가 없다/)
  assert.match(evidence(root, t.task_id, { covers: [] }).err, /covers/)
  assert.match(evidence(root, t.task_id, { type: 'vibes' }).err, /type 은/)
  assert.match(evidence(root, t.task_id, { observed_at: 'yesterday' }).err, /ISO/)
  assert.match(evidence(root, t.task_id, { observed_at: 'October 9, 2026' }).err, /ISO/)
  assert.match(evidence(root, t.task_id, { artifact_path_or_url: 'verification/tests' }).err, /artifact/)
  assert.equal(evidence(root, t.task_id, { result: 'skip', skip_count: 12, covers: [0] }).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [0] }).code, 0)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).code, 0)
  const complete = (by, review = 'verification/reviews/r.md') => run(root, ['task', 'complete', t.task_id, '--by', by, ...(review ? ['--review', review] : [])])
  assert.match(complete(OWNER).err, /SELF_REVIEW/)
  assert.match(complete('somebody').err, /등록된 owner 가 아니다/)
  assert.match(run(root, ['task', 'complete', t.task_id, '--by', OWNER, '--reviewer', 'independent-review', '--review', 'verification/reviews/r.md']).err, /REVIEWER_MISMATCH/)
  assert.match(complete('independent-review', null).err, /NO_REVIEW_RECORD/)
  fs.mkdirSync(path.join(root, 'verification', 'reviews', 'sub'), { recursive: true })
  assert.match(complete('independent-review', 'verification/reviews/sub').err, /파일이 아니다/)
  assert.match(complete('independent-review', 'verification/reviews/../../README.md').err, /밖이다/)
  assert.match(complete('independent-review').err, /NON_PASSING_EVIDENCE/)
  // 반려 → 새 run: 옛 run 의 skip 증거는 더 이상 세지 않지만, 새 run 이 모든 조건을 덮어야 한다
  assert.equal(run(root, ['task', 'reject', t.task_id, '--by', 'independent-review', '--reason', 'skip 있음', '--review', 'verification/reviews/r.md']).code, 0)
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [0] }).code, 0)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).code, 0)
  assert.match(complete('independent-review').err, /ACCEPTANCE_UNCOVERED.*\[1\]/s)
  run(root, ['task', 'reject', t.task_id, '--by', 'independent-review', '--reason', '조건 1 미검증', '--review', 'verification/reviews/r.md'])
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [0, 1] }).code, 0)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).code, 0)
  assert.equal(complete('independent-review').code, 0)
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).status, 'COMPLETED')
})

test('목표 PASS 는 verification/ 의 실제 증거로만 — 보고서 경로·없는 파일·사유 없음은 거부', () => {
  const { root } = setup()
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--by', 't', '--note', 'x']).err, /NO_EVIDENCE/)
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--evidence', 'docs/report.md', '--by', 't', '--note', 'x']).err, /REPORTED_ONLY/)
  assert.match(run(root, ['goal', 'set', 'VG-L3-D2-01', '--status', 'PASS', '--evidence', 'verification/e2e/nope.md', '--by', 't', '--note', 'x']).err, /없다/)
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'DONE', '--by', 't']).err, /BAD_GOAL_STATUS/)
  fs.writeFileSync(path.join(root, 'README.md'), 'x')
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--evidence', 'verification/../README.md', '--by', 't', '--note', 'x']).err, /REPORTED_ONLY/)
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--evidence', 'verification/tests', '--by', 't', '--note', 'x']).err, /파일이 아니다/)
  assert.match(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--evidence', 'verification/tests/run.log', '--by', 't']).err, /사유/)
  assert.equal(run(root, ['goal', 'set', 'VG-L3-A2-01', '--status', 'PASS', '--evidence', 'verification/tests/run.log', '--by', 't', '--note', '직접 실행']).code, 0)
  assert.equal(state(root, 'GOAL_STATUS.json').goals['VG-L3-A2-01'].status, 'PASS')
  assert.equal(run(root, ['goal', 'set', 'VG-L3-A3-01', '--status', 'EXTERNAL_INPUT_REQUIRED', '--by', 't', '--note', '권리 확인 대기']).code, 0)
})

// ── 7. ChatGPT 요청·응답 ─────────────────────────────────────────────────

function chatgptSetup() {
  const root = mkRoot()
  run(root, ['init'])
  const q = path.join(root, 'q.md')
  fs.writeFileSync(q, 'R0 경로의 우선순위를 검토해 달라.')
  const req = JSON.parse(run(root, ['planning', 'request', '--topic', 'R0 우선순위', '--question-file', q, '--goals', 'VG-L3-A2-01', '--by', 'platform-goal', '--json']).out)
  const good = {
    schema: 'vfc-response/1',
    request_id: req.id,
    responder: 'chatgpt',
    responded_at: '2026-10-09T10:00:00Z',
    canon_version: '1.1.0',
    verdict: 'revise',
    summary: '전이 과제 우선',
    findings: [{ id: 'F1', severity: 'P1', goal_ids: ['VG-L3-A3-01'], claim: '전이 미구현', evidence: 'learning_task_attempts 0', recommendation: '미노출 문항 선정부터' }],
    proposed_decisions: [{ summary: '전이 과제를 R0 첫 작업으로', affects_goal_ids: ['VG-L3-A3-01'], rationale: '게이트 R0-CORE-JOURNEY', requires_user_approval: true }],
    open_questions: ['체험 지문의 권리 확인 방법?'],
  }
  const respPath = path.join(root, 'planning', 'responses', `${req.id}.response.md`)
  return { root, req, good, respPath }
}
const wrap = (obj) => `ChatGPT 답변 본문...\n\n\`\`\`json vfc-response\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n`

test('ChatGPT 응답: 구조가 틀리면 거부, 맞으면 PROPOSED 로만 들어가고 재가져오기는 막는다', () => {
  const { root, req, good, respPath } = chatgptSetup()
  assert.match(req.id, /^REQ-\d{8}-001$/)
  const reqText = fs.readFileSync(req.file, 'utf8')
  assert.match(reqText, /```json vfc-request/)
  assert.match(reqText, /```json vfc-response/)
  for (const [obj, re] of [
    [{ ...good, verdict: 'ok' }, /verdict/],
    [{ ...good, findings: [{ ...good.findings[0], goal_ids: ['VG-NOPE'] }] }, /VG-NOPE/],
    [{ ...good, proposed_decisions: [{ ...good.proposed_decisions[0], requires_user_approval: false }] }, /requires_user_approval/],
    [{ ...good, canon_version: '0.9.0' }, /canon_version/],
    [{ ...good, request_id: 'REQ-20990101-001' }, /요청/],
  ]) {
    fs.writeFileSync(respPath, wrap(obj))
    const r = run(root, ['planning', 'validate', req.id])
    assert.equal(r.code, 2)
    assert.match(r.err, re)
  }
  fs.writeFileSync(respPath, wrap(good) + wrap(good))
  assert.match(run(root, ['planning', 'validate', req.id]).err, /정확히 1개/)
  fs.writeFileSync(respPath, 'json 블록 없음')
  assert.match(run(root, ['planning', 'validate', req.id]).err, /BAD_RESPONSE/)
  fs.writeFileSync(respPath, wrap(good))
  assert.equal(run(root, ['planning', 'validate', req.id]).code, 0)
  const imp = run(root, ['planning', 'import', req.id, '--by', 'platform-goal', '--json'])
  assert.equal(imp.code, 0, imp.err)
  const log = state(root, 'DECISION_LOG.json').entries.filter((e) => e.request_id === req.id)
  assert.deepEqual(log.map((e) => e.status).sort(), ['OPEN_QUESTION', 'PROPOSED', 'RECORDED', 'RECORDED'])
  assert.ok(!log.some((e) => e.status === 'APPROVED'), 'ChatGPT 응답은 승인이 될 수 없다')
  assert.ok(fs.existsSync(path.join(root, 'planning', 'archive', `${req.id}.response.md`)))
  fs.writeFileSync(respPath, wrap(good))
  assert.match(run(root, ['planning', 'import', req.id]).err, /ALREADY_IMPORTED/)
})

test('ChatGPT 응답: 동시 import 4개 — 결정은 정확히 한 번만 기록된다', async () => {
  const { root, req, good, respPath } = chatgptSetup()
  fs.writeFileSync(respPath, wrap(good))
  const rs = await Promise.all(Array.from({ length: 4 }, () => runAsync(root, ['planning', 'import', req.id, '--by', 'platform-goal'])))
  assert.equal(rs.filter((r) => r.code === 0).length, 1, rs.map((r) => r.err).join('\n'))
  const log = state(root, 'DECISION_LOG.json').entries.filter((e) => e.request_id === req.id && e.kind !== 'chatgpt_request')
  assert.equal(log.length, 3)
})

// ── 8. 저장 도중 실패 · 동시 쓰기 ────────────────────────────────────────

test('저장 도중 죽어도(임시 파일 단계) 본 파일은 옛 판이고, 남은 뮤텍스는 회수된다', () => {
  const { root } = setup()
  addTask(root, { title: 'before crash' })
  const before = fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json'), 'utf8')
  const f = writeJson(root, 'crash.json', taskSpec({ title: 'during crash' }))
  assert.equal(run(root, ['task', 'add', '--file', f], { VFC_CRASH_AT: 'after_tmp' }).code, 86)
  assert.equal(fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json'), 'utf8'), before, '본 파일은 옛 판 그대로')
  const t0 = Date.now()
  const next = run(root, ['task', 'add', '--file', f, '--json'])
  assert.equal(next.code, 0, next.err)
  assert.ok(Date.now() - t0 < 20000)
  assert.deepEqual(state(root, 'TASK_QUEUE.json').tasks.filter((t) => t.title.includes('crash')).map((t) => t.title), ['before crash', 'during crash'])
})

test('journal 기록 후 죽으면 다음 명령이 전 파일을 한꺼번에 재적용한다(부분 커밋 없음)', () => {
  const { root } = setup()
  const f = writeJson(root, 'j.json', taskSpec({ title: 'journaled' }))
  assert.equal(run(root, ['task', 'add', '--file', f], { VFC_CRASH_AT: 'after_journal' }).code, 87)
  assert.ok(fs.existsSync(path.join(root, 'state', '.journal.json')))
  assert.ok(JSON.parse(run(root, ['status', '--json']).out).tasks.READY >= 1)
  run(root, ['checkpoint', '--label', 'replay'])
  assert.ok(!fs.existsSync(path.join(root, 'state', '.journal.json')), '재적용 후 journal 삭제')
  assert.ok(state(root, 'TASK_QUEUE.json').tasks.some((t) => t.title === 'journaled'))
  assert.equal(state(root, 'ACTIVE_TASKS.json').schema, 'vfc-state/1')
})

test('커밋 후 잠금 반납 전에 죽어도, 남은 잠금은 고아로 정리되고 worktree 를 다시 쓸 수 있다', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  evidence(root, t.task_id)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER], { VFC_CRASH_AT: 'before_after_commit' }).code, 88)
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).status, 'REVIEW')
  assert.ok(locks(root).some((l) => l.name.startsWith('worktree--')), '반납 못 한 잠금이 남아 있다')
  assert.ok(fs.existsSync(path.join(wt, '.agent-lock')), '반납 못 한 제품 .agent-lock 도 남아 있다')
  const t2 = addTask(root, { worktree: wt, branch: 'feat/test', title: 'next' })
  const r2 = start(root, t2.task_id, sleeper().pid)
  assert.equal(r2.code, 0, '고아 정리(vfc 잠금 + 제품 .agent-lock) 후 다른 에이전트가 시작된다: ' + r2.err)
  assert.match(fs.readFileSync(path.join(root, 'runtime', 'logs', 'events.jsonl'), 'utf8'), /lock\.remove_orphan/)
})

test('본 상태 파일이 깨지면 .bak 으로 복구하고, 다음 쓰기가 정상 .bak 을 덮지 않는다', () => {
  const { root } = setup()
  addTask(root, { title: 'one' })
  addTask(root, { title: 'two' })
  const good = fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json.bak'), 'utf8')
  fs.writeFileSync(path.join(root, 'state', 'TASK_QUEUE.json'), '{ broken')
  const st = JSON.parse(run(root, ['status', '--json']).out)
  assert.equal(st.recovered_from_bak.length, 1)
  addTask(root, { title: 'three' }) // 깨진 본 → .bak 대신 격리, rename 으로 새 본
  assert.equal(fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json.bak'), 'utf8'), good, '정상 .bak 이 깨진 본으로 덮이지 않았다')
  assert.ok(fs.readdirSync(path.join(root, 'state')).some((f) => f.startsWith('TASK_QUEUE.json.corrupt-')))
  assert.ok(state(root, 'TASK_QUEUE.json').tasks.some((t) => t.title === 'three'))
})

test('동시 프로세스 10개가 작업을 등록해도 유실·중복 id 가 없다', async () => {
  const { root } = setup()
  const files = Array.from({ length: 10 }, (_, i) => writeJson(root, `c${i}.json`, taskSpec({ title: `concurrent ${i}` })))
  const rs = await Promise.all(files.map((f) => runAsync(root, ['task', 'add', '--file', f])))
  assert.ok(rs.every((r) => r.code === 0), rs.map((r) => r.err).join('\n'))
  const tasks = state(root, 'TASK_QUEUE.json').tasks.filter((t) => t.title.startsWith('concurrent'))
  assert.equal(tasks.length, 10)
  assert.equal(new Set(tasks.map((t) => t.task_id)).size, 10)
})

// ── 9. WF-S4 추가: 템플릿 상태 · 결정 기록 · 기획 요청 ─────────────────────

test('L4 템플릿은 not_instantiated/instantiated 만 갖고 PASS/FAIL 로 바꿀 수 없다', () => {
  const { root } = setup()
  const st0 = JSON.parse(run(root, ['status', '--json']).out)
  assert.match(st0.templates['VG-L4-TEMPLATE-BUILD'], /^not_instantiated/)
  addTask(root, { template: 'VG-L4-TEMPLATE-BUILD' })
  const st1 = JSON.parse(run(root, ['status', '--json']).out)
  assert.match(st1.templates['VG-L4-TEMPLATE-BUILD'], /^instantiated\(1\)/)
  assert.match(run(root, ['goal', 'set', 'VG-L4-TEMPLATE-BUILD', '--status', 'PASS', '--evidence', 'verification/tests/run.log', '--by', 't', '--note', 'x']).err, /TEMPLATE_HAS_NO_STATUS/)
})

test('decision add: APPROVED 는 사용자 근거 없이는 거부, 없는 goal 거부', () => {
  const root = mkRoot()
  run(root, ['init'])
  assert.equal(run(root, ['decision', 'add', '--status', 'RECORDED', '--kind', 'operational', '--summary', 'x', '--by', 'platform-goal']).code, 0)
  assert.match(run(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'strategy', '--summary', 'x', '--by', 'claude']).err, /APPROVAL_NOT_USER/)
  assert.match(run(root, ['decision', 'add', '--status', 'PROPOSED', '--kind', 'k', '--summary', 'x', '--goals', 'VG-NOPE']).err, /BAD_GOAL/)
})

test('기획 요청(plan): plan 필드가 빠지면 거부, 다 있으면 PROPOSED plan 으로 들어간다', () => {
  const { root } = setup()
  const t = addTask(root)
  const q = path.join(root, 'q.md')
  fs.writeFileSync(q, '기획해 달라')
  assert.match(run(root, ['planning', 'request', '--kind', 'plan', '--topic', 'x', '--question-file', q, '--by', 'platform-goal']).err, /goal_id/)
  const req = JSON.parse(run(root, ['planning', 'request', '--kind', 'plan', '--task', t.task_id, '--topic', 'x', '--question-file', q, '--goals', 'VG-L3-A2-01', '--by', 'platform-goal', '--json']).out)
  assert.equal(req.header.kind, 'plan')
  assert.equal(req.header.task_id, t.task_id)
  const base = { schema: 'vfc-response/1', request_id: req.id, responder: 'chatgpt', responded_at: '2026-10-09T10:00:00Z', canon_version: '1.1.0', verdict: 'approve', summary: 's', findings: [], proposed_decisions: [], open_questions: [] }
  const plan = { goal_fit: 'a', design: 'b', priority: 'P1 — c', learner_value: 'd', scope: 'e', preserved_contracts: ['f'], acceptance: ['g'], risks: ['h'] }
  const respPath = path.join(root, 'planning', 'responses', `${req.id}.response.json`)
  fs.writeFileSync(respPath, JSON.stringify(base))
  assert.match(run(root, ['planning', 'validate', req.id]).err, /plan 객체/)
  fs.writeFileSync(respPath, JSON.stringify({ ...base, plan: { ...plan, risks: [] } }))
  assert.match(run(root, ['planning', 'validate', req.id]).err, /plan\.risks/)
  fs.writeFileSync(respPath, JSON.stringify({ ...base, plan: { ...plan, priority: 'high' } }))
  assert.match(run(root, ['planning', 'validate', req.id]).err, /P0~P3/)
  fs.writeFileSync(respPath, JSON.stringify({ ...base, plan }))
  assert.equal(run(root, ['planning', 'import', req.id, '--by', 'platform-goal']).code, 0)
  const e = state(root, 'DECISION_LOG.json').entries.find((x) => x.request_id === req.id && x.kind === 'plan')
  assert.equal(e.status, 'PROPOSED')
  assert.deepEqual(e.plan, plan)
})

test('응답 승인 충돌(WF-S5): requires_user_approval false 는 고쳐 받지 않는다 — 기본 거부 · --record-conflict 는 approval_conflict 로 기록', () => {
  const { root, req, good, respPath } = chatgptSetup()
  const bad = { ...good, proposed_decisions: [{ ...good.proposed_decisions[0], requires_user_approval: false }] }
  fs.writeFileSync(respPath, wrap(bad))
  assert.match(run(root, ['planning', 'import', req.id]).err, /requires_user_approval/)
  assert.match(run(root, ['planning', 'import', req.id, '--normalize-approval']).err, /DEPRECATED/)
  const v = JSON.parse(run(root, ['planning', 'validate', req.id, '--record-conflict', '--json']).out)
  assert.equal(v.conflicts, 1)
  assert.equal(run(root, ['planning', 'import', req.id, '--record-conflict', '--by', 'platform-goal']).code, 0)
  const entries = state(root, 'DECISION_LOG.json').entries.filter((x) => x.request_id === req.id)
  assert.ok(!entries.some((e) => e.kind === 'proposal'), '충돌 제안은 PROPOSED 로 들어가지 않는다')
  const c = entries.find((e) => e.kind === 'approval_conflict')
  assert.equal(c.status, 'OPEN_QUESTION')
  assert.equal(c.original_proposal.requires_user_approval, false, '원래 값을 그대로 남긴다')
  const arch = fs.readFileSync(path.join(root, 'planning', 'archive', `${req.id}.response.md`), 'utf8')
  assert.match(arch, /"requires_user_approval": false/, '원문은 그대로 보관')
})

test('잠금 잔여 위험 보강: 죽은 세대 마커가 남은 stale 잠금을 6개 프로세스가 동시에 노려도 소유자는 하나', async () => {
  const root = mkRoot()
  const lib = path.join(REPO, 'lib', 'lock.mjs').replace(/\\/g, '/')
  const dead = sleeper()
  fs.writeFileSync(path.join(root, 'seed.mjs'), `import { acquire } from 'file:///${lib}'; console.log(acquire('task--Z', { owner_id: 'dead', pid: ${dead.pid}, ttl_ms: 100 }).token)`)
  const token = spawnSync(process.execPath, [path.join(root, 'seed.mjs')], { env: { ...process.env, VFC_ROOT: root }, encoding: 'utf8' }).stdout.trim()
  dead.kill()
  // 마커를 쥔 채 죽은 프로세스를 흉내 낸다: 죽은 pid · 10초보다 오래된 mtime
  const marker = path.join(root, 'runtime', 'locks', `task--Z.gen-${token}.e0.marker`)
  fs.writeFileSync(marker, JSON.stringify({ pid: 999999, host: os.hostname(), at: '2026-01-01T00:00:00Z' }))
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(marker, old, old)
  await wait(300)
  fs.writeFileSync(path.join(root, 'grab.mjs'), `import { acquire } from 'file:///${lib}'; const r = acquire('task--Z', { owner_id: 'p'+process.pid }); console.log(JSON.stringify({ ok: r.ok, token: r.token }))`)
  const rs = await Promise.all(
    Array.from({ length: 6 }, () => new Promise((res) => {
      const c = spawn(process.execPath, [path.join(root, 'grab.mjs')], { env: { ...process.env, VFC_ROOT: root } })
      let o = ''
      c.stdout.on('data', (d) => (o += d))
      c.on('close', () => res(JSON.parse(o)))
    })),
  )
  const winners = rs.filter((r) => r.ok)
  assert.equal(winners.length, 1, `소유자는 정확히 하나: ${JSON.stringify(rs)}`)
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'locks', 'task--Z.lock'), 'utf8'))
  assert.equal(onDisk.token, winners[0].token, '디스크의 잠금 = 승자')
  assert.match(fs.readFileSync(path.join(root, 'runtime', 'logs', 'events.jsonl'), 'utf8'), /marker_epoch_advanced/)
})

test('완료 조건 변경은 READY · owner · 사용자 APPROVED 결정이 있어야 하고 옛 조건을 남긴다', () => {
  const { root } = setup()
  const t = addTask(root)
  const f = writeJson(root, 'acc.json', ['새 조건 0'])
  assert.match(run(root, ['task', 'set-acceptance', t.task_id, '--file', f, '--decision', 'DL-0001', '--by', OWNER]).err, /APPROVAL_REQUIRED/)
  assert.match(run(root, ['task', 'set-acceptance', t.task_id, '--file', f, '--decision', 'SD-R0-01', '--by', 'content-pipeline']).err, /NOT_OWNER/)
  assert.equal(run(root, ['task', 'set-acceptance', t.task_id, '--file', f, '--decision', 'SD-R0-01', '--by', OWNER]).code, 0)
  const tt = state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id)
  assert.deepEqual(tt.acceptance, ['새 조건 0'])
  assert.deepEqual(tt.history.at(-1).previous_acceptance, ['조건 0', '조건 1'])
})

test('검증 커밋이 섞인 증거로는 완료할 수 없다 — 조건마다 다른 커밋이면 거부(Codex Stop P1 3차)', () => {
  const { root, wt } = setup()
  const t = addTask(root, { worktree: wt, branch: 'feat/test' })
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [0], commit: 'aaaaaaa1' }).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [1], commit: 'bbbbbbb2' }).code, 0)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).code, 0)
  assert.match(run(root, ['task', 'complete', t.task_id, '--by', 'independent-review', '--review', 'verification/reviews/r.md']).err, /EVIDENCE_COMMIT_MIXED/)
  // 같은 커밋(짧은/긴 sha)으로 다시 검증하면 완료되고 그 커밋이 검증 커밋이 된다
  run(root, ['task', 'reject', t.task_id, '--by', 'independent-review', '--reason', '커밋 섞임', '--review', 'verification/reviews/r.md'])
  assert.equal(start(root, t.task_id, sleeper().pid).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [0], commit: 'bbbbbbb2' }).code, 0)
  assert.equal(evidence(root, t.task_id, { covers: [1], commit: 'bbbbbbb2cc' }).code, 0)
  assert.equal(run(root, ['task', 'submit', t.task_id, '--by', OWNER]).code, 0)
  assert.equal(run(root, ['task', 'complete', t.task_id, '--by', 'independent-review', '--review', 'verification/reviews/r.md']).code, 0)
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).verified_commit, 'bbbbbbb2cc')
})

test('범위 글롭: **/ 는 온전한 디렉터리 구간만 — src/**/test.ts 가 src/not-test.ts 를 허용하지 않는다(Codex Stop P1)', async () => {
  const { pathInScope } = await import(`file:///${path.join(REPO, 'lib', 'tasks.mjs').replace(/\\/g, '/')}`)
  for (const [p, g, want] of [
    ['src/not-test.ts', 'src/**/test.ts', false],
    ['src/test.ts', 'src/**/test.ts', true],
    ['src/a/b/test.ts', 'src/**/test.ts', true],
    ['src/a/b.ts', 'src/**', true],
    ['srcx/a.ts', 'src/**', false],
    ['apps/web/src/lib/admin/x.ts', 'apps/web/src/lib/admin/**', true],
    // 저장소 루트의 src/x.ts 는 apps/web/src/** 범위가 아니다(Git 변경 파일 검사 — Codex Stop P1 2차)
    ['src/x.ts', 'apps/web/src/**', false],
  ]) assert.equal(pathInScope(p, [g]), want, `${p} vs ${g}`)
  // apps/web 기준 테스트 증거 경로는 명시적으로 webRelative 일 때만 접두를 본다
  assert.equal(pathInScope('src/x.ts', ['apps/web/src/**'], { webRelative: true }), true)
})

test('기획 재개는 그 요청을 가리키는 사용자 승인만 — 다른 요청의 승인으로는 재개 불가(Codex Stop P1)', () => {
  const { root } = setup()
  const t = addTask(root)
  const q = path.join(root, 'q.md')
  fs.writeFileSync(q, 'q')
  const reqA = JSON.parse(run(root, ['planning', 'request', '--kind', 'plan', '--task', t.task_id, '--topic', 'A', '--question-file', q, '--goals', 'VG-L3-A2-01', '--json']).out)
  const reqB = JSON.parse(run(root, ['planning', 'request', '--kind', 'plan', '--topic', 'B', '--question-file', q, '--goals', 'VG-L3-A2-01', '--json']).out)
  const lib = `file:///${path.join(REPO, 'lib').replace(/\\/g, '/')}`
  fs.writeFileSync(path.join(root, 'wait.mjs'), `import { withState } from '${lib}/state.mjs'; import * as T from '${lib}/tasks.mjs'; withState((s) => T.waitForPlanning(s, '${t.task_id}', { caller: '${OWNER}', request_id: '${reqA.id}', reason: 'test' }))`)
  assert.equal(spawnSync(process.execPath, [path.join(root, 'wait.mjs')], { env: { ...process.env, VFC_ROOT: root } }).status, 0)
  const resp = (id) => ({ schema: 'vfc-response/1', request_id: id, responder: 'chatgpt', responded_at: '2026-10-09T10:00:00Z', canon_version: '1.1.0', verdict: 'approve', summary: 's', findings: [], proposed_decisions: [], open_questions: [], plan: { goal_fit: 'a', design: 'b', priority: 'P1 — c', learner_value: 'd', scope: 'e', preserved_contracts: ['f'], acceptance: ['g'], risks: ['h'] } })
  for (const r of [reqA, reqB]) {
    fs.writeFileSync(path.join(root, 'planning', 'responses', `${r.id}.response.json`), JSON.stringify(resp(r.id)))
    assert.equal(run(root, ['planning', 'import', r.id]).code, 0)
  }
  const appr = (rid) => JSON.parse(run(root, ['decision', 'add', '--status', 'APPROVED', '--approved-by', 'user', '--ref', '대화', '--kind', 'plan_approval', '--summary', 'ok', '--request', rid, '--json']).out).decision_id
  const dB = appr(reqB.id)
  assert.match(run(root, ['task', 'resume-from-plan', t.task_id, '--decision', dB, '--by', OWNER]).err, /APPROVAL_MISMATCH/)
  const dA = appr(reqA.id)
  assert.equal(run(root, ['task', 'resume-from-plan', t.task_id, '--decision', dA, '--by', OWNER]).code, 0)
  assert.equal(state(root, 'TASK_QUEUE.json').tasks.find((x) => x.task_id === t.task_id).status, 'READY')
})
