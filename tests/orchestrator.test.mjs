// tests/orchestrator.test.mjs — node --test --test-concurrency=1 tests/orchestrator.test.mjs
//
// WF-S5 오케스트레이터 필수 검증 14항목(+기획 요청 조건). 가짜 Claude/Codex(tests/fakes)로 실제 CLI 프로세스를 돌린다.
// 모든 상태는 임시 VFC_ROOT, 모든 Git 은 임시 저장소 — 실제 state/·제품 저장소를 건드리지 않는다.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const ORCH = path.join(REPO, 'bin', 'goal-orchestrator.mjs')
const FAKE_CLAUDE = `node ${path.join(REPO, 'tests', 'fakes', 'fake-claude.mjs').replace(/\\/g, '/')}`
const FAKE_CODEX = `node ${path.join(REPO, 'tests', 'fakes', 'fake-codex.mjs').replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const ROLE_FAKE = path.join(REPO, 'tests', 'fakes', 'role-agent.mjs').replace(/\\/g, '/')
const kids = []
after(() => kids.forEach((k) => k.kill()))

test('dynamic A/B: two tasks retain owner, opposite AI, P1 repair, exact HEAD and no unknown PASS', () => {
  const root = setup()
  const a = addTask(root, { priority: 'P2', roles: { planner: 'codex', implementer: 'claude' } })
  const b = addTask(root, { priority: 'P2', roles: { planner: 'claude', implementer: 'codex' }, depends_on: [a.task_id], worktree: a.wt })
  const r = orch(root, ['--max-tasks', '2'], { VFC_CLAUDE_CMD: `node ${ROLE_FAKE} claude`, VFC_CODEX_CMD: `node ${ROLE_FAKE} codex`, FAKE_ROLE_P1: '1' })
  assert.equal(r.code, 0, r.err + r.out)
  for (const id of [a.task_id, b.task_id]) {
    const t = task(root, id)
    assert.equal(t.status, 'COMPLETED', JSON.stringify(t.blocker) + r.out)
    assert.notEqual(t.role_assignment.roles.implementer, t.role_assignment.roles.reviewer)
    assert.equal(t.owner_id, OWNER)
    const txt = fs.readFileSync(path.join(root, t.review_record), 'utf8')
    assert.ok(txt.includes('"provenance"'))
    assert.ok(t.orchestration.rounds >= 2, 'same task repaired after opposite-AI P1')
  }
  integrity(root)
})

test('explicit Work request never enters the combined local implementation path', () => {
  const root = setup()
  const a = addTask(root, { priority: 'P2', roles: { planner: 'claude', implementer: 'claude' }, work_requested: true })
  const r = orch(root, [], { VFC_CLAUDE_CMD: `node ${ROLE_FAKE} claude`, VFC_CODEX_CMD: `node ${ROLE_FAKE} codex` })
  assert.equal(r.code, 0, r.err)
  assert.equal(task(root, a.task_id).status, 'WAITING_CHATGPT')
  assert.equal(r.json.run.events.some((e) => e.role), false, 'no implementation or planner is invoked')
  integrity(root)
})

function env(root, extra = {}) {
  return { ...process.env, VFC_ROOT: root, VFC_CLAUDE_CMD: FAKE_CLAUDE, VFC_CODEX_CMD: FAKE_CODEX, VFC_AUTO_CODEX: '1', FAKE_STATE_DIR: root, VFC_PRODUCT_REPO: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir(), ...extra }
}
function vfc(root, args, extra) {
  const r = spawnSync(process.execPath, [VFC, ...args], { env: env(root, extra), encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
function orch(root, args = [], extra) {
  const r = spawnSync(process.execPath, [ORCH, '--no-ci', '--json', ...args], { env: env(root, extra), encoding: 'utf8', timeout: 240000 })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }
  return { code: r.status, out: r.stdout, err: r.stderr, json }
}
const state = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'state', f), 'utf8'))
const task = (root, id) => state(root, 'TASK_QUEUE.json').tasks.find((t) => t.task_id === id)

function mkWorktree() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-owt-'))
  const g = (...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.writeFileSync(path.join(d, 'README.md'), 'x\n')
  fs.writeFileSync(path.join(d, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  return d
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-orch-'))
  assert.equal(vfc(root, ['init']).code, 0)
  // 시드 작업(T-0001~0005)은 worktree·DB 때문에 실행 불가 — 테스트 작업만 후보가 된다
  return root
}

function addTask(root, over = {}) {
  const wt = over.worktree ?? mkWorktree()
  vfc(root, ['owner', 'bind-worktree', over.owner_id ?? OWNER, wt, '--branch', 'feat/t'])
  const spec = { goal_id: 'VG-L3-A2-01', title: 'orch test', description: 'd', priority: 'P0', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0', '조건 1'], worktree: wt, branch: 'feat/t', impact: { current_gap: 'test gap', expected_impact: (over.criterion_claims || []).some((c) => c.claim === 'full') ? 'closes' : 'advances', evidence_required: ['테스트 통과'], out_of_scope: [] }, duplicate_reason: 'test fixture — 같은 범위 작업 여러 개', ...over }
  const f = path.join(root, `spec-${crypto.randomBytes(3).toString('hex')}.json`)
  fs.writeFileSync(f, JSON.stringify(spec))
  const r = vfc(root, ['task', 'add', '--file', f, '--json'])
  assert.equal(r.code, 0, r.err)
  return { ...JSON.parse(r.out), wt }
}

function integrity(root) {
  for (const f of fs.readdirSync(path.join(root, 'state')).filter((f) => f.endsWith('.json'))) JSON.parse(fs.readFileSync(path.join(root, 'state', f), 'utf8'))
  assert.ok(!fs.existsSync(path.join(root, 'state', '.journal.json')), 'journal 이 남지 않는다')
  const locks = JSON.parse(vfc(root, ['lock', 'list', '--json']).out)
  assert.deepEqual(locks.map((l) => l.name), [], '실행이 끝나면 잠금이 남지 않는다')
}

function submitPlatform(root, t) {
  const base = execFileSync('git', ['-C', t.wt, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assert.equal(vfc(root, ['task', 'start', t.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'real-submitter-fixture', '--pid', String(process.pid)]).code, 0)
  fs.mkdirSync(path.join(t.wt, 'src'), { recursive: true })
  fs.writeFileSync(path.join(t.wt, 'src', `${t.task_id}.ts`), '// submitted implementation\n')
  fs.writeFileSync(path.join(t.wt, 'src', 'acceptance.test.cjs'), "// src/acceptance.test.cjs\nrequire('node:test')('submitted source exists',()=>require('node:assert').ok(require('node:fs').existsSync('src')))\n")
  execFileSync('git', ['-C', t.wt, 'add', 'src'])
  execFileSync('git', ['-C', t.wt, 'commit', '-qm', 'submitted implementation'])
  const head = execFileSync('git', ['-C', t.wt, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const log = path.join(root, 'submitted.log'); fs.writeFileSync(log, 'fixture test evidence\n')
  const evidence = path.join(root, 'submitted.json')
  fs.writeFileSync(evidence, JSON.stringify({ type: 'unit', command_or_protocol: 'node fixture', result: 'pass', skip_count: 0, commit: head, artifact_path_or_url: log, observed_at: '2026-10-20T00:00:00Z', covers: [0, 1] }))
  const ev = vfc(root, ['task', 'evidence', t.task_id, '--file', evidence, '--by', OWNER])
  assert.equal(ev.code, 0, ev.err)
  const sub = vfc(root, ['task', 'submit', t.task_id, '--by', OWNER]); assert.equal(sub.code, 0, sub.err)
  return { base, head }
}

test('platform REVIEW is independently reviewed without worker or user_goal; exact submitted HEAD completes', () => {
  const root = setup(), t = addTask(root)
  const { head } = submitPlatform(root, t)
  const r = orch(root, ['--owner', OWNER])
  assert.equal(r.code, 0, r.err + r.out)
  assert.equal(task(root, t.task_id).status, 'COMPLETED', r.out)
  assert.equal(task(root, t.task_id).verified_commit, head)
  assert.equal(r.json.run.tasks_done.length, 1)
  assert.equal(r.json.run.events.some((e) => e.phase === 'implement'), false, 'submitted work is not implemented again')
  integrity(root)
})

test('FINAL scoped submission uses a real reviewer process with global automatic review disabled', () => {
  const root = setup(), t = addTask(root, { source: { mission: 'FINAL-MISSION-A~H' } })
  submitPlatform(root, t)
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'config', 'dev-mode.json'), JSON.stringify({ mode: 'LOCAL_FAST', auto_codex_review: false,
    final_collaboration: { mission: 'FINAL-MISSION-A~H', owners: [OWNER], dynamic_roles: true, auto_codex_review: true } }))
  const r = orch(root, ['--owner', OWNER], { VFC_AUTO_CODEX: '', VFC_CODEX_CMD: `node ${ROLE_FAKE} codex` })
  assert.equal(r.code, 0, r.err + r.out)
  const done = task(root, t.task_id)
  assert.equal(done.status, 'COMPLETED', r.out)
  assert.equal(done.role_assignment.roles.implementer, 'claude')
  assert.equal(done.role_assignment.roles.reviewer, 'codex')
  const report = fs.readFileSync(path.join(root, done.review_record), 'utf8')
  assert.match(report, /FINAL-COLLAB\/1/)
  assert.match(report, /"provenance"/)
  assert.equal(r.json.run.events.some((e) => e.phase === 'implement'), false)
  integrity(root)
})

test('platform submitted P1 feeds the existing implementation loop, then two local tasks complete', () => {
  const root = setup(), a = addTask(root), b = addTask(root, { depends_on: [a.task_id], worktree: a.wt })
  submitPlatform(root, a)
  const r = orch(root, ['--owner', OWNER, '--max-tasks', '2'], { FAKE_CODEX: 'p1_once' })
  assert.equal(r.code, 0, r.err + r.out)
  assert.equal(task(root, a.task_id).status, 'COMPLETED', r.out)
  assert.equal(task(root, b.task_id).status, 'COMPLETED', r.out)
  assert.ok(task(root, a.task_id).history.some((h) => h.from === 'REVIEW' && h.to === 'READY'))
  const logs = fs.readdirSync(path.join(root, 'runtime', 'runs', r.json.run_id), { recursive: true }).filter((f) => String(f).endsWith('prompt.md'))
  assert.ok(logs.some((f) => /R-PREV/.test(fs.readFileSync(path.join(root, 'runtime', 'runs', r.json.run_id, f), 'utf8'))), 'new implementation receives the prior rejection')
  integrity(root)
})

test('unknown submitted review stays REVIEW and is not repeatedly billed while waiting', () => {
  const root = setup(), t = addTask(root); submitPlatform(root, t)
  const r = orch(root, ['--owner', OWNER, '--watch-seconds', '1'], { FAKE_CODEX: 'garbage' })
  assert.equal(r.code, 0, r.err)
  assert.equal(task(root, t.task_id).status, 'REVIEW')
  assert.equal(fs.readFileSync(path.join(root, 'codex-count'), 'utf8'), '1')
  assert.equal(r.json.run.tasks_done.length, 0)
  integrity(root)
})

test('non-dynamic submitted work retains deterministic evidence gate when automatic review is disabled', () => {
  const root = setup(), t = addTask(root); submitPlatform(root, t)
  // After-record tampering must fail even if deterministicReview returns APPROVE.
  fs.writeFileSync(path.join(root, 'submitted.log'), 'changed evidence\n')
  const r = orch(root, ['--owner', OWNER, '--max-review-rounds', '0'], { VFC_AUTO_CODEX: '0' })
  assert.equal(r.code, 0, r.err)
  assert.notEqual(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(fs.existsSync(path.join(root, 'codex-count')), false)
  integrity(root)
})

test('automated work does not adopt another session\'s uncommitted tracked changes', () => {
  const root = setup(), t = addTask(root)
  fs.appendFileSync(path.join(t.wt, 'README.md'), 'other session work\n')
  const r = orch(root, ['--owner', OWNER])
  assert.equal(r.code, 0, r.err)
  assert.equal(task(root, t.task_id).status, 'READY')
  assert.match(JSON.stringify(r.json.iterations), /automated_clean_worktree/)
  assert.match(fs.readFileSync(path.join(t.wt, 'README.md'), 'utf8'), /other session work/)
  integrity(root)
})

test('doctor shows code/state separation, registration is not execution, and changes no shared state', () => {
  const root = setup(); addTask(root)
  const before = fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json'))
  const r = vfc(root, ['doctor', '--owner', OWNER, '--json'])
  assert.equal(r.code, 0, r.err)
  const d = JSON.parse(r.out)
  assert.equal(d.state_root, root); assert.equal(d.code_root, REPO)
  assert.deepEqual(d.active_runs, []); assert.deepEqual(d.workers, [])
  assert.ok(d.tasks.every((t) => !t.dispatch_acknowledged && !t.claim_recorded && !t.implementation_running))
  assert.deepEqual(fs.readFileSync(path.join(root, 'state', 'TASK_QUEUE.json')), before)
})

test('submitted review and consecutive work use guarded local integration with native Windows paths', () => {
  const root = setup(), t = addTask(root)
  const { base } = submitPlatform(root, t)
  execFileSync('git', ['-C', t.wt, 'branch', 'local/integration', base])
  fs.mkdirSync(path.join(root, 'config'))
  fs.writeFileSync(path.join(root, 'config', 'dev-mode.json'), JSON.stringify({ mode: 'LOCAL_FAST', auto_integrate: true, integration_branch: 'local/integration', integration_worktree: path.join(root, 'integration'), checks: [{ id: 'actual-node-test', kind: 'test', cwd: '.', cmd: process.execPath, args: ['--test', 'src/acceptance.test.cjs'] }] }))
  const next = addTask(root, { depends_on: [t.task_id], worktree: t.wt })
  const r = orch(root, ['--owner', OWNER, '--max-tasks', '2'])
  assert.equal(r.code, 0, r.err + r.out)
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(task(root, next.task_id).status, 'COMPLETED', r.out)
  assert.deepEqual(r.json.run.tasks_done.map((t) => t.outcome), ['completed', 'completed'], r.out)
  assert.equal(r.json.run.events.filter((e) => e.phase === 'local_integrate' && e.ok).length, 2)
  integrity(root)
})

test('bounded wait observes later READY work without a worker; owner filter preserves other work', async () => {
  const root = setup(), other = addTask(root, { owner_id: 'content-pipeline', priority: 'P0' })
  const proc = spawn(process.execPath, [ORCH, '--no-ci', '--json', '--owner', OWNER, '--watch-seconds', '2'], { env: env(root) })
  kids.push(proc)
  let stdout = '', stderr = ''; proc.stdout.on('data', (x) => stdout += x); proc.stderr.on('data', (x) => stderr += x)
  const exited = new Promise((resolve) => proc.on('close', resolve))
  const t = addTask(root, { priority: 'P2' })
  assert.equal(await exited, 0, stderr + stdout)
  assert.equal(task(root, t.task_id).status, 'COMPLETED', stdout)
  assert.equal(task(root, other.task_id).status, 'READY')
  integrity(root)
})

test('bounded queue wait still stops for runtime STOP without claiming work', async () => {
  const root = setup()
  const proc = spawn(process.execPath, [ORCH, '--no-ci', '--json', '--owner', OWNER, '--watch-seconds', '1'], { env: env(root) })
  kids.push(proc)
  let stdout = '', stderr = ''; proc.stdout.on('data', (x) => stdout += x); proc.stderr.on('data', (x) => stderr += x)
  const exited = new Promise((resolve) => proc.on('close', resolve))
  const log = path.join(root, 'runtime', 'logs', 'events.jsonl')
  const deadline = Date.now() + 10000
  while (!(fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes('queue_wait'))) {
    assert.ok(Date.now() < deadline, 'controller enters bounded wait')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  fs.writeFileSync(path.join(root, 'runtime', 'STOP'), 'test stop\n')
  assert.equal(await exited, 0, stderr + stdout)
  const r = JSON.parse(stdout)
  assert.match(r.stop_reason, /사용자 중단/)
  assert.deepEqual(r.run.tasks_done, [])
  integrity(root)
})

// 1 · 12 · 11 — 목표 검사기 (순수 판정)
test('1·12 목표 미달성 검출 · CI 초록이어도 내부 건너뜀이면 FAIL(PASS 아님)', async () => {
  const root = setup()
  const { computeGoalCheck } = await import(`file:///${path.join(REPO, 'lib', 'goalcheck.mjs').replace(/\\/g, '/')}`)
  process.env.VFC_ROOT = root
  const { loadState } = await import(`file:///${path.join(REPO, 'lib', 'state.mjs').replace(/\\/g, '/')}`)
  const { loadCriteria } = await import(`file:///${path.join(REPO, 'lib', 'goals.mjs').replace(/\\/g, '/')}`)
  const doc = loadCriteria()
  const st = loadState().state
  const ci = { 'VG-L3-D2-01-AC1': { found: true, run_id: 1, conclusion: 'success', skipped_inner: true, log_read: true, marker: '::notice::e2e 건너뜀', head_sha: 'abc' } }
  const r = computeGoalCheck({ doc, state: st, ci, repo: root, git: () => '' })
  const d201 = r.results.find((x) => x.criterion_id === 'VG-L3-D2-01-AC1')
  assert.equal(d201.status, 'FAIL')
  assert.match(d201.reason, /건너뜀/)
  assert.ok(Object.values(r.goals).every((g) => g.status !== 'PASS'), '근거 없는 PASS 없음')
  assert.ok(r.results.every((x) => x.goal_id && x.criterion_id && x.checked_at && x.scope && x.reason))
  const okCi = { 'VG-L3-D2-01-AC1': { ...ci['VG-L3-D2-01-AC1'], skipped_inner: false, test_passed: 10, test_skipped: 0 } }
  const r2 = computeGoalCheck({ doc, state: st, ci: okCi, repo: root, git: () => '' })
  assert.notEqual(r2.results.find((x) => x.criterion_id === 'VG-L3-D2-01-AC1').status, 'PASS', 'CI 가 실제로 돌아도 작업 full 증거 없이는 PASS 아님')
  // 5(최종 리뷰 P1): job 은 실행됐어도 테스트 일부가 건너뛰면 FAIL
  const partial = { 'VG-L3-D2-01-AC1': { ...okCi['VG-L3-D2-01-AC1'], test_skipped: 1 } }
  assert.equal(computeGoalCheck({ doc, state: st, ci: partial, repo: root, git: () => '' }).results.find((x) => x.criterion_id === 'VG-L3-D2-01-AC1').status, 'FAIL')
  // 4(최종 리뷰 P1): CI 판정 게이트 — 판독 없음·커밋 불일치·테스트 0·건너뜀은 PASS 허용 안 함
  const { ciAllowsPass } = await import(`file:///${path.join(REPO, 'lib', 'goalcheck.mjs').replace(/\\/g, '/')}`)
  assert.equal(ciAllowsPass(undefined, 'abc').ok, false)
  assert.equal(ciAllowsPass({ ...okCi['VG-L3-D2-01-AC1'], head_sha: 'aaaaaaa1' }, 'bbbbbbb2').ok, false)
  assert.equal(ciAllowsPass({ ...okCi['VG-L3-D2-01-AC1'], test_passed: 0 }, null).ok, false)
  assert.equal(ciAllowsPass({ ...okCi['VG-L3-D2-01-AC1'], head_sha: 'abc1234' }, 'abc1234ffff').ok, true)
})

test('11 관련 코드가 검증 뒤 바뀌면 과거 PASS 를 무효화한다', async () => {
  const root = setup()
  process.env.VFC_ROOT = root
  const { computeGoalCheck } = await import(`file:///${path.join(REPO, 'lib', 'goalcheck.mjs').replace(/\\/g, '/')}`)
  const { loadState } = await import(`file:///${path.join(REPO, 'lib', 'state.mjs').replace(/\\/g, '/')}`)
  const { loadCriteria } = await import(`file:///${path.join(REPO, 'lib', 'goals.mjs').replace(/\\/g, '/')}`)
  const doc = loadCriteria()
  const st = loadState().state
  // 증거·리뷰 원본과 그 해시(무결성) — PASS 는 파일이 지금도 그대로일 때만
  const sh = (s) => crypto.createHash('sha256').update(s).digest('hex')
  fs.mkdirSync(path.join(root, 'verification', 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(root, 'verification', 'tests'), { recursive: true })
  fs.writeFileSync(path.join(root, 'verification', 'reviews', 'x.md'), 'review')
  fs.writeFileSync(path.join(root, 'verification', 'tests', 'e.log'), 'ok')
  st.taskQueue.tasks.push({ task_id: 'T-9000', status: 'COMPLETED', goal_id: 'VG-L3-A2-01', criterion_claims: [{ criterion_id: 'VG-L3-A2-01-AC1', claim: 'full' }], run_seq: 1, evidence: [{ evidence_id: 'e', run_seq: 1, result: 'pass', skip_count: 0, artifact_path_or_url: 'verification/tests/e.log', artifact_sha256: sh('ok') }], allowed_paths: ['src/**'], verified_commit: 'abc1234', reviewed_by: 'independent-review', review_record: 'verification/reviews/x.md', review_record_sha256: sh('review') })
  const gitUnchanged = (repo, args) => (args[0] === 'diff' ? '' : '')
  const pass = computeGoalCheck({ doc, state: st, repo: root, git: gitUnchanged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1')
  assert.equal(pass.status, 'PASS')
  // 6(최종 리뷰 P1): 증거가 바뀌거나 사라지면 PASS 아님
  fs.writeFileSync(path.join(root, 'verification', 'tests', 'e.log'), 'tampered')
  assert.match(computeGoalCheck({ doc, state: st, repo: root, git: gitUnchanged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1').reason, /무결성 실패.*바뀌었다/)
  fs.rmSync(path.join(root, 'verification', 'reviews', 'x.md'))
  assert.match(computeGoalCheck({ doc, state: st, repo: root, git: gitUnchanged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1').reason, /리뷰 기록 .* 없다/)
  fs.writeFileSync(path.join(root, 'verification', 'tests', 'e.log'), 'ok')
  fs.writeFileSync(path.join(root, 'verification', 'reviews', 'x.md'), 'review')
  const gitChanged = (repo, args) => (args[0] === 'diff' ? 'src/a.ts\n' : '')
  const inv = computeGoalCheck({ doc, state: st, repo: root, git: gitChanged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1')
  assert.equal(inv.status, 'UNKNOWN')
  assert.match(inv.reason, /PASS 무효화/)
  const notMerged = (repo, args) => {
    if (args[0] === 'merge-base') throw new Error('not ancestor')
    return ''
  }
  assert.match(computeGoalCheck({ doc, state: st, repo: root, git: notMerged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1').reason, /머지 후/)
  st.taskQueue.tasks[st.taskQueue.tasks.length - 1].criterion_claims[0].claim = 'partial'
  assert.notEqual(computeGoalCheck({ doc, state: st, repo: root, git: gitUnchanged }).results.find((x) => x.criterion_id === 'VG-L3-A2-01-AC1').status, 'PASS', 'partial 주장은 PASS 근거 아님')
})

// 2 — 우선순위
test('2 다음 작업 우선순위: 범주·목표상태·R0·의존·작업 우선순위로 정하고 이유를 남긴다(최근성 무관)', () => {
  const root = setup()
  const a = addTask(root, { goal_id: 'VG-L3-B1-01', priority: 'P0', title: 'ux' }) // 범주 7
  const b = addTask(root, { goal_id: 'VG-L3-A2-01', priority: 'P3', title: 'journey' }) // 범주 1
  const r = spawnSync(process.execPath, [path.join(REPO, 'bin', 'goal-priority.mjs'), '--json'], { env: env(root), encoding: 'utf8' })
  const j = JSON.parse(r.stdout)
  const ids = j.ranked.map((x) => x.task_id)
  assert.ok(ids.indexOf(b.task_id) < ids.indexOf(a.task_id), '범주 1 이 범주 7 보다 먼저')
  const rb = j.ranked.find((x) => x.task_id === b.task_id)
  assert.ok(rb.reasons.some((x) => /범주 1/.test(x)) && rb.reasons.some((x) => /R0 차단/.test(x)))
  assert.equal(j.next, b.task_id)
})

// 7 · 14 — P1 수정 루프와 상태 무결성
test('7·14 Codex 실제 P1 → Claude 수정 → 재리뷰 APPROVE → COMPLETED · 상태 무결성', () => {
  const root = setup()
  const t = addTask(root)
  const r = orch(root, [], { FAKE_CODEX: 'p1_once' })
  assert.equal(r.code, 0, r.err + r.out)
  const tt = task(root, t.task_id)
  assert.equal(tt.status, 'COMPLETED')
  assert.equal(tt.orchestration.rounds, 2)
  assert.equal(tt.reviewed_by, 'independent-review')
  assert.ok(tt.verified_commit)
  assert.equal(r.json.iterations[0].selected.task_id, t.task_id)
  assert.ok(fs.readdirSync(path.join(root, 'verification', 'reviews')).filter((f) => f.startsWith(t.task_id)).length >= 2)
  // Codex 에 넘긴 diff 범위는 실제 sha 두 개여야 한다(첫 실제 실행에서 `..undefined` 로 넘어간 결함 회귀)
  const runDir = path.join(root, 'runtime', 'runs', r.json.run_id)
  for (const d of fs.readdirSync(runDir)) {
    const cp = path.join(runDir, d, 'codex-prompt.md')
    if (!fs.existsSync(cp)) continue
    const line = fs.readFileSync(cp, 'utf8').split('\n').find((l) => l.startsWith('Diff:'))
    assert.match(line, /diff [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}$/, line)
  }
  // 저장소 규칙: worktree 루트 목적 파일(vfc 표식)
  assert.match(fs.readFileSync(path.join(t.wt, '.agent-goal.md'), 'utf8'), /^<!-- vfc:auto -->[\s\S]*이 작업 단위에만 적용/)
  const run = state(root, 'ORCHESTRATOR.json').runs[r.json.run_id]
  assert.equal(run.status, 'done')
  assert.ok(run.events.some((e) => e.phase === 'review_done' && e.blocking?.includes('F1')))
  integrity(root)
})

// 8 — 오탐
test('8 Codex 오탐: 구현자가 false_positive 로 근거를 대면 기록하고, 리뷰어가 수용하면 완료', () => {
  const root = setup()
  const t = addTask(root)
  const r = orch(root, [], { FAKE_CODEX: 'fp', FAKE_CLAUDE_FINDINGS: 'false_positive' })
  assert.equal(r.code, 0, r.err)
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  const fp = fs.readdirSync(path.join(root, 'verification', 'reviews')).find((f) => f.includes('false-positive'))
  assert.ok(fp, '오탐 판정 기록 파일')
  assert.match(fs.readFileSync(path.join(root, 'verification', 'reviews', fp), 'utf8'), /작업 승인 범위/)
})

test('8c 사람이 쓴 .agent-goal.md 는 덮지 않는다', () => {
  const root = setup()
  const t = addTask(root)
  fs.writeFileSync(path.join(t.wt, '.agent-goal.md'), '# 사람이 쓴 목적\n')
  orch(root)
  assert.equal(fs.readFileSync(path.join(t.wt, '.agent-goal.md'), 'utf8'), '# 사람이 쓴 목적\n')
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
})

test('8b 범위 밖(scope out) P1 은 차단하지 않는다', () => {
  const root = setup()
  const t = addTask(root)
  orch(root, [], { FAKE_CODEX: 'out_p1' })
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(task(root, t.task_id).orchestration.rounds, 1)
})

// 13 — 상한
test('13 리뷰·수정 반복 상한에 닿으면 BLOCKED(무한 반복 없음)', () => {
  const root = setup()
  const t = addTask(root)
  orch(root, ['--max-review-rounds', '2'], { FAKE_CODEX: 'always_p1' })
  const tt = task(root, t.task_id)
  assert.equal(tt.status, 'BLOCKED')
  assert.match(tt.blocker.reason, /반복 상한/)
  integrity(root)
})

test('13b 비용 상한: 누적 비용이 상한에 닿으면 다음 단계로 가지 않고 멈춘다', () => {
  const root = setup()
  addTask(root)
  addTask(root)
  const r = orch(root, ['--max-tasks', '5', '--max-cost-usd', '0.5'], { FAKE_CLAUDE: 'costly' })
  assert.match(r.json.stop_reason, /비용 상한/)
  assert.equal(r.json.run.tasks_done.length, 1, '두 번째 작업을 시작하지 않는다')
})

// 4 — BLOCKED 우회
test('4 같은 원인 반복 실패는 BLOCKED 로 두고 독립 작업을 이어서 실행한다', () => {
  const root = setup()
  const bad = addTask(root, { title: 'bad', priority: 'P0' })
  const good = addTask(root, { title: 'good', priority: 'P1' })
  const r = orch(root, ['--max-tasks', '2'], { FAKE_CLAUDE_MAP: JSON.stringify({ [bad.task_id]: 'fail' }) })
  assert.equal(task(root, bad.task_id).status, 'BLOCKED')
  assert.match(task(root, bad.task_id).blocker.reason, /claude_failed ×2/)
  assert.equal(task(root, good.task_id).status, 'COMPLETED')
  assert.deepEqual(r.json.run.tasks_done.map((x) => x.outcome), ['blocked_claude_failed', 'completed'])
})

test('4b 범위 밖 파일을 바꾸면 되돌리지 않고 즉시 BLOCKED(사람이 본다)', () => {
  const root = setup()
  const t = addTask(root)
  orch(root, [], { FAKE_CLAUDE: 'scope' })
  const tt = task(root, t.task_id)
  assert.equal(tt.status, 'BLOCKED')
  assert.match(tt.blocker.reason, /scope_violation.*secret\.txt/)
  assert.ok(fs.existsSync(path.join(t.wt, 'secret.txt')), '되돌리지 않는다(파괴적 조작 금지)')
})

// 3 — 완료 작업 재실행 방지
test('3 COMPLETED 작업은 다시 고르지 않는다', () => {
  const root = setup()
  const t = addTask(root)
  orch(root)
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  const r2 = orch(root)
  assert.equal(r2.json.iterations[0].selected, null)
  assert.match(r2.json.stop_reason, /실행 가능한 작업 없음/)
  assert.ok(r2.json.iterations[0].skipped.every((s) => s.task_id !== t.task_id))
})

// 5 — 승인 없는 DB 변경 차단
test('5 DB 쓰기 작업은 승인·DB 경로가 없으면 자동 실행 대상이 아니다', () => {
  const root = setup()
  const t = addTask(root, { db_scope: { mode: 'write', targets: ['dev:x'] } })
  const r = orch(root)
  assert.equal(r.json.iterations[0].selected, null)
  const s = r.json.iterations[0].skipped.find((x) => x.task_id === t.task_id)
  assert.match(s.reason, /approval/)
  assert.match(s.reason, /automated_no_db/)
  assert.equal(task(root, t.task_id).status, 'READY')
})

// 6 — ChatGPT 응답이 승인으로 오인되지 않음
test('6 ChatGPT requires_user_approval=false 는 고쳐 받지 않고 충돌로 기록해 해당 작업을 막는다', () => {
  const root = setup()
  const t = addTask(root)
  fs.writeFileSync(path.join(root, 'q.md'), 'q')
  const req = JSON.parse(vfc(root, ['planning', 'request', '--kind', 'plan', '--task', t.task_id, '--topic', 'x', '--question-file', path.join(root, 'q.md'), '--goals', 'VG-L3-A2-01', '--json']).out)
  const resp = { schema: 'vfc-response/1', request_id: req.id, responder: 'chatgpt', responded_at: '2026-10-09T10:00:00Z', canon_version: '1.1.0', verdict: 'approve', summary: 's', findings: [], proposed_decisions: [{ summary: '바로 진행', affects_goal_ids: ['VG-L3-A2-01'], rationale: 'r', requires_user_approval: false }], open_questions: [], plan: { goal_fit: 'a', design: 'b', priority: 'P1 — c', learner_value: 'd', scope: 'e', preserved_contracts: ['f'], acceptance: ['g'], risks: ['h'] } }
  fs.writeFileSync(path.join(root, 'planning', 'responses', `${req.id}.response.json`), JSON.stringify(resp))
  assert.match(vfc(root, ['planning', 'import', req.id]).err, /requires_user_approval/)
  assert.match(vfc(root, ['planning', 'import', req.id, '--normalize-approval']).err, /폐지/)
  assert.equal(vfc(root, ['planning', 'import', req.id, '--record-conflict']).code, 0)
  const conflict = state(root, 'DECISION_LOG.json').entries.find((e) => e.kind === 'approval_conflict')
  assert.equal(conflict.status, 'OPEN_QUESTION')
  assert.ok(!state(root, 'DECISION_LOG.json').entries.some((e) => e.request_id === req.id && e.status === 'APPROVED'))
  const r = orch(root)
  assert.equal(r.json.iterations[0].selected, null)
  assert.match(r.json.iterations[0].skipped.find((x) => x.task_id === t.task_id).reason, /no_approval_conflict/)
  assert.match(vfc(root, ['decision', 'resolve-conflict', conflict.decision_id, '--decision', 'DL-0001']).err, /APPROVAL_REQUIRED/)
  assert.equal(vfc(root, ['decision', 'resolve-conflict', conflict.decision_id, '--decision', 'SD-R0-01']).code, 0)
  assert.equal(orch(root).json.iterations[0].selected.task_id, t.task_id, '사용자 승인으로 충돌이 풀린 뒤에만 실행')
})

// 9 — 중복 시작 차단
test('9 오케스트레이터는 단일 writer — 다른 실행이 살아 있으면 거부', () => {
  const root = setup()
  addTask(root)
  const holder = spawn(process.execPath, ['-e', 'setTimeout(()=>{},600000)'], { stdio: 'ignore' })
  kids.push(holder)
  const script = `import { acquire } from 'file:///${path.join(REPO, 'lib', 'lock.mjs').replace(/\\/g, '/')}'; console.log(acquire('orchestrator--singleton', { owner_id: 'orchestrator', pid: ${holder.pid} }).ok)`
  fs.writeFileSync(path.join(root, 'hold.mjs'), script)
  spawnSync(process.execPath, [path.join(root, 'hold.mjs')], { env: env(root) })
  const r = orch(root)
  assert.equal(r.code, 2)
  assert.match(r.json.reason, /단일 writer/)
})

// 10 — 프로세스 종료 후 복구
test('10 실행 중 프로세스가 죽으면 다음 실행이 run 을 aborted 로 닫고 작업을 되살려 끝낸다', async () => {
  const root = setup()
  const t = addTask(root)
  const child = spawn(process.execPath, [ORCH, '--no-ci', '--json'], { env: env(root, { FAKE_CLAUDE: 'hang', VFC_ORCH_TTL_MS: '1' }), stdio: 'ignore' })
  kids.push(child)
  // implement 단계에 들어갈 때까지 기다린다
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 200))
    try {
      if (task(root, t.task_id)?.status === 'IN_PROGRESS') break
    } catch {
      /* 아직 */
    }
  }
  assert.equal(task(root, t.task_id).status, 'IN_PROGRESS')
  const runsDir = path.join(root, 'runtime', 'runs')
  // 감독자가 자식을 띄워 pid 파일을 남길 때까지 기다린 뒤 부모를 죽인다(그 전에 죽이면 자식이 아예 없다)
  const pidFileExists = () => (fs.existsSync(runsDir) ? fs.readdirSync(runsDir, { recursive: true }) : []).some((f) => String(f).endsWith('claude.pid.json'))
  for (let i = 0; i < 100 && !pidFileExists(); i++) await new Promise((r) => setTimeout(r, 200))
  child.kill('SIGKILL')
  // 3(최종 리뷰 P1): 부모가 죽으면 감독자가 매달린 Claude 자식 트리를 끝낸다 — 고아가 worktree 를 계속 쓰지 않게
  let pidInfo = null
  for (const f of fs.readdirSync(runsDir, { recursive: true }).filter((x) => String(x).endsWith('claude.pid.json'))) pidInfo = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'))
  assert.ok(pidInfo?.child, '감독자가 자식 pid 를 남긴다')
  // 불변식은 「자식이 죽는다」 — 감독자가 exited 를 적고 끝나든(부모 감시), 부모와 함께 정리되든(Windows job) 어느 쪽이든 자식이 남으면 안 된다
  const alive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  let childAlive = true
  for (let i = 0; i < 40 && childAlive; i++) {
    await new Promise((r) => setTimeout(r, 250))
    childAlive = alive(pidInfo.child)
  }
  assert.equal(childAlive, false, `매달린 가짜 Claude 프로세스가 남지 않는다: ${JSON.stringify(pidInfo)}`)
  // 죽은 오케스트레이터가 쥐던 싱글턴은 pid 사망 + ttl 경과 후에만 회수 — 첫 실행이 잡은 싱글턴 ttl 을 짧게 준다
  const r = orch(root, [], { VFC_ORCH_TTL_MS: '1' })
  assert.ok(r.json, r.err)
  assert.ok(r.json.recovery?.recovered, `복구 기록: ${JSON.stringify(r.json.recovery)}`)
  assert.ok(r.json.recovery.revived.includes(t.task_id))
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  const prev = state(root, 'ORCHESTRATOR.json').runs[r.json.recovery.recovered]
  assert.equal(prev.status, 'aborted')
  integrity(root)
})

// 9 · §9 — ChatGPT 기획 요청 조건부 생성
test('§9 기획이 필요한 작업만 WAITING_CHATGPT 로 두고 요청 파일을 만들며, 독립 작업은 계속한다', () => {
  const root = setup()
  const plan = addTask(root, { title: 'needs plan', priority: 'P0', flags: ['product_direction'] })
  const other = addTask(root, { title: 'plain', priority: 'P1' })
  const r = orch(root)
  assert.equal(task(root, plan.task_id).status, 'WAITING_CHATGPT')
  const reqId = task(root, plan.task_id).planning.request_id
  assert.ok(fs.existsSync(path.join(root, 'planning', 'requests', `${reqId}.md`)))
  assert.equal(task(root, other.task_id).status, 'COMPLETED')
  assert.match(r.json.iterations[0].skipped.find((s) => s.task_id === plan.task_id).reason, /WAITING_CHATGPT/)
  // 사소한 작업(플래그 없음)에는 요청을 만들지 않는다
  assert.equal(fs.readdirSync(path.join(root, 'planning', 'requests')).filter((f) => f.endsWith('.md')).length, 1)
})

// ── Stop 훅 판정 연동(「Stop Hook 리뷰 상한 개선」 9~11) ──
test('SH9 REVIEW_PASS 는 그 커밋에만 유효 — 다른 커밋의 PASS 로 require_review_pass 작업을 완료하지 못한다', () => {
  const root = setup()
  const t = addTask(root, { require_review_pass: true })
  // 다른 커밋에 대한 PASS 만 있다
  fs.writeFileSync(path.join(root, 'verdicts.jsonl'), JSON.stringify({ head: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', kind: 'stop', verdict: 'REVIEW_PASS', fix_rounds: 0, p0_p1: [] }) + '\n')
  const r = orch(root)
  const tt = task(root, t.task_id)
  assert.equal(tt.status, 'BLOCKED', JSON.stringify(r.json?.run?.tasks_done))
  assert.match(tt.blocker.reason, /REVIEW_COMMIT_MISMATCH/)
  assert.deepEqual(r.json.run.tasks_done.map((x) => x.outcome), ['blocked_review_verdict'])
})

test('SH10·11 REVIEW_BLOCKED 커밋은 완료 금지 → BLOCKED, 오케스트레이터는 다른 독립 작업을 끝낸다', () => {
  const root = setup()
  const bad = addTask(root, { title: 'hook blocked', priority: 'P0' })
  const good = addTask(root, { title: 'independent', priority: 'P1' })
  const r = orch(root, ['--max-tasks', '2'], { FAKE_CLAUDE_MAP: JSON.stringify({ [bad.task_id]: 'hook_blocked' }) })
  const b = task(root, bad.task_id)
  assert.equal(b.status, 'BLOCKED')
  assert.match(b.blocker.reason, /REVIEW_BLOCKED: Stop 훅 판정/)
  assert.ok(!b.history.some((h) => h.to === 'COMPLETED'), '한 번도 COMPLETED 가 되지 않는다')
  assert.equal(task(root, good.task_id).status, 'COMPLETED')
  assert.deepEqual(r.json.run.tasks_done.map((x) => x.outcome), ['blocked_review_verdict', 'completed'])
  // 그 커밋에 PASS 가 기록된 뒤에는 같은 커밋이 완료될 수 있다(판정은 커밋에 묶인다) — unblock 은 사람 몫이라 여기선 판정 함수만 본다
})

test('WF6 보고서에 수정 전 실패·미실행 항목이 있어도 실행이 멈추지 않는다 — bad_evidence 재작업 → 반복이면 BLOCKED, 다음 작업 진행', () => {
  const root = setup()
  const bad = addTask(root, { title: 'redstep', priority: 'P0' })
  const good = addTask(root, { title: 'independent', priority: 'P1' })
  const r = orch(root, ['--max-tasks', '2'], { FAKE_CLAUDE_MAP: JSON.stringify({ [bad.task_id]: 'redstep' }) })
  assert.ok(r.json?.run, r.err)
  assert.doesNotMatch(String(r.json.run.stop_reason || ''), /오류/)
  assert.match(task(root, bad.task_id).blocker.reason, /bad_evidence/)
  assert.equal(task(root, good.task_id).status, 'COMPLETED')
})

test('WF6b 버려진 run 이 둘이어도 두 작업 모두 되살리고 두 run 모두 복구 완료로 표시한다', () => {
  const root = setup()
  const a = addTask(root, { title: 'A' })
  const b = addTask(root, { title: 'B' })
  const deadPid = spawnSync(process.execPath, ['-e', 'process.pid']).pid
  const mk = spawnSync(process.execPath, [path.join(REPO, 'tests', 'fakes', 'two-abandoned-runs.mjs'), a.task_id, b.task_id, String(deadPid)], { env: env(root), encoding: 'utf8' })
  assert.equal(mk.status, 0, mk.stderr)
  const r = orch(root, ['--max-tasks', '2'])
  assert.ok(r.json, r.err)
  assert.deepEqual([...r.json.recovery.revived].sort(), [a.task_id, b.task_id].sort())
  const runs = state(root, 'ORCHESTRATOR.json').runs
  assert.ok(runs['RUNA-0001'].recovered_at && runs['RUNB-0002'].recovered_at, JSON.stringify([runs['RUNA-0001'], runs['RUNB-0002']]))
  assert.equal(task(root, a.task_id).status, 'COMPLETED')
  assert.equal(task(root, b.task_id).status, 'COMPLETED')
})

test('WF6c 다음 실행 전에 vfc task reap 이 먼저 막아 둔 작업도 되살린다', () => {
  const root = setup()
  const a = addTask(root, { title: 'A' })
  const b = addTask(root, { title: 'B' })
  const deadPid = spawnSync(process.execPath, ['-e', 'process.pid']).pid
  const mk = spawnSync(process.execPath, [path.join(REPO, 'tests', 'fakes', 'two-abandoned-runs.mjs'), a.task_id, b.task_id, String(deadPid), 'running'], { env: env(root), encoding: 'utf8' })
  assert.equal(mk.status, 0, mk.stderr)
  assert.equal(vfc(root, ['task', 'reap']).code, 0)
  assert.equal(task(root, a.task_id).status, 'BLOCKED')
  const r = orch(root, ['--max-tasks', '2'])
  assert.ok(r.json, r.err)
  assert.deepEqual([...r.json.recovery.revived].sort(), [a.task_id, b.task_id].sort())
  assert.equal(task(root, a.task_id).status, 'COMPLETED')
  assert.equal(task(root, b.task_id).status, 'COMPLETED')
})

test('WF6d 다른 owner worktree 에 쓰면 foreign_worktree_write 로 차단·정지(테스트 격리 옵션이 감지를 끄지 않는다)', () => {
  const root = setup()
  const foreign = mkWorktree()
  vfc(root, ['owner', 'bind-worktree', 'data-contract', foreign, '--branch', 'feat/t'])
  const t = addTask(root)
  const r = orch(root, [], { FAKE_CLAUDE: 'foreign', FAKE_FOREIGN_WT: foreign })
  assert.equal(r.json.run.tasks_done[0].outcome, 'foreign_worktree_write')
  assert.equal(task(root, t.task_id).status, 'BLOCKED')
  assert.match(task(root, t.task_id).blocker.reason, /foreign_worktree_write/)
})

// RP-2026-10-10.1 — 독립 리뷰 캐시는 같은 diff·계약에 더해 같은 정책 판·같은 effort 일 때만 다시 쓴다(낮은 effort APPROVE 로 높은 요구를 건너뛰지 않는다)
test('RP1 독립 리뷰 캐시 키에 정책 판과 effort 가 들어간다', async () => {
  const { reviewKeyForTest, REVIEW_POLICY_VERSION, AUTO_CODEX } = await import('../lib/orchestrator.mjs')
  // 기본은 자동 Codex 없음(RP-2026-10-10.2) · VFC_AUTO_CODEX=1 일 때만 옛 판
  assert.equal(REVIEW_POLICY_VERSION, AUTO_CODEX ? 'RP-2026-10-10.1' : 'RP-2026-10-10.2')
  const t = { task_id: 'T-9', acceptance: ['a'], allowed_paths: ['src/**'], forbidden_paths: [] }
  const k = (e) => reviewKeyForTest(t, 'diff', { ok: 1 }, e)
  assert.equal(k('high'), k('high'))
  assert.notEqual(k('medium'), k('high'))
})
