// tests/usergoals.test.mjs — 사용자 지정 목표 다중 턴 협업(WF-S7) 시나리오 A~H
//
// ⚠ 이 테스트의 ChatGPT 응답 파일은 **테스트가 만든 모의 파일(SIMULATED)** 이다 — 사람이 ChatGPT 웹에서 받아 저장하는 구간을
// 대신한다. 실제 ChatGPT 연동 성공으로 기록하지 않는다. Claude·Codex 도 가짜 CLI(tests/fakes)다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const ORCH = path.join(REPO, 'bin', 'goal-orchestrator.mjs')
const FAKE_CLAUDE = `node ${path.join(REPO, 'tests', 'fakes', 'fake-claude.mjs').replace(/\\/g, '/')}`
const FAKE_CODEX = `node ${path.join(REPO, 'tests', 'fakes', 'fake-codex.mjs').replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const CANON = 'VG-L3-A2-01'

const env = (root, extra = {}) => ({ ...process.env, VFC_ROOT: root, VFC_CLAUDE_CMD: FAKE_CLAUDE, VFC_CODEX_CMD: FAKE_CODEX, FAKE_STATE_DIR: root, VFC_PRODUCT_REPO: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir(), CLAUDECODE: '', VFC_AGENT: '', ...extra })
function vfc(root, args, extra) {
  const r = spawnSync(process.execPath, [VFC, ...args, '--json'], { env: env(root, extra), encoding: 'utf8' })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }
  return { code: r.status, out: r.stdout, err: r.stderr, json }
}
function ok(r) {
  assert.equal(r.code, 0, r.err || r.out)
  return r.json
}
function orch(root, args = [], extra) {
  const r = spawnSync(process.execPath, [ORCH, '--no-ci', '--json', ...args], { env: env(root, extra), encoding: 'utf8', timeout: 240000 })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }
  assert.ok(json, r.stderr)
  return json
}
const state = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'state', f), 'utf8'))
const task = (root, id) => state(root, 'TASK_QUEUE.json').tasks.find((t) => t.task_id === id)

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ug-'))
  ok(vfc(root, ['init']))
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ugwt-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.writeFileSync(path.join(wt, 'README.md'), 'x\n')
  fs.writeFileSync(path.join(wt, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  ok(vfc(root, ['owner', 'bind-worktree', OWNER, wt, '--branch', 'feat/t']))
  return { root, wt }
}

const design = (over = {}) => ({ summary: '읽기 완료 기록 보강', design: 'src/ 에 기록 함수 추가', acceptance: ['완료 기록이 저장된다'], preserved_contracts: ['texts.status 값 집합 유지'], allowed_paths: ['src/**'], db_changes: false, ...over })

function goalFile(root, over = {}) {
  const f = path.join(root, `goal-${crypto.randomBytes(3).toString('hex')}.md`)
  fs.writeFileSync(f, `# ChatGPT 기획 (SIMULATED)\n\n\`\`\`json vfc-goal\n${JSON.stringify({ schema: 'vfc-goal/1', title: '읽기 완료 기록', canon_goal_ids: [CANON], profile: 'BALANCED', design: design(), ...over }, null, 2)}\n\`\`\`\n`)
  return f
}

/** 사람이 ChatGPT 에서 받아 저장하는 응답 파일을 흉내 낸다(SIMULATED). header 의 thread 값을 그대로 돌려준다(override 로 섞임 재현). */
function chatgptRespond(root, reqId, { plan = {}, override = {}, name = `${reqId}.response.md` } = {}) {
  const reqFile = [path.join(root, 'planning', 'requests', `${reqId}.md`), path.join(root, 'planning', 'archive', `${reqId}.md`)].find((f) => fs.existsSync(f))
  const header = JSON.parse(fs.readFileSync(reqFile, 'utf8').match(/```json vfc-request\s*\n([\s\S]*?)\n```/)[1])
  const t = header.thread
  const resp = {
    schema: 'vfc-response/1',
    request_id: reqId,
    responder: 'chatgpt',
    responded_at: new Date().toISOString(),
    canon_version: header.canon_version,
    verdict: 'revise',
    summary: '설계 보완안(SIMULATED)',
    findings: [],
    proposed_decisions: [],
    open_questions: [],
    thread_id: t.thread_id,
    goal_ref: t.goal_ref,
    round_id: t.round_id,
    design_version: t.design_version,
    plan: { goal_fit: '정본 목표와 맞다', design: '설계 v-next: src/ 에 기록 함수', priority: 'P1 — 학습 기록', learner_value: '완료가 남는다', scope: 'src 만', preserved_contracts: ['texts.status 값 집합 유지'], acceptance: ['완료 기록이 저장된다'], risks: ['없음'], allowed_paths: ['src/**'], db_changes: false, ...plan },
    ...override,
  }
  const f = path.join(root, 'planning', 'responses', name)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, `ChatGPT 응답(SIMULATED)\n\n\`\`\`json vfc-response\n${JSON.stringify(resp, null, 2)}\n\`\`\`\n`)
  return f
}
const intake = (root) => ok(vfc(root, ['ugoal', 'intake', '--min-age-ms', '0', '--by', 'user']))

function approve(root, ug, v, extra = []) {
  const d = ok(vfc(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${ug}@v${v} 승인`, '--approved-by', 'user', '--ref', 'test', '--by', 'user']))
  return ok(vfc(root, ['ugoal', 'approve', ug, '--design', String(v), '--decision', d.decision_id, ...extra, '--by', 'user']))
}
function addUgTask(root, wt, ug, over = {}) {
  const f = path.join(root, `spec-${crypto.randomBytes(3).toString('hex')}.json`)
  fs.writeFileSync(f, JSON.stringify({ goal_id: CANON, title: 'ug task', description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0'], worktree: wt, branch: 'feat/t', design_acceptance: [0], ...over }))
  return ok(vfc(root, ['ugoal', 'task', 'add', ug, '--file', f, '--by', OWNER]))
}
const routeOf = (root, ug) => ok(vfc(root, ['ugoal', 'route', ug])).route

test('A ChatGPT 기획 v1 → (승인 전 실행 없음) → 승인 → 구현 → Codex PASS → 목표 수용', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  assert.equal(g.designs[0].status, 'PROPOSED')
  assert.equal(g.route.route, 'APPROVAL_REQUIRED')
  // 승인 전 작업은 초안일 뿐 — 오케스트레이터가 고를 것이 없다
  assert.ok(addUgTask(root, wt, g.ug_id).draft)
  assert.equal(orch(root).iterations[0].selected, null)
  const a = approve(root, g.ug_id, 1)
  assert.equal(a.created.length, 1, '승인 시 초안이 작업으로')
  assert.equal(routeOf(root, g.ug_id), 'IMPLEMENTATION_REQUIRED')
  const r = orch(root)
  assert.equal(r.run.tasks_done[0].outcome, 'completed')
  assert.equal(routeOf(root, g.ug_id), 'GOAL_ACCEPTED')
  // 「--by user」 만으로는 수락되지 않는다
  assert.notEqual(vfc(root, ['ugoal', 'accept', g.ug_id, '--by', 'user']).code, 0)
  // 에이전트 안에서 기록된 승인도 근거가 아니다
  const ad = ok(vfc(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'goal_acceptance', '--summary', `${g.ug_id} accept`, '--approved-by', 'user', '--ref', 't', '--by', 'user'], { CLAUDECODE: '1' }))
  assert.equal(ad.recorded_via, 'agent')
  assert.notEqual(vfc(root, ['ugoal', 'accept', g.ug_id, '--decision', ad.decision_id, '--by', 'user']).code, 0)
  // 사용자가 직접 기록한 결정이면 수락
  const ud = ok(vfc(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'goal_acceptance', '--summary', `${g.ug_id} accept`, '--approved-by', 'user', '--ref', 't', '--by', 'user']))
  ok(vfc(root, ['ugoal', 'accept', g.ug_id, '--decision', ud.decision_id, '--by', 'user']))
  assert.equal(ok(vfc(root, ['ugoal', 'status', g.ug_id])).status, 'ACCEPTED')
})

test('B ChatGPT v1 → Claude 설계 충돌 → 재질의(쟁점 중심) → v2 → 승인 → 자동 재개 → 검증', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t = addUgTask(root, wt, g.ug_id)
  const r1 = orch(root, [], { FAKE_CLAUDE: 'design_issue' })
  assert.equal(r1.run.tasks_done[0].outcome, 'waiting_design')
  assert.match(task(root, t.task_id).blocker.reason, /^DESIGN_CONFLICT: REQ-/)
  const st = ok(vfc(root, ['ugoal', 'status', g.ug_id]))
  assert.equal(st.route.route, 'DESIGN_CONFLICT')
  const req = st.rounds.find((x) => x.recipient === 'chatgpt')
  const reqText = fs.readFileSync(path.join(root, 'planning', 'requests', `${req.request_id}.md`), 'utf8')
  assert.match(reqText, /쟁점/)
  assert.match(reqText, /A\/B 중 무엇을 따를지/)
  assert.doesNotMatch(reqText, /src\/ 에 기록 함수 추가/, '기존 설계 본문을 반복 전송하지 않는다(요약·쟁점만)')
  chatgptRespond(root, req.request_id, { plan: { preserved_contracts: ['texts.status 값 집합 유지', '완료 기록은 A 위치'] } })
  const res = intake(root)
  assert.equal(res.results[0].status, 'applied')
  assert.equal(res.results[0].design_version, 2)
  assert.equal(routeOf(root, g.ug_id), 'APPROVAL_REQUIRED')
  const a = approve(root, g.ug_id, 2)
  assert.deepEqual(a.resumed, [t.task_id], '설계 쟁점으로 멈춘 작업이 새 승인으로 자동 재개')
  assert.equal(task(root, t.task_id).design_version, 2)
  const r2 = orch(root)
  assert.equal(r2.run.tasks_done[0].outcome, 'completed')
  assert.equal(routeOf(root, g.ug_id), 'GOAL_ACCEPTED')
  const s = ok(vfc(root, ['ugoal', 'status', g.ug_id]))
  assert.deepEqual(s.designs.map((d) => d.status), ['SUPERSEDED', 'APPROVED'])
})

test('C Claude-first(DEEP) → ChatGPT 심층 기획 요청 → 응답 인수 → 승인 → 초안 작업 자동 생성·재개', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', '학습 원리 개편', '--goals', CANON, '--profile', 'DEEP', '--by', 'claude']))
  assert.equal(g.route.route, 'DESIGN_REQUIRED')
  assert.equal(g.route.actor, 'chatgpt')
  addUgTask(root, wt, g.ug_id)
  const req = ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--by', 'claude']))
  assert.equal(req.thread.goal_ref, g.ug_id)
  const w = ok(vfc(root, ['ugoal', 'route', g.ug_id]))
  assert.equal(w.waiting, true)
  assert.throws(() => ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--by', 'claude'])), /응답을 아직 기다리는/, '같은 목표에 요청을 겹쳐 보내지 않는다')
  chatgptRespond(root, req.request_id)
  assert.equal(intake(root).results[0].status, 'applied')
  const a = approve(root, g.ug_id, 1)
  assert.equal(a.created.length, 1)
  assert.equal(orch(root).run.tasks_done[0].outcome, 'completed')
  assert.equal(routeOf(root, g.ug_id), 'GOAL_ACCEPTED')
})

test('D Codex 코드 결함 → Claude 자동 수정 → Codex 재리뷰 — ChatGPT 왕복 없음', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t = addUgTask(root, wt, g.ug_id)
  const r = orch(root, [], { FAKE_CODEX: 'p1_once' })
  assert.equal(r.run.tasks_done[0].outcome, 'completed')
  assert.ok(task(root, t.task_id).history.some((h) => h.from === 'REVIEW' && h.to === 'READY'), '리뷰 반려 → 수정 라운드가 있었다')
  const s = ok(vfc(root, ['ugoal', 'status', g.ug_id]))
  assert.equal(s.rounds.filter((x) => x.recipient === 'chatgpt').length, 0, '코드 결함은 ChatGPT 로 가지 않는다')
})

test('D2 Codex 가 설계 문제(kind design)를 짚으면 Claude 루프가 아니라 설계 재질의', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t = addUgTask(root, wt, g.ug_id)
  const r = orch(root, [], { FAKE_CODEX: 'design_once' })
  assert.equal(r.run.tasks_done[0].outcome, 'waiting_design')
  assert.match(task(root, t.task_id).blocker.reason, /^DESIGN_CONFLICT/)
  assert.equal(routeOf(root, g.ug_id), 'DESIGN_CONFLICT')
})

test('E ChatGPT 응답은 정상이지만 DB 변경 승인이 없으면 승인 대기 — DB 작업 생성 거부', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', 'DB 필요한 목표', '--goals', CANON, '--profile', 'CRITICAL', '--by', 'claude']))
  const req = ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--by', 'claude']))
  chatgptRespond(root, req.request_id, { plan: { db_changes: true } })
  assert.equal(intake(root).results[0].status, 'applied')
  approve(root, g.ug_id, 1)
  const rt = ok(vfc(root, ['ugoal', 'route', g.ug_id]))
  assert.equal(rt.route, 'APPROVAL_REQUIRED')
  assert.equal(rt.db, true)
  const r = vfc(root, ['ugoal', 'task', 'add', g.ug_id, '--file', (() => {
    const f = path.join(root, 'db-spec.json')
    fs.writeFileSync(f, JSON.stringify({ goal_id: CANON, title: 'db', description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: [], acceptance: ['a'], worktree: wt, branch: 'feat/t', db_scope: { mode: 'write', targets: ['dev'] } }))
    return f
  })(), '--by', OWNER])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /DB 변경 승인이 없다/)
  // CRITICAL 프로필 작업은 그 커밋의 REVIEW_PASS 를 요구한다(게이트 상향 · 하향 없음)
  const t = addUgTask(root, wt, g.ug_id)
  assert.equal(task(root, t.task_id).require_review_pass, true)
})

test('F 한 목표가 ChatGPT 대기면 다른 목표 작업 진행 → 응답 도착·승인 후 원래(활성) 목표로 복귀', () => {
  const { root, wt } = setup()
  const g1 = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', '활성 목표', '--goals', CANON, '--profile', 'DEEP', '--by', 'claude']))
  const g2 = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root, { title: '다른 목표' }), '--by', 'user']))
  approve(root, g2.ug_id, 1)
  const t2a = addUgTask(root, wt, g2.ug_id, { priority: 'P0', title: 'g2-a' })
  const t2b = addUgTask(root, wt, g2.ug_id, { priority: 'P0', title: 'g2-b' })
  ok(vfc(root, ['ugoal', 'activate', g1.ug_id, '--by', 'user']))
  addUgTask(root, wt, g1.ug_id, { priority: 'P3', title: 'g1' })
  const req = ok(vfc(root, ['ugoal', 'request-design', g1.ug_id, '--by', 'claude']))
  const r1 = orch(root)
  assert.equal(r1.iterations[0].selected.task_id, t2a.task_id, '활성 목표가 대기 중이면 다른 목표 작업')
  chatgptRespond(root, req.request_id)
  intake(root)
  const a = approve(root, g1.ug_id, 1)
  const t1 = a.created[0]
  const r2 = orch(root)
  assert.equal(r2.iterations[0].selected.task_id, t1, '활성 목표에 진행 가능한 작업이 생기면 우선순위(P3)가 낮아도 먼저')
  assert.equal(task(root, t2b.task_id).status, 'READY')
})

test('G 여러 목표 응답이 섞여 도착 — 다른 목표·라운드 응답 거부 · 중복 재적용 없음 · 복사 중 파일 무시', () => {
  const { root } = setup()
  const g1 = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', 'g1', '--goals', CANON, '--by', 'claude']))
  const g2 = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', 'g2', '--goals', CANON, '--by', 'claude']))
  const q1 = ok(vfc(root, ['ugoal', 'request-design', g1.ug_id, '--by', 'claude']))
  const q2 = ok(vfc(root, ['ugoal', 'request-design', g2.ug_id, '--by', 'claude']))
  // q1 이름의 파일에 g2 thread 값 → 거부
  chatgptRespond(root, q1.request_id, { override: { thread_id: q2.thread.thread_id, goal_ref: g2.ug_id, round_id: q2.thread.round_id } })
  // 복사 중(.part)·빈 파일은 집지 않는다
  fs.writeFileSync(path.join(root, 'planning', 'responses', `${q2.request_id}.response.md.part`), 'partial')
  fs.writeFileSync(path.join(root, 'planning', 'responses', `${q2.request_id}.response.json`), '')
  const r = intake(root)
  assert.equal(r.processed, 1)
  assert.equal(r.results[0].status, 'rejected')
  assert.match(r.results[0].reason, /다른 목표·라운드의 응답/)
  assert.ok(fs.existsSync(path.join(root, r.results[0].moved_to)), '거부 원문 보존')
  assert.equal(ok(vfc(root, ['ugoal', 'status', g2.ug_id])).designs.length, 0, 'g2 에 잘못 적용되지 않았다')
  // 정상 응답 → 적용, 같은 내용을 다시 넣으면 중복
  const f = chatgptRespond(root, q2.request_id, { name: `${q2.request_id}.response.md` })
  const text = fs.readFileSync(f, 'utf8')
  assert.equal(intake(root).results.find((x) => x.file === `${q2.request_id}.response.md`).status, 'applied')
  fs.writeFileSync(f, text)
  const again = intake(root).results.find((x) => x.file === `${q2.request_id}.response.md`)
  assert.equal(again.status, 'duplicate')
  assert.equal(ok(vfc(root, ['ugoal', 'status', g2.ug_id])).designs.length, 1, '중복 재적용 없음')
})

test('H 설계 계약 변경(v2 승인)이 v1 로 끝난 작업을 재검증 대상으로 — 목표 완료·선정에서 빠진다', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t1 = addUgTask(root, wt, g.ug_id)
  const old = addUgTask(root, wt, g.ug_id, { title: 'v1 남은 작업' })
  orch(root, ['--max-tasks', '1'])
  assert.equal(task(root, t1.task_id).status, 'COMPLETED')
  const req = ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--issue-file', (() => {
    const f = path.join(root, 'issue.json')
    fs.writeFileSync(f, JSON.stringify({ problem: '수용 기준이 부족하다', evidence: ['감사'], conflicts_with: '수용 기준 0', alternatives: ['기준 추가'], question: '기준을 바꿀까', approval_scope_change: false }))
    return f
  })(), '--by', 'claude']))
  chatgptRespond(root, req.request_id, { plan: { acceptance: ['완료 기록이 저장된다', '중복 완료는 한 번만 센다'] } })
  intake(root)
  const a = approve(root, g.ug_id, 2)
  assert.equal(a.contract_changed, true)
  assert.deepEqual(a.invalidated, [t1.task_id])
  assert.ok(task(root, t1.task_id).revalidate_required)
  assert.notEqual(routeOf(root, g.ug_id), 'GOAL_ACCEPTED')
  const r = orch(root)
  assert.match(r.iterations[0].skipped.find((s) => s.task_id === old.task_id).reason, /SUPERSEDED/)
  const acc = vfc(root, ['ugoal', 'accept', g.ug_id, '--by', 'user'])
  assert.notEqual(acc.code, 0, '완료로 위장하지 않는다')
})

test('예산: 같은 설계 쟁점 재질의는 상한까지 — 넘으면 거부(작업 보류 근거)', () => {
  const { root } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', 'b', '--goals', CANON, '--by', 'claude']))
  const f = path.join(root, 'issue.json')
  fs.writeFileSync(f, JSON.stringify({ problem: '같은 쟁점', question: 'q', issue_key: 'K1' }))
  for (let i = 0; i < 2; i++) {
    const q = ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--issue-file', f, '--by', 'claude']))
    chatgptRespond(root, q.request_id)
    intake(root)
  }
  const third = vfc(root, ['ugoal', 'request-design', g.ug_id, '--issue-file', f, '--by', 'claude'])
  assert.notEqual(third.code, 0)
  assert.match(third.err, /재질의 2회 = 상한 2/)
})

test('호환: thread 없는 옛 요청 응답은 intake 가 건드리지 않고 planning import 몫으로 남긴다', () => {
  const { root } = setup()
  const q = path.join(root, 'q.md')
  fs.writeFileSync(q, '옛 형식 질문')
  const req = ok(vfc(root, ['planning', 'request', '--topic', 't', '--question-file', q, '--goals', CANON, '--by', 'claude']))
  const resp = { schema: 'vfc-response/1', request_id: req.id, responder: 'chatgpt', responded_at: new Date().toISOString(), canon_version: req.header.canon_version, verdict: 'approve', summary: 's', findings: [], proposed_decisions: [], open_questions: [] }
  fs.writeFileSync(path.join(root, 'planning', 'responses', `${req.id}.response.md`), `\`\`\`json vfc-response\n${JSON.stringify(resp)}\n\`\`\`\n`)
  const r = intake(root)
  assert.equal(r.results[0].status, 'not_thread')
  assert.ok(fs.existsSync(path.join(root, 'planning', 'responses', `${req.id}.response.md`)))
  ok(vfc(root, ['planning', 'import', req.id, '--by', 'claude']))
})

test('B2 재개된 작업은 새 설계에 같은 문장이 있는 수용 기준만 덮는다 — 바뀐 기준을 옛 번호로 덮지 않는다', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t = addUgTask(root, wt, g.ug_id)
  orch(root, [], { FAKE_CLAUDE: 'design_issue' })
  const req = ok(vfc(root, ['ugoal', 'status', g.ug_id])).rounds.find((x) => x.recipient === 'chatgpt')
  chatgptRespond(root, req.request_id, { plan: { acceptance: ['완료 기록이 A 위치에 저장된다'] } })
  intake(root)
  approve(root, g.ug_id, 2)
  assert.deepEqual(task(root, t.task_id).design_acceptance, [])
  orch(root)
  assert.equal(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(routeOf(root, g.ug_id), 'IMPLEMENTATION_REQUIRED', '덮이지 않은 새 기준이 남는다')
})

test('승인 토큰 경계: UG-0001@v10 승인 결정으로 v1 을 승인할 수 없다 · vfc task add 로 사용자 목표 직접 묶기 거부', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root), '--by', 'user']))
  const d = ok(vfc(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${g.ug_id}@v10 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user']))
  const r = vfc(root, ['ugoal', 'approve', g.ug_id, '--design', '1', '--decision', d.decision_id, '--by', 'user'])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /APPROVAL_MISMATCH|없다/)
  const f = path.join(root, 'direct.json')
  fs.writeFileSync(f, JSON.stringify({ goal_id: CANON, title: 'x', description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['anything/**'], forbidden_paths: [], acceptance: ['a'], worktree: wt, branch: 'feat/t', user_goal_id: g.ug_id, design_version: 1 }))
  const direct = vfc(root, ['task', 'add', '--file', f])
  assert.notEqual(direct.code, 0)
  assert.match(direct.err, /UG_BIND_REQUIRED|ugoal task add/)
})

test('r2: 대소문자만 바뀐 계약도 계약 변경 · 리뷰 중 옛 버전 작업은 재검증 · DEEP 의 Claude 초안 바로 승인 거부', () => {
  const { root, wt } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'chatgpt', '--file', goalFile(root, { design: design({ preserved_contracts: ['status ACTIVE 유지'] }) }), '--by', 'user']))
  approve(root, g.ug_id, 1)
  const t = addUgTask(root, wt, g.ug_id)
  orch(root)
  const q = ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--by', 'claude']))
  chatgptRespond(root, q.request_id, { plan: { preserved_contracts: ['status active 유지'] } })
  intake(root)
  const a = approve(root, g.ug_id, 2)
  assert.equal(a.contract_changed, true)
  assert.deepEqual(a.invalidated, [t.task_id])
  const deep = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', 'deep', '--goals', CANON, '--profile', 'DEEP', '--design-file', (() => {
    const f = path.join(root, 'dd.json')
    fs.writeFileSync(f, JSON.stringify(design()))
    return f
  })(), '--by', 'claude']))
  const dd = ok(vfc(root, ['decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${deep.ug_id}@v1 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user']))
  const r = vfc(root, ['ugoal', 'approve', deep.ug_id, '--design', '1', '--decision', dd.decision_id, '--by', 'user'])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /DESIGN_REVIEW_REQUIRED|ChatGPT 설계 검토가 선행/)
})

test('목표 id 이름공간: 두 인스턴스가 각자 첫 목표를 만들어도 UG·TH id 가 겹치지 않고, 같은 인스턴스 안에서는 순번이 이어진다', () => {
  const a = setup().root
  const b = setup().root
  const start = (root, title) => ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', title, '--goals', CANON, '--by', 'claude']))
  const ga = start(a, 'A 첫 목표')
  const gb = start(b, 'B 첫 목표')
  const nsA = fs.readFileSync(path.join(a, 'planning', 'bridge-instance.txt'), 'utf8').trim()
  assert.match(ga.ug_id, new RegExp(`^UG-${nsA}-0001$`))
  assert.match(ga.thread_id, new RegExp(`^TH-${nsA}-0001$`))
  assert.notEqual(ga.ug_id, gb.ug_id)
  assert.notEqual(ga.thread_id, gb.thread_id)
  const ga2 = start(a, 'A 둘째 목표')
  assert.equal(ga2.ug_id, `UG-${nsA}-0002`)
})

test('ugoal draft: 설계 없는 목표에 Claude 초안 → 패킷 범위 생김 · 응답 대기 중이면 거부', () => {
  const { root } = setup()
  const g = ok(vfc(root, ['ugoal', 'start', '--from', 'claude', '--title', '초안 없음', '--goals', CANON, '--by', 'claude']))
  const f = path.join(root, 'd.json')
  fs.writeFileSync(f, JSON.stringify(design()))
  const d = ok(vfc(root, ['ugoal', 'draft', g.ug_id, '--design-file', f, '--by', 'claude']))
  assert.equal(d.status, 'DRAFT')
  assert.deepEqual(d.allowed_paths, ['src/**'])
  ok(vfc(root, ['ugoal', 'request-design', g.ug_id, '--no-context', '--by', 'claude']))
  assert.notEqual(vfc(root, ['ugoal', 'draft', g.ug_id, '--design-file', f, '--by', 'claude']).code, 0, '응답 대기 중 초안 거부')
})
