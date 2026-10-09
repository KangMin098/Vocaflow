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
const kids = []
after(() => kids.forEach((k) => k.kill()))

function env(root, extra = {}) {
  return { ...process.env, VFC_ROOT: root, VFC_CLAUDE_CMD: FAKE_CLAUDE, VFC_CODEX_CMD: FAKE_CODEX, FAKE_STATE_DIR: root, VFC_PRODUCT_REPO: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), ...extra }
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
  const spec = { goal_id: 'VG-L3-A2-01', title: 'orch test', description: 'd', priority: 'P0', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0', '조건 1'], worktree: wt, branch: 'feat/t', ...over }
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
