// tests/bridge.test.mjs — Work 브리지 PoC 프로토콜 회귀(WF-S10)
//
// ⚠ GitHub 은 가짜 gh(tests/fakes/fake-gh.mjs), Work 의 댓글은 테스트가 넣는 **모의 응답(SIMULATED)** 이다.
// 이 테스트는 우리 쪽 프로토콜(게시·수집·인수·라우팅·중복·낡은 응답·자동 재개)만 검증한다 — 실제 Work 자동 연동의 근거가 아니다.
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
const BRIDGE = path.join(REPO, 'poc', 'work-bridge.mjs')
const fake = (n) => `node ${path.join(REPO, 'tests', 'fakes', n).replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const CANON = 'VG-L3-A2-01'
const XREPO = 'owner/vocaflow-exchange'

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-br-'))
  const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-gh-'))
  // 제품 저장소 겸 작업 worktree(origin/main 참조 포함 — Context Sync 가 읽는다)
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-brwt-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.mkdirSync(path.join(wt, 'src'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'AGENTS.md'), '# A\n\n## 프로젝트\n\n- 교환 테스트\n\n## 끝\n')
  fs.writeFileSync(path.join(wt, 'src', 'x.ts'), 'export const x = 1\n')
  fs.writeFileSync(path.join(wt, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const env = { ...process.env, VFC_ROOT: root, VFC_PRODUCT_REPO: wt, VFC_GH_CMD: fake('fake-gh.mjs'), FAKE_GH_DIR: ghDir, VFC_CLAUDE_CMD: fake('fake-claude.mjs'), VFC_CODEX_CMD: fake('fake-codex.mjs'), FAKE_STATE_DIR: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir() }
  const run = (bin, args, extra = {}) => {
    const r = spawnSync(process.execPath, [bin, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 240000 })
    return { code: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  }
  const vfc = (...a) => {
    const r = run(VFC, [...a, '--json'])
    assert.equal(r.code, 0, r.err)
    return r.json
  }
  const bridge = (...a) => run(BRIDGE, a)
  vfc('init')
  vfc('owner', 'bind-worktree', OWNER, wt, '--branch', 'feat/t')
  const gh = () => JSON.parse(fs.readFileSync(path.join(ghDir, 'state.json'), 'utf8'))
  /** 모의 Work: PR 의 요청서를 읽고 그 thread 값으로 응답 댓글을 단다 */
  const workReplies = (prNumber, { plan = {}, override = {}, author = 'chatgpt-work[bot]' } = {}) => {
    const st = gh()
    const pr = st.prs.find((p) => p.number === prNumber)
    const id = pr.title.match(/(REQ-\d{8}-(?:[0-9a-f]{8}-)?\d{3})/)[1]
    const md = Buffer.from(st.files[`${pr.headRefName}:requests/${id}.md`], 'base64').toString('utf8')
    const h = JSON.parse(md.match(/```json vfc-request\s*\n([\s\S]*?)\n```/)[1])
    const resp = { schema: 'vfc-response/1', request_id: id, responder: 'chatgpt', responded_at: new Date().toISOString(), canon_version: h.canon_version, verdict: 'revise', summary: 'SIMULATED Work 응답', findings: [], proposed_decisions: [], open_questions: [], thread_id: h.thread.thread_id, goal_ref: h.thread.goal_ref, round_id: h.thread.round_id, design_version: h.thread.design_version, ...(h.thread.context_base_commit ? { context_base_commit: h.thread.context_base_commit } : {}), plan: { goal_fit: 'g', design: 'Work 설계', priority: 'P1 — x', learner_value: 'v', scope: 's', preserved_contracts: ['계약 유지'], acceptance: ['기준 0'], risks: ['r'], allowed_paths: ['src/**'], db_changes: false, ...plan }, ...override }
    pr.comments.push({ author, type: 'Bot', at: new Date().toISOString(), body: `설계입니다.\n\n\`\`\`json vfc-response\n${JSON.stringify(resp, null, 2)}\n\`\`\`\n` })
    fs.writeFileSync(path.join(ghDir, 'state.json'), JSON.stringify(st, null, 2))
    return id
  }
  const designFile = path.join(root, 'd.json')
  fs.writeFileSync(designFile, JSON.stringify({ summary: 's', acceptance: ['기준 0'], preserved_contracts: ['계약 유지'], allowed_paths: ['src/**'], db_changes: false }))
  return { root, wt, vfc, bridge, gh, workReplies, run, designFile, ghDir }
}

test('게시: 요청서 + Context Packet 을 라벨 PR 로 · 같은 요청 재게시 거부', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'br', '--goals', CANON, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  assert.ok(q.context, '설계 요청에 패킷이 붙는다')
  const p = s.bridge('publish', q.request_id, '--repo', XREPO)
  assert.equal(p.code, 0, p.err)
  const st = s.gh()
  assert.equal(st.prs.length, 1)
  assert.match(st.prs[0].title, new RegExp(`^\\[vfc:[0-9a-f]{8}\\] ${q.request_id} ${u.ug_id} ${u.thread_id}-R02 v0`))
  assert.match(st.prs[0].headRefName, /^vfc\/[0-9a-f]{8}\/REQ-/)
  assert.ok(Object.keys(st.files).some((k) => k.endsWith(`requests/${q.request_id}.context/evidence-manifest.json`)), 'Context Packet 업로드')
  assert.ok(!Object.keys(st.files).some((k) => /\.env|verdicts/.test(k)), '패킷 밖 로컬 파일은 올리지 않는다')
  assert.ok(!Object.keys(st.files).some((k) => /active-work-and-conflicts|design-decisions/.test(k)), '승인 범위 밖 패킷 파일(다른 작업·결정 기록)은 내보내지 않는다')
  assert.ok(Object.keys(st.files).some((k) => k.endsWith('.context/existing-features.md')), '코드 발췌는 내보낸다')
  const again = s.bridge('publish', q.request_id, '--repo', XREPO)
  assert.notEqual(again.code, 0)
  assert.match(again.err, /이미 게시/)
})

test('수집 → 인수: 응답 댓글이 설계 v 로 · 중복 수집 차단 · 턴 시간 기록', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'br', '--goals', CANON, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  s.bridge('publish', q.request_id, '--repo', XREPO)
  s.workReplies(1)
  const c = s.bridge('collect', '--repo', XREPO).json
  assert.equal(c.results[0].status, 'collected')
  const i = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user')
  assert.equal(i.results[0].status, 'applied')
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'APPROVAL_REQUIRED', '응답은 승인이 아니다')
  assert.equal(s.bridge('collect', '--repo', XREPO).json.results[0].status, 'already_collected')
  const st = s.bridge('status').json
  assert.equal(st.turns[0].state, 'collected')
  assert.ok(st.turns[0].work_wait_ms >= 0)
})

test('목표 A·B 교차: 다른 목표 thread 를 단 응답은 인수 거부 · 요청 id 불일치는 수집 단계에서 거부', () => {
  const s = setup()
  const a = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'A', '--goals', CANON, '--by', 'claude')
  const b = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'B', '--goals', CANON, '--by', 'claude')
  const qa = s.vfc('ugoal', 'request-design', a.ug_id, '--by', 'claude')
  const qb = s.vfc('ugoal', 'request-design', b.ug_id, '--by', 'claude')
  s.bridge('publish', qa.request_id, '--repo', XREPO)
  s.bridge('publish', qb.request_id, '--repo', XREPO, '--parallel')
  // A 의 PR 에 B 목표 thread 값을 단 응답(Work 가 섞었다)
  s.workReplies(1, { override: { goal_ref: b.ug_id, thread_id: qb.thread.thread_id, round_id: qb.thread.round_id } })
  // B 의 PR 에 A 의 요청 id 로 답한 응답
  s.workReplies(2, { override: { request_id: qa.request_id } })
  const c = s.bridge('collect', '--repo', XREPO).json
  assert.equal(c.results.find((r) => r.pr === 2).status, 'request_id_mismatch')
  const i = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user')
  assert.equal(i.results[0].status, 'rejected')
  assert.match(i.results[0].reason, /다른 목표·라운드의 응답/)
  assert.equal(s.vfc('ugoal', 'status', a.ug_id).designs.length, 0)
  assert.equal(s.vfc('ugoal', 'status', b.ug_id).designs.length, 0)
})

test('다른 설계 버전으로 답한 응답은 거부 — 요청 때 버전과 같아야 적용', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'st', '--goals', CANON, '--design-file', s.designFile, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  s.bridge('publish', q.request_id, '--repo', XREPO)
  // 응답 전에 사용자가 Claude 초안 v1 을 승인했다고 하면 설계 버전 기준이 같아 적용된다 — 대신 새 버전이 생기는 경우를 만든다
  const d = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  s.vfc('ugoal', 'approve', u.ug_id, '--design', '1', '--decision', d.decision_id, '--by', 'user')
  s.workReplies(1, { override: { design_version: 0 } })
  s.bridge('collect', '--repo', XREPO)
  const i = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user')
  assert.equal(i.results[0].status, 'rejected')
  assert.match(i.results[0].reason, /design_version 0 ≠ 요청 1/)
  assert.equal(s.vfc('ugoal', 'status', u.ug_id).designs.length, 1, '거부된 응답은 설계를 더하지 않는다')
})

test('두 턴 연속(모의 Work): 설계 → 승인 → 구현 중 설계 충돌 → 재질의 게시 → 응답 → v2 승인 → 자동 재개 → 완료', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'two-turn', '--goals', CANON, '--by', 'claude')
  // 턴 1
  const q1 = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  s.bridge('publish', q1.request_id, '--repo', XREPO)
  s.workReplies(1)
  s.bridge('collect', '--repo', XREPO)
  s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user')
  const d1 = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  s.vfc('ugoal', 'approve', u.ug_id, '--design', '1', '--decision', d1.decision_id, '--by', 'user')
  const spec = path.join(s.root, 'spec.json')
  fs.writeFileSync(spec, JSON.stringify({ goal_id: CANON, title: 't', description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0'], worktree: s.wt, branch: 'feat/t', design_acceptance: [0] }))
  const t = s.vfc('ugoal', 'task', 'add', u.ug_id, '--file', spec, '--by', OWNER)
  const r1 = s.run(ORCH, ['--no-ci', '--json'], { FAKE_CLAUDE: 'design_issue' }).json
  assert.equal(r1.run.tasks_done[0].outcome, 'waiting_design')
  // 턴 2 — 오케스트레이터가 만든 재질의(패킷 포함)를 게시
  const req2 = s.vfc('ugoal', 'status', u.ug_id).rounds.filter((x) => x.recipient === 'chatgpt').pop().request_id
  const reqText = fs.readFileSync(path.join(s.root, 'planning', 'requests', `${req2}.md`), 'utf8')
  assert.match(reqText, /최신 컨텍스트 패킷/)
  s.bridge('publish', req2, '--repo', XREPO)
  s.workReplies(2)
  s.bridge('collect', '--repo', XREPO)
  const i2 = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user')
  assert.equal(i2.results[0].design_version, 2)
  const d2 = s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v2 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  const a2 = s.vfc('ugoal', 'approve', u.ug_id, '--design', '2', '--decision', d2.decision_id, '--by', 'user')
  assert.deepEqual(a2.resumed, [t.task_id])
  const r2 = s.run(ORCH, ['--no-ci', '--json']).json
  assert.equal(r2.run.tasks_done[0].outcome, 'completed')
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'GOAL_VERIFIED')
  const st = s.bridge('status').json
  assert.equal(st.collected, 2, '두 턴 모두 게시·수집')
})

test('실측 형식: needs_info(plan 비어 있음)·revise(allowed_paths 빈 배열)는 거부하지 않고 라운드를 닫는다 — 설계 버전은 만들지 않는다', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'real-shape', '--goals', CANON, '--by', 'claude')
  const q1 = s.vfc('ugoal', 'request-design', u.ug_id, '--no-context', '--by', 'claude')
  s.bridge('publish', q1.request_id, '--repo', XREPO)
  s.workReplies(1, { override: { verdict: 'needs_info' }, plan: { allowed_paths: [] } })
  s.bridge('collect', '--repo', XREPO)
  const a = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user').results[0]
  assert.equal(a.status, 'applied')
  assert.equal(a.design_version, null)
  const q2 = s.vfc('ugoal', 'request-design', u.ug_id, '--no-context', '--by', 'claude')
  assert.ok(q2.request_id, '라운드가 닫혀 다음 요청이 막히지 않는다')
  s.bridge('publish', q2.request_id, '--repo', XREPO)
  s.workReplies(2, { plan: { allowed_paths: [] } })
  s.bridge('collect', '--repo', XREPO)
  const b = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user').results[0]
  assert.equal(b.status, 'applied')
  assert.equal(b.design_version, null)
  assert.match(b.design_incomplete, /allowed_paths/)
  assert.equal(s.vfc('ugoal', 'status', u.ug_id).designs.length, 0)
  // 다른 형식 오류(acceptance 문자열)는 여전히 거부
  const q3 = s.vfc('ugoal', 'request-design', u.ug_id, '--no-context', '--by', 'claude')
  s.bridge('publish', q3.request_id, '--repo', XREPO)
  s.workReplies(3, { plan: { acceptance: '문자열' } })
  s.bridge('collect', '--repo', XREPO)
  assert.equal(s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user').results[0].status, 'rejected')
})

test('직렬화: 응답 대기 중이면 다른 요청 게시 거부(Work 가 동시 PR 중 하나만 답한 실측) · --retry 는 옛 PR 을 닫고 새 PR 로 다시 트리거', () => {
  const s = setup()
  const a = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'A', '--goals', CANON, '--by', 'claude')
  const b = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'B', '--goals', CANON, '--by', 'claude')
  const qa = s.vfc('ugoal', 'request-design', a.ug_id, '--no-context', '--by', 'claude')
  const qb = s.vfc('ugoal', 'request-design', b.ug_id, '--no-context', '--by', 'claude')
  assert.equal(s.bridge('publish', qa.request_id, '--repo', XREPO).code, 0)
  const blocked = s.bridge('publish', qb.request_id, '--repo', XREPO)
  assert.notEqual(blocked.code, 0)
  assert.match(blocked.err, /응답 대기 중인 요청이 있다/)
  // A 응답이 없으면 --retry 로 다시 트리거: 옛 PR 닫힘 · 새 브랜치 PR
  const r = s.bridge('publish', qa.request_id, '--repo', XREPO, '--retry')
  assert.equal(r.code, 0, r.err)
  const st = s.gh()
  assert.equal(st.prs.length, 2)
  assert.equal(st.prs[0].state, 'closed')
  assert.match(st.prs[1].headRefName, /-r2$/)
  s.workReplies(2)
  s.bridge('collect', '--repo', XREPO)
  assert.equal(s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user').results[0].status, 'applied')
  // 응답을 받은 요청은 재시도 금지 · 이제 B 게시 가능
  assert.notEqual(s.bridge('publish', qa.request_id, '--repo', XREPO, '--retry').code, 0)
  assert.equal(s.bridge('publish', qb.request_id, '--repo', XREPO).code, 0)
})

test('게시 전 검사: 패킷에 비밀값·개인정보가 있으면 게시 거부 · 미리보기는 파일 목록과 실패 사유를 남긴다', () => {
  const s = setup()
  fs.appendFileSync(path.join(s.wt, 'src', 'x.ts'), 'const leak = "owner@vocaflow.kr"\n')
  execFileSync('git', ['-C', s.wt, 'commit', '-qam', 'leak'])
  execFileSync('git', ['-C', s.wt, 'update-ref', 'refs/remotes/origin/main', 'HEAD'])
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'scan', '--goals', CANON, '--design-file', s.designFile, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  const pv = s.bridge('preview', q.request_id).json
  assert.ok(pv.files.length > 1, '요청서 + 패킷 파일 목록')
  assert.ok(pv.findings.some((f) => f.rule === 'email'))
  const p = s.bridge('publish', q.request_id, '--repo', XREPO)
  assert.notEqual(p.code, 0)
  assert.match(p.err, /게시 전 검사 실패/)
  let prs = 0
  try {
    prs = s.gh().prs.length
  } catch {
    prs = 0 // gh 를 한 번도 부르지 않았다
  }
  assert.equal(prs, 0, '검사 실패면 PR 을 만들지 않는다')
})

test('기준 제품 커밋: 패킷 요청에 다른 context_base_commit 으로 답하면 인수 거부', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'base', '--goals', CANON, '--design-file', s.designFile, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  assert.ok(q.thread.context_base_commit)
  s.bridge('publish', q.request_id, '--repo', XREPO)
  s.workReplies(1, { override: { context_base_commit: 'f'.repeat(40) } })
  s.bridge('collect', '--repo', XREPO)
  const r = s.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'user').results[0]
  assert.equal(r.status, 'rejected')
  assert.match(r.reason, /다른 기준 커밋/)
})

test('watch: 응답이 오면 즉시 수집·인수(PROPOSED 설계 · 승인 없음) · 대기 0 이면 종료 · 재실행해도 중복 인수 없음', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'w', '--goals', CANON, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  s.bridge('publish', q.request_id, '--repo', XREPO)
  s.workReplies(1)
  const w = s.bridge('watch', '--repo', XREPO, '--interval', '1', '--timeout-min', '1')
  assert.equal(w.code, 0, w.err)
  assert.deepEqual(w.json.collected, [q.request_id])
  assert.equal(w.json.intake[0].status, 'applied')
  assert.equal(w.json.stop_reason, '대기 요청 없음')
  const st = s.vfc('ugoal', 'status', u.ug_id)
  assert.deepEqual(st.designs.map((d) => d.status), ['PROPOSED'], '자동 승인 없음')
  assert.equal(st.route.route, 'APPROVAL_REQUIRED')
  const again = s.bridge('watch', '--repo', XREPO, '--interval', '1', '--timeout-min', '1')
  assert.deepEqual(again.json.collected, [])
  assert.equal(s.vfc('ugoal', 'status', u.ug_id).designs.length, 1)
})

test('watch: 응답이 없으면 시간 상한으로 끝 · 겹친 실행 거부 · API 연속 오류면 멈춤', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'w2', '--goals', CANON, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  s.bridge('publish', q.request_id, '--repo', XREPO)
  const t = s.bridge('watch', '--repo', XREPO, '--interval', '1', '--timeout-min', '0.05')
  assert.match(t.json.stop_reason, /시간 상한/)
  // 살아 있는 다른 watch 잠금
  const lockF = path.join(s.root, 'planning', 'bridge-watch.lock')
  fs.writeFileSync(lockF, JSON.stringify({ pid: process.pid }))
  const busy = s.bridge('watch', '--repo', XREPO, '--interval', '1', '--timeout-min', '0.05')
  assert.notEqual(busy.code, 0)
  assert.match(busy.err, /다른 watch 가 실행 중/)
  fs.rmSync(lockF)
  const err = s.run(BRIDGE, ['watch', '--repo', XREPO, '--interval', '1', '--timeout-min', '1', '--max-errors', '2'], { FAKE_GH_FAIL: '1' })
  assert.match(err.json.stop_reason, /API 연속 오류 2/)
})

test('패킷을 요청 뒤에 다시 만들면 게시 거부(첨부 해시 불일치) → cancel-request 후 새 요청으로 게시', () => {
  const s = setup()
  const u = s.vfc('ugoal', 'start', '--from', 'claude', '--title', 'stale', '--goals', CANON, '--design-file', s.designFile, '--by', 'claude')
  const q = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  fs.appendFileSync(path.join(q.context.dir, 'goal-brief.md'), '\n변경\n')
  const p = s.bridge('publish', q.request_id, '--repo', XREPO)
  assert.notEqual(p.code, 0)
  assert.match(p.err, /첨부가 요청 기록과 다르다/)
  s.vfc('ugoal', 'cancel-request', u.ug_id, q.request_id, '--reason', '패킷 재생성', '--by', 'claude')
  fs.rmSync(path.join(q.context.dir, 'evidence-manifest.json'))
  const q2 = s.vfc('ugoal', 'request-design', u.ug_id, '--by', 'claude')
  assert.notEqual(q2.request_id, q.request_id)
  assert.equal(s.bridge('publish', q2.request_id, '--repo', XREPO).code, 0)
  assert.equal(s.vfc('ugoal', 'status', u.ug_id).rounds.find((r) => r.request_id === q.request_id && r.recipient === 'chatgpt').response_status, 'CANCELLED')
})

test('인스턴스 이름공간: 두 AI-Control 이 한 교환 저장소를 쓰고 요청 id 가 같아도 각자 자기 응답만 수집', () => {
  const a = setup()
  const b = setup()
  // b 가 a 와 같은 가짜 GitHub 을 쓰게 한다
  const shared = (s, other) => (args, extra = {}) => s.run(BRIDGE, args, { FAKE_GH_DIR: other, ...extra })
  const ua = a.vfc('ugoal', 'start', '--from', 'claude', '--title', 'A', '--goals', CANON, '--by', 'claude')
  const ub = b.vfc('ugoal', 'start', '--from', 'claude', '--title', 'B', '--goals', CANON, '--by', 'claude')
  const qa = a.vfc('ugoal', 'request-design', ua.ug_id, '--no-context', '--by', 'claude')
  const qb = b.vfc('ugoal', 'request-design', ub.ug_id, '--no-context', '--by', 'claude')
  // 요청 id 에 인스턴스 이름공간이 들어가 두 인스턴스의 첫 요청도 서로 다르다(Work 가 지적한 id 충돌 재발 방지)
  assert.notEqual(qa.request_id, qb.request_id)
  const strip = (id) => id.replace(/-[0-9a-f]{8}-(\d{3})$/, '-$1')
  assert.equal(strip(qa.request_id), strip(qb.request_id), '이름공간을 빼면 같은 번호(전제)')
  assert.equal(a.bridge('publish', qa.request_id, '--repo', XREPO).code, 0)
  const pubB = shared(b, a.ghDir)(['publish', qb.request_id, '--repo', XREPO])
  assert.equal(pubB.code, 0, pubB.err)
  const st = a.gh()
  assert.equal(st.prs.length, 2)
  assert.notEqual(st.prs[0].headRefName, st.prs[1].headRefName, '브랜치가 겹치지 않는다')
  a.workReplies(1)
  a.workReplies(2)
  const ca = a.bridge('collect', '--repo', XREPO).json.results.filter((r) => r.status === 'collected')
  const cb = shared(b, a.ghDir)(['collect', '--repo', XREPO]).json.results.filter((r) => r.status === 'collected')
  assert.deepEqual(ca.map((r) => r.pr), [1])
  assert.deepEqual(cb.map((r) => r.pr), [2])
  assert.equal(a.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'u').results[0].status, 'applied')
  assert.equal(b.vfc('ugoal', 'intake', '--min-age-ms', '0', '--by', 'u').results[0].status, 'applied')
})
