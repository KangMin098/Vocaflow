// tests/operations.test.mjs — 목표 중심 연속 운영 시나리오 A~H(WF-S14)
//
// ⚠ Claude·Codex·GitHub 은 가짜(tests/fakes), Work 댓글은 테스트가 넣는 모의 응답(SIMULATED)이다.
// 오케스트레이터·상태·잠금·브리지 tick·승인 경계는 실제 코드가 돈다. 실제 제품 목표 실행의 근거가 아니다(보고서에 분리 기록).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const ORCH = path.join(REPO, 'bin', 'goal-orchestrator.mjs')
const fake = (n) => `node ${path.join(REPO, 'tests', 'fakes', n).replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const CANON = 'VG-L3-A2-01'
const XREPO = 'owner/vocaflow-exchange'
const kids = []
after(() => kids.forEach((k) => k.kill('SIGKILL')))

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ops-'))
  const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-opsgh-'))
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-opswt-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.mkdirSync(path.join(wt, 'src'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'AGENTS.md'), '# A\n\n## 프로젝트\n\n- 운영 시나리오\n\n## 끝\n')
  fs.writeFileSync(path.join(wt, 'src', 'x.ts'), 'export const x = 1\n')
  fs.writeFileSync(path.join(wt, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const env = { ...process.env, VFC_ROOT: root, VFC_PRODUCT_REPO: wt, VFC_GH_CMD: fake('fake-gh.mjs'), FAKE_GH_DIR: ghDir, VFC_CLAUDE_CMD: fake('fake-claude.mjs'), VFC_CODEX_CMD: fake('fake-codex.mjs'), FAKE_STATE_DIR: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir(), CLAUDECODE: '', VFC_AGENT: '' }
  const run = (bin, args, extra = {}, input) => {
    const r = spawnSync(process.execPath, [bin, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 240000, input })
    return { code: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  }
  const vfc = (...a) => {
    const r = run(VFC, [...a, '--json'])
    assert.equal(r.code, 0, r.err)
    return r.json
  }
  const orch = (args = [], extra = {}) => {
    const r = run(ORCH, ['--no-ci', '--json', ...args], extra)
    assert.ok(r.json, r.err)
    return r.json
  }
  vfc('init')
  vfc('owner', 'bind-worktree', OWNER, wt, '--branch', 'feat/t')
  const gh = () => JSON.parse(fs.readFileSync(path.join(ghDir, 'state.json'), 'utf8'))
  const workReplies = (prNumber, plan = {}) => {
    const st = gh()
    const pr = st.prs.find((p) => p.number === prNumber)
    const id = pr.title.match(/(REQ-\d{8}-(?:[0-9a-f]{8}-)?\d{3})/)[1]
    const md = Buffer.from(st.files[`${pr.headRefName}:requests/${id}.md`], 'base64').toString('utf8')
    const h = JSON.parse(md.match(/```json vfc-request\s*\n([\s\S]*?)\n```/)[1])
    const resp = { schema: 'vfc-response/1', request_id: id, responder: 'chatgpt', responded_at: new Date().toISOString(), canon_version: h.canon_version, verdict: 'revise', summary: 'SIMULATED Work 응답', findings: [], proposed_decisions: [], open_questions: [], thread_id: h.thread.thread_id, goal_ref: h.thread.goal_ref, round_id: h.thread.round_id, design_version: h.thread.design_version, ...(h.thread.context_base_commit ? { context_base_commit: h.thread.context_base_commit } : {}), plan: { goal_fit: 'g', design: 'Work 설계', priority: 'P1 — x', learner_value: 'v', scope: 's', preserved_contracts: ['계약 유지'], acceptance: ['기준 0', '기준 1'], risks: ['r'], allowed_paths: ['src/**'], db_changes: false, ...plan } }
    pr.comments.push({ author: 'chatgpt-work[bot]', type: 'Bot', at: new Date().toISOString(), body: `설계입니다.\n\n\`\`\`json vfc-response\n${JSON.stringify(resp, null, 2)}\n\`\`\`\n` })
    fs.writeFileSync(path.join(ghDir, 'state.json'), JSON.stringify(st, null, 2))
  }
  const bridgeOn = () => {
    fs.mkdirSync(path.join(root, 'config'), { recursive: true })
    fs.writeFileSync(path.join(root, 'config', 'bridge.json'), JSON.stringify({ repo: XREPO, wait_work_min: 0 }))
  }
  const goal = (title, design = { summary: title, acceptance: ['기준 0', '기준 1'], preserved_contracts: ['계약 유지'], allowed_paths: ['src/**'], db_changes: false }) => {
    const f = path.join(root, `d-${title}.json`)
    fs.writeFileSync(f, JSON.stringify(design))
    return vfc('ugoal', 'start', '--from', 'claude', '--title', title, '--goals', CANON, '--design-file', f, '--by', 'claude')
  }
  const approve = (ug, v) => {
    const d = vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${ug}@v${v} 승인`, '--approved-by', 'user', '--ref', 'test', '--by', 'user')
    return vfc('ugoal', 'approve', ug, '--design', String(v), '--decision', d.decision_id, '--by', 'user')
  }
  const ugTask = (ug, idx, over = {}) => {
    const f = path.join(root, `t-${ug}-${idx.join('')}-${Math.random().toString(16).slice(2, 6)}.json`)
    fs.writeFileSync(f, JSON.stringify({ goal_id: CANON, title: `${ug} 기준 ${idx}`, description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0'], worktree: wt, branch: 'feat/t', design_acceptance: idx, ...over }))
    return vfc('ugoal', 'task', 'add', ug, '--file', f, '--by', OWNER)
  }
  const task = (id) => vfc('task', 'show', id)
  return { root, wt, vfc, run, orch, gh, workReplies, bridgeOn, goal, approve, ugTask, task, env, ghDir }
}

test('A·E·H — 한 목표의 승인된 작업 2개를 한 실행에서 연속 처리 · 중간에 남은 기준으로 다음 작업 선정 · 사용자 수락 없이는 USER_ACCEPTED 아님', () => {
  const s = setup()
  const u = s.goal('A목표')
  s.approve(u.ug_id, 1)
  const t0 = s.ugTask(u.ug_id, [0])
  const t1 = s.ugTask(u.ug_id, [1])
  // E: 첫 작업만 — 기준 [1] 이 남아 다음 선정이 그 작업이다
  const r1 = s.orch(['--max-tasks', '1'])
  assert.equal(r1.run.tasks_done[0].outcome, 'completed')
  assert.equal(r1.iterations[0].goal_level.level, 'GOAL_PARTIAL')
  assert.deepEqual(r1.iterations[0].goal_level.coverage.missing, [1])
  const dry = s.orch(['--dry-run'])
  assert.equal(dry.iterations[0].selected.task_id, t1.task_id, '남은 미충족 기준의 작업을 고른다')
  // A: 새 목표에서 두 작업을 한 실행으로 연속 완료
  const v = s.goal('A2목표')
  s.approve(v.ug_id, 1)
  s.ugTask(v.ug_id, [0])
  s.ugTask(v.ug_id, [1])
  const r2 = s.orch(['--max-tasks', '5'])
  const done = r2.run.tasks_done.filter((x) => x.outcome === 'completed').map((x) => x.task_id)
  assert.ok(done.length >= 3, `연속 완료: ${JSON.stringify(r2.run.tasks_done)}`)
  assert.equal(s.vfc('ugoal', 'route', v.ug_id).route, 'GOAL_VERIFIED')
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'GOAL_VERIFIED')
  assert.equal(s.task(t0.task_id).status, 'COMPLETED')
  // H: 비대화형 「--by user」 결정으로는 수락 불가 · 대화형 승인(테스트 대역)만
  const cd = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'goal_acceptance', '--summary', `${v.ug_id} accept`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  assert.match(s.run(VFC, ['ugoal', 'accept', v.ug_id, '--decision', cd.decision_id, '--by', 'user']).err, /TRUST_REQUIRED/)
  assert.equal(s.vfc('ugoal', 'route', v.ug_id).route, 'GOAL_VERIFIED')
  const td = s.run(VFC, ['approve', '--kind', 'goal_acceptance', '--summary', `${v.ug_id} accept`, '--json'], { VFC_TTY_FOR_TESTS: '1', VFC_TEST_CODE: 'abc123' }, 'abc123\n').json
  s.vfc('ugoal', 'accept', v.ug_id, '--decision', td.decision_id, '--by', 'user')
  assert.equal(s.vfc('ugoal', 'route', v.ug_id).route, 'USER_ACCEPTED')
})

test('B·D — Work 요청은 오케스트레이터가 게시하고(단일 in-flight), 기다리는 동안 다른 목표 작업을 실행하며, 응답은 다음 반복에서 자동 인수 → 승인 뒤 자동 재개', () => {
  const s = setup()
  s.bridgeOn()
  // 목표 X: 설계 요청 대기(승인 전) · 목표 Y: 승인된 작업
  const x = s.goal('X목표')
  s.vfc('ugoal', 'request-design', x.ug_id, '--by', 'claude')
  const x2 = s.goal('X2목표')
  s.vfc('ugoal', 'request-design', x2.ug_id, '--by', 'claude') // 다른 목표의 요청 — in-flight 하나라 게시 대기
  const y = s.goal('Y목표')
  s.approve(y.ug_id, 1)
  const ty = s.ugTask(y.ug_id, [0, 1])
  const r1 = s.orch(['--max-tasks', '3'])
  assert.ok(r1.iterations[0].bridge.published, `첫 반복에서 X 요청 게시: ${JSON.stringify(r1.iterations[0].bridge)}`)
  assert.equal(s.gh().prs.length, 1, '응답 대기 중에는 다음 요청을 올리지 않는다(단일 in-flight)')
  assert.equal(r1.run.tasks_done.find((d) => d.task_id === ty.task_id)?.outcome, 'completed', 'X 가 Work 응답을 기다리는 동안 Y 작업을 끝낸다')
  // Work 가 답한다(모의) → 다음 실행의 첫 반복이 수집·인수
  s.workReplies(1)
  const r2 = s.orch(['--max-tasks', '1'])
  assert.equal(r2.iterations[0].bridge.collected.length, 1)
  assert.equal(s.gh().prs.length, 2, '수집한 같은 tick 에서 줄 선 다음 요청(X2)을 게시한다')
  const st = s.vfc('ugoal', 'status', x.ug_id)
  assert.equal(st.designs.at(-1).status, 'PROPOSED', '응답은 PROPOSED 로만(자동 승인 없음)')
  assert.equal(s.vfc('ugoal', 'route', x.ug_id).route, 'APPROVAL_REQUIRED')
  // 승인 전 초안 작업 → 승인 시 작업으로 → 다음 실행이 자동 실행
  s.ugTask(x.ug_id, [0, 1])
  const v = st.designs.at(-1).version
  const a = s.approve(x.ug_id, v)
  assert.ok(a.created.length >= 1, '승인이 초안을 작업으로 만든다')
  const r3 = s.orch(['--max-tasks', '2'])
  assert.ok(r3.run.tasks_done.some((d) => d.outcome === 'completed'))
  assert.equal(s.vfc('ugoal', 'route', x.ug_id).route, 'GOAL_VERIFIED')
})

test('C — 담당 세션이 죽은 작업은 같은 owner 아래 재개, 살아 있는 세션의 작업은 건드리지 않는다', async () => {
  const s = setup()
  const u = s.goal('C목표')
  s.approve(u.ug_id, 1)
  const dead = s.ugTask(u.ug_id, [0])
  // 살아 있는 세션은 다른 worktree 에서 일한다(같은 worktree 는 원래 동시에 둘이 못 쓴다)
  const wt2 = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-opswt2-'))
  fs.rmSync(wt2, { recursive: true })
  execFileSync('git', ['-C', s.wt, 'worktree', 'add', '-q', '-b', 'feat/t2', wt2])
  s.vfc('owner', 'bind-worktree', OWNER, wt2, '--branch', 'feat/t2')
  const live = s.ugTask(u.ug_id, [1], { worktree: wt2, branch: 'feat/t2' })
  const ttl1 = { VFC_LOCK_TTL_MS: '1' } // 죽은 세션의 잠금은 ttl 이 지나야 회수된다 — 테스트에서 ttl 을 짧게
  // 죽은 세션: 끝난 프로세스의 pid 로 작업을 잡고 있던 상태
  const gone = spawnSync(process.execPath, ['-e', 'process.exit(0)'])
  assert.equal(s.run(VFC, ['task', 'start', dead.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'vocaflow-dead-session', '--pid', String(gone.pid)], ttl1).code, 0)
  // 살아 있는 세션: 지금 도는 프로세스
  const holder = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 600000)'], { stdio: 'ignore' })
  kids.push(holder)
  s.vfc('task', 'start', live.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'vocaflow-live-session', '--pid', String(holder.pid))
  const reap = s.run(VFC, ['task', 'reap', '--json'], ttl1).json
  assert.ok(JSON.stringify(reap).includes(dead.task_id), `죽은 세션 작업 회수: ${JSON.stringify(reap)}`)
  assert.equal(s.task(live.task_id).status, 'IN_PROGRESS', '살아 있는 세션 작업은 그대로')
  const r = s.orch(['--max-tasks', '2'], ttl1)
  const d = s.task(dead.task_id)
  assert.equal(d.status, 'COMPLETED', `재개: ${JSON.stringify(r.run.tasks_done)}`)
  assert.equal(d.owner_id, OWNER, 'owner 는 바뀌지 않는다(세션만 새로)')
  assert.equal(s.task(live.task_id).status, 'IN_PROGRESS', '살아 있는 작업은 다시 실행하지 않는다(중복 실행 없음)')
})

test('F — 사용자 대화형 승인 없이 DB 범위·정본 재봉인·DB 쓰기 승인은 막힌다', () => {
  const s = setup()
  const u = s.goal('F목표', { summary: 'db', acceptance: ['기준 0'], preserved_contracts: ['c'], allowed_paths: ['src/**'], db_changes: true })
  const d = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1 승인 · ${u.ug_id}@v1 db`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  const r = s.run(VFC, ['ugoal', 'approve', u.ug_id, '--design', '1', '--decision', d.decision_id, '--db-decision', d.decision_id, '--by', 'user'])
  assert.match(r.err, /TRUST_REQUIRED/, 'DB 범위는 대화형 승인만')
  const c = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'canon_change', '--summary', '정본 변경', '--approved-by', 'user', '--ref', 't', '--by', 'user')
  assert.match(s.run(VFC, ['goals', 'seal', '--decision', c.decision_id, '--by', 'user']).err, /RESEAL_NOT_APPROVED/)
  assert.match(s.run(VFC, ['approve', '--kind', 'db_write', '--summary', 'x'], { CLAUDECODE: '1' }, 'x\n').err, /TRUST_REQUIRED/, '에이전트는 vfc approve 를 통과하지 못한다')
})

test('G — 같은 작업 중복 실행 방지: 오케스트레이터 동시 실행 거부 · 같은 기준 중복 작업 등록 거부', async () => {
  const s = setup()
  const u = s.goal('G목표')
  s.approve(u.ug_id, 1)
  const t = s.ugTask(u.ug_id, [0])
  rejects(() => s.ugTask(u.ug_id, [0]), /DUPLICATE_TASK/)
  const first = spawn(process.execPath, [ORCH, '--no-ci', '--json'], { env: { ...s.env, FAKE_CLAUDE: 'hang' }, stdio: 'ignore' })
  kids.push(first)
  for (let i = 0; i < 100 && s.task(t.task_id).status !== 'IN_PROGRESS'; i++) await new Promise((r) => setTimeout(r, 200))
  const second = s.run(ORCH, ['--no-ci', '--json'])
  assert.equal(second.json.status, 'refused', '단일 writer')
  first.kill('SIGKILL')
})

function rejects(fn, re) {
  try {
    fn()
  } catch (e) {
    assert.match(String(e.message), re)
    return
  }
  assert.fail('거부되어야 한다')
}

test('C2 — 죽은 세션의 worktree 에 미커밋 변경이 있으면 되살리지 않고 사유를 남긴다 · 통과한 리뷰는 같은 diff 재리뷰에 재사용(캐시 기록)', () => {
  const s = setup()
  const u = s.goal('C2목표')
  s.approve(u.ug_id, 1)
  const t = s.ugTask(u.ug_id, [0])
  const gone = spawnSync(process.execPath, ['-e', 'process.exit(0)'])
  const ttl1 = { VFC_LOCK_TTL_MS: '1' }
  assert.equal(s.run(VFC, ['task', 'start', t.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'dead-dirty', '--pid', String(gone.pid)], ttl1).code, 0)
  fs.writeFileSync(path.join(s.wt, 'src', 'half.ts'), 'export const half = 1\n') // 죽은 세션이 남긴 미커밋 작업
  const r = s.orch(['--max-tasks', '1'], ttl1)
  assert.deepEqual(r.handoff.kept.map((k) => k.task_id), [t.task_id])
  assert.equal(s.task(t.task_id).status, 'BLOCKED')
  assert.match(s.task(t.task_id).blocker.reason, /미커밋 변경/)
  // 사람이 정리하면(커밋) 다음 실행에서 이어 간다 · 통과 리뷰는 캐시에 남는다
  execFileSync('git', ['-C', s.wt, 'add', '.'])
  execFileSync('git', ['-C', s.wt, 'commit', '-q', '-m', 'half'])
  s.vfc('task', 'unblock', t.task_id, '--by', OWNER)
  assert.equal(s.orch(['--max-tasks', '1']).run.tasks_done[0].outcome, 'completed')
  const cache = JSON.parse(fs.readFileSync(path.join(s.root, 'runtime', 'review-cache.json'), 'utf8'))
  assert.ok(Object.keys(cache).some((k) => k.startsWith(`${t.task_id}:`)))
})

test('Codex P1·P2 — dry-run 은 브리지 부작용 없음 · 받아 둔 응답의 인수가 실패해도 다음 tick 이 다시 인수한다', () => {
  const s = setup()
  s.bridgeOn()
  const x = s.goal('DR목표')
  s.vfc('ugoal', 'request-design', x.ug_id, '--by', 'claude')
  const d = s.orch(['--dry-run'])
  assert.equal(d.iterations[0].bridge, null)
  assert.ok(!fs.existsSync(path.join(s.ghDir ?? '', 'state.json')) || s.gh().prs.length === 0, 'dry-run 은 게시하지 않는다')
  s.orch(['--max-tasks', '1']) // 실제 실행이 게시
  s.workReplies(1)
  // 수집은 되지만 인수가 실패하는 상황 — 인수 CLI 를 일시적으로 없는 경로로
  const bad = s.run(path.join(REPO, 'poc', 'work-bridge.mjs'), ['tick', '--repo', XREPO], { VFC_CLI: path.join(s.root, 'missing.mjs') }).json
  assert.equal(bad.collected.length, 1)
  assert.ok(bad.errors.some((e) => /intake/.test(e)))
  assert.equal(s.vfc('ugoal', 'status', x.ug_id).designs.at(-1).status, 'DRAFT', '아직 인수 안 됨(Claude 초안 v1 만)')
  const ok2 = s.run(path.join(REPO, 'poc', 'work-bridge.mjs'), ['tick', '--repo', XREPO]).json
  assert.equal(ok2.collected.length, 0, '이미 수집됨')
  assert.equal(s.vfc('ugoal', 'status', x.ug_id).designs.at(-1).status, 'PROPOSED', '다음 tick 이 인수')
})

test('Codex P1 — 죽은 세션이 커밋을 남기면 자동 재개하지 않는다(그 커밋이 리뷰 기준에서 빠지지 않게)', () => {
  const s = setup()
  const u = s.goal('C3목표')
  s.approve(u.ug_id, 1)
  const t = s.ugTask(u.ug_id, [0])
  const gone = spawnSync(process.execPath, ['-e', 'process.exit(0)'])
  const ttl1 = { VFC_LOCK_TTL_MS: '1' }
  assert.equal(s.run(VFC, ['task', 'start', t.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'dead-commit', '--pid', String(gone.pid)], ttl1).code, 0)
  assert.ok(s.task(t.task_id).run.start_head, '세션 시작 기준 기록')
  fs.writeFileSync(path.join(s.wt, 'src', 'c.ts'), 'export const c = 1\n')
  execFileSync('git', ['-C', s.wt, 'add', '.'])
  execFileSync('git', ['-C', s.wt, 'commit', '-q', '-m', 'dead session commit'])
  const r = s.orch(['--max-tasks', '1'], ttl1)
  assert.deepEqual(r.handoff.kept.map((k) => k.task_id), [t.task_id])
  assert.match(s.task(t.task_id).blocker.reason, /커밋을 남겼다/)
})

test('자동 적용 — 사용자 대화형 설계 승인(vfc approve) 하나로 다음 반복이 설계를 적용하고 초안 작업을 실행한다 · cli 기록은 무시', () => {
  const s = setup()
  const u = s.goal('AA목표')
  s.ugTask(u.ug_id, [0, 1]) // 승인 전 → 초안
  // cli(비대화형) 결정은 자동 적용하지 않는다
  s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  const r0 = s.orch(['--max-tasks', '1'])
  assert.equal(r0.iterations[0].selected, null, 'cli 승인으로는 실행하지 않는다')
  const td = s.run(VFC, ['approve', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1`, '--paths', 'src/**', '--json'], { VFC_TTY_FOR_TESTS: '1', VFC_TEST_CODE: 'f00d42' }, 'f00d42\n').json
  assert.deepEqual(td.allowed_paths, ['src/**'])
  const r1 = s.orch(['--max-tasks', '2'])
  assert.equal(r1.run.tasks_done[0]?.outcome, 'completed', JSON.stringify(r1.iterations[0].selected))
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'GOAL_VERIFIED')
  assert.equal(s.vfc('ugoal', 'status', u.ug_id).approval.decision_id, td.decision_id)
})

test('자동 다음 작업 — 큐가 비면 다음 설계 자동 요청 → Work 응답 → 정책 승인 → 작업 자동 생성 → 구현 완료(사용자 개입 0)', () => {
  const s = setup()
  s.bridgeOn()
  const u = s.goal('NX목표', { summary: 'v1', acceptance: ['기준 0'], preserved_contracts: ['c'], allowed_paths: ['src/**'], db_changes: false })
  // 목표 위임 정책(대화형 대역) + 위임 worktree
  const pol = { goal_id: u.ug_id, allowed_capabilities: ['read', 'plan', 'design_request', 'code_change', 'test', 'review', 'docs'], allowed_code_areas: ['src/**'], excluded_operations: ['db_write', 'schema_change', 'canon_change', 'deploy', 'merge_main', 'external_publish', 'auth_change', 'personal_data'], risk_level: 'MEDIUM', max_runtime_min: 60, max_cost_usd: 10, merge_policy: 'none' }
  const pf = path.join(s.root, 'pol.json')
  fs.writeFileSync(pf, JSON.stringify(pol))
  s.run(VFC, ['approve', '--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf, '--json'], { VFC_TTY_FOR_TESTS: '1', VFC_TEST_CODE: 'aa0001' }, 'aa0001\n')
  const stF = path.join(s.root, 'state', 'USER_GOALS.json')
  const st = JSON.parse(fs.readFileSync(stF, 'utf8'))
  st.goals[u.ug_id].delegations = [{ executor_owner: OWNER, worktree: s.wt, branch: 'feat/t' }]
  st.goals[u.ug_id].next_scope = ['다음 기능 B']
  fs.writeFileSync(stF, JSON.stringify(st))
  // 실행 1: v1 은 Claude 초안(DRAFT) — 정책 자동 승인 대상은 PROPOSED 뿐이라 큐가 비고 → 다음 설계 자동 요청·게시
  const r1 = s.orch(['--max-tasks', '2'])
  assert.ok(s.gh().prs.length === 1, `자동 설계 요청 게시: ${JSON.stringify(r1.iterations.map((i) => i.bridge))}`)
  s.workReplies(1, { acceptance: ['기준 B0'], allowed_paths: ['src/**'] })
  // 실행 2: 수집·인수 → 정책 안 PROPOSED → 자동 승인 → 작업 자동 생성 → 구현·리뷰 완료
  const r2 = s.orch(['--max-tasks', '2'])
  assert.equal(r2.run.tasks_done[0]?.outcome, 'completed', JSON.stringify(r2.iterations.map((i) => [i.bridge, i.selected?.task_id])))
  const g = s.vfc('ugoal', 'status', u.ug_id)
  assert.equal(g.approval.via_policy, true)
  assert.equal(r2.iterations.find((i) => i.goal_level)?.goal_level.level, 'GOAL_VERIFIED', '그 설계의 기준 충족(작업 완료 직후)')
  assert.notEqual(s.vfc('ugoal', 'route', u.ug_id).route, 'DESIGN_CONFLICT', '다음 증분 요청은 충돌이 아니다')
  // 같은 (버전·미충족) 조합으로는 다시 요청하지 않는다 — 완료 뒤에는 미충족이 없어 새 키로 한 번(다음 범위)
  const before = s.gh().prs.length
  s.orch(['--max-tasks', '1'])
  s.orch(['--max-tasks', '1'])
  assert.ok(s.gh().prs.length <= before + 1, '중복 요청 없음')
})

test('Stop 훅 P1 3건 회귀 — 계약 같은 재승인은 완료 유지 · 취소 요청은 in-flight 아님 · 승인 glob 이 구체 경로 포함', () => {
  const s = setup()
  s.bridgeOn()
  // ③ 승인 범위 src/*.ts 안의 구체 경로 작업은 묶인다
  const a = s.goal('GLOB목표', { summary: 'g', acceptance: ['기준 0'], preserved_contracts: ['c'], allowed_paths: ['src/*.ts'], db_changes: false })
  s.approve(a.ug_id, 1)
  const t = s.ugTask(a.ug_id, [0], { allowed_paths: ['src/T-0006.ts'] })
  assert.equal(t.task_id, 'T-0006', 'src/*.ts ⊇ src/T-0006.ts(가짜 Claude 가 바꾸는 파일)')
  // ① 같은 계약의 v2 승인 뒤에도 v1 완료 작업이 기준을 덮는다
  assert.equal(s.orch(['--max-tasks', '1']).run.tasks_done[0]?.outcome, 'completed')
  const stF = path.join(s.root, 'state', 'USER_GOALS.json')
  const st = JSON.parse(fs.readFileSync(stF, 'utf8'))
  const g = st.goals[a.ug_id]
  const v1 = g.designs[0]
  g.designs.push({ ...v1, version: 2, status: 'PROPOSED', summary: '요약만 바뀜', approved_at: undefined })
  fs.writeFileSync(stF, JSON.stringify(st))
  s.approve(a.ug_id, 2)
  assert.equal(s.vfc('ugoal', 'route', a.ug_id).route, 'GOAL_VERIFIED', '요약만 바뀐 재승인이 완료를 지우지 않는다')
  // ② 게시 뒤 취소한 요청은 단일 in-flight 를 점유하지 않는다 — 다음 요청이 게시된다
  const b = s.goal('CXL목표')
  const q1 = s.vfc('ugoal', 'request-design', b.ug_id, '--by', 'claude')
  s.run(path.join(REPO, 'poc', 'work-bridge.mjs'), ['tick', '--repo', XREPO])
  assert.equal(s.gh().prs.length, 1)
  s.vfc('ugoal', 'cancel-request', b.ug_id, q1.request_id, '--reason', '테스트 취소', '--by', 'claude')
  s.vfc('ugoal', 'request-design', b.ug_id, '--by', 'claude')
  const tk = s.run(path.join(REPO, 'poc', 'work-bridge.mjs'), ['tick', '--repo', XREPO]).json
  assert.ok(tk.published, `취소 뒤 새 요청 게시: ${JSON.stringify(tk)}`)
  assert.equal(s.gh().prs.length, 2)
})
