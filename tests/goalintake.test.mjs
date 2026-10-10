// tests/goalintake.test.mjs — ChatGPT 자연어 목표 요청 → 기존 목표 재사용 / 새 목표 + 첫 설계 요청 / 정본 없으면 보류
//
// ⚠ GitHub 은 가짜 gh, 이슈 댓글(=Work 가 남기는 요청)은 테스트가 넣는 **모의(SIMULATED)** 다 — 실제 ChatGPT 쪽 연동의 근거가 아니다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseGoalRequest, matchExisting, intakeGoalRequest, jaccard } from '../lib/goalintake.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const BRIDGE = path.join(REPO, 'poc', 'work-bridge.mjs')
const fake = (n) => `node ${path.join(REPO, 'tests', 'fakes', n).replace(/\\/g, '/')}`
const CANON = 'VG-L3-A2-01'
const XREPO = 'owner/vocaflow-exchange'
const APP = 'chatgpt-codex-connector'
const block = (o) => `요청을 등록합니다.\n\n\`\`\`json vfc-goal-request\n${JSON.stringify({ schema: 'vfc-goal-request/1', ...o }, null, 2)}\n\`\`\`\n`

test('판정 규칙: 블록 형식 · goal_ref → chat_url → 제목 겹침 재사용 · 정본 없으면 needs_canon · 같은 출처 한 번만', () => {
  assert.match(parseGoalRequest('없음').error, /정확히 1개/)
  assert.match(parseGoalRequest(block({ request: '짧음' })).error, /10자/)
  assert.match(parseGoalRequest(block({ request: '충분히 긴 자연어 요청입니다', chat_url: 'https://evil.example/x' })).error, /chat_url/)
  const g1 = { ug_id: 'UG-1', thread_id: 'TH-1', title: '학습 지도 학년별 권장 참고 개선', status: 'OPEN', chat_url: 'https://chatgpt.com/c/map', history: [] }
  const state = { userGoals: { goals: { 'UG-1': g1 } }, ownership: { owners: { map: {} } } }
  assert.equal(matchExisting(state, { goal_ref: 'TH-1', request: 'x' }).goal.ug_id, 'UG-1')
  assert.match(matchExisting(state, { chat_url: 'https://chatgpt.com/c/map', request: '아무 말' }).reason, /chat_url/)
  assert.ok(jaccard('학습 지도 학년별 권장 참고 겹침 고치기', g1.title) >= 0.5)
  assert.equal(matchExisting(state, { request: '단어장 내보내기 기능을 새로 만들어 주세요' }), null)
  const deps = { newGoal: (st, a) => (st.userGoals.goals['UG-2'] = { ug_id: 'UG-2', title: a.title, status: 'OPEN', history: [] }) }
  const r1 = intakeGoalRequest(state, { request: '학습 지도 학년별 권장 참고 블록이 듣기 줄과 겹치는 것을 고쳐 주세요', title: '학습 지도 학년별 권장 참고 겹침', chat_url: 'https://chatgpt.com/c/other' }, { source: 's1', by: 't', deps })
  assert.equal(r1.outcome, 'reused')
  assert.match(g1.next_scope.at(-1), /^\[ChatGPT 요청 .*듣기 줄과 겹치는/)
  assert.equal(g1.chat_url, 'https://chatgpt.com/c/map', '대표 Work 대화는 바꾸지 않는다(충돌은 기록)')
  assert.equal(state.userGoals.goal_requests.at(-1).chat_url_conflict.got, 'https://chatgpt.com/c/other')
  assert.equal(intakeGoalRequest(state, { request: '학습 지도 학년별 권장 참고 블록이 듣기 줄과 겹치는 것을 고쳐 주세요' }, { source: 's1', by: 't', deps }).outcome, 'duplicate_source')
  assert.equal(intakeGoalRequest(state, { request: '단어장 내보내기 기능을 새로 만들어 주세요' }, { source: 's2', by: 't', deps }).outcome, 'needs_canon')
  const c = intakeGoalRequest(state, { request: '단어장 내보내기 기능을 새로 만들어 주세요', canon_goal_ids: [CANON], owner_hint: 'map', chat_url: 'https://chatgpt.com/c/new' }, { source: 's3', by: 't', deps })
  assert.equal(c.outcome, 'created')
  assert.equal(state.userGoals.goals['UG-2'].proposed_owner, 'map', 'owner 는 제안만')
  assert.equal(state.userGoals.goals['UG-2'].chat_url, 'https://chatgpt.com/c/new')
})

test('브리지 종단(모의 Work): 이슈 댓글 수집 → 재사용·신규(+첫 설계 요청)·보류 → 재실행 안전 → 다른 앱 댓글 무시 → 매핑에 URL·막힌 것', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-gi-'))
  const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-gigh-'))
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-giwt-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.writeFileSync(path.join(wt, 'AGENTS.md'), '# A\n\n## 프로젝트\n\n- x\n\n## 끝\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const env = { ...process.env, VFC_ROOT: root, VFC_PRODUCT_REPO: wt, VFC_GH_CMD: fake('fake-gh.mjs'), FAKE_GH_DIR: ghDir, VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir() }
  const run = (bin, args) => {
    const r = spawnSync(process.execPath, [bin, ...args], { env, encoding: 'utf8', timeout: 240000 })
    return { code: r.status, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  }
  assert.equal(run(VFC, ['init', '--json']).code, 0)
  const ex = run(VFC, ['ugoal', 'start', '--from', 'claude', '--title', '학습 지도 학년별 권장 참고 개선', '--goals', CANON, '--by', 'claude', '--json']).json
  const now = new Date().toISOString()
  fs.writeFileSync(path.join(ghDir, 'state.json'), JSON.stringify({ default_branch: 'main', refs: { main: 'a'.repeat(40) }, files: {}, prs: [], labels: [], calls: [], issues: [{ number: 1, title: '목표 요청', labels: ['vfc-goal'], author: 'kangmin', body: '여기에 목표를 남긴다', createdAt: now, comments: [
    { author: 'kangmin', app: APP, at: now, body: block({ request: '학습 지도 학년별 권장 참고 블록이 듣기 줄과 겹치는 것을 고쳐 주세요', title: '학습 지도 학년별 권장 참고 겹침', chat_url: 'https://chatgpt.com/c/map-1' }) },
    { author: 'kangmin', app: APP, at: now, body: block({ request: '학생이 모르는 단어를 단어장으로 내보내는 기능을 만들어 주세요', title: '단어장 내보내기', canon_goal_ids: [CANON], chat_url: 'https://chatgpt.com/c/words-1' }) },
    { author: 'kangmin', app: APP, at: now, body: block({ request: '전혀 다른 새 기능인데 정본 목표를 모르겠어요' }) },
    { author: 'someone', app: 'other-app', at: now, body: block({ request: '다른 앱이 남긴 요청 — 무시돼야 한다', canon_goal_ids: [CANON] }) },
  ] }] }))
  const t1 = run(BRIDGE, ['tick', '--repo', XREPO, '--app', APP]).json
  assert.equal(t1.goal_requests.length, 3, JSON.stringify(t1))
  const outcomes = Object.fromEntries(t1.goal_intake.map((r) => [r.outcome, r]))
  assert.equal(outcomes.reused.goal_id, ex.ug_id, '기존 목표 재사용')
  assert.ok(outcomes.created.goal_id && outcomes.created.goal_id !== ex.ug_id)
  assert.match(outcomes.created.design_request, /^REQ-/, '새 목표는 첫 설계를 Work 에 요청')
  assert.ok(outcomes.needs_canon)
  // 재실행 — 같은 댓글을 다시 가져오지 않는다
  const t2 = run(BRIDGE, ['tick', '--repo', XREPO, '--app', APP]).json
  assert.deepEqual(t2.goal_requests, [])
  // 매핑: 새 목표의 Work URL · 막힌 것(Work 첫 설계 응답 대기)
  const map = run(VFC, ['ugoal', 'map', '--json']).json
  const created = map.find((r) => r.goal_id === outcomes.created.goal_id)
  assert.equal(created.work_chat_url, 'https://chatgpt.com/c/words-1')
  assert.match(created.blocker, /^WORK:|^USER:/)
  assert.equal(map.find((r) => r.goal_id === ex.ug_id).work_chat_url, 'https://chatgpt.com/c/map-1')
})

test('잘못된 정본 id 요청은 거절(상태 무변경) · 이슈 본문의 견본 블록은 요청이 아니다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-gi2-'))
  const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-gi2gh-'))
  const env = { ...process.env, VFC_ROOT: root, VFC_GH_CMD: fake('fake-gh.mjs'), FAKE_GH_DIR: ghDir, VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir() }
  const run = (bin, args) => {
    const r = spawnSync(process.execPath, [bin, ...args], { env, encoding: 'utf8', timeout: 240000 })
    return { code: r.status, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  }
  run(VFC, ['init', '--json'])
  const now = new Date().toISOString()
  fs.writeFileSync(path.join(ghDir, 'state.json'), JSON.stringify({ default_branch: 'main', refs: {}, files: {}, prs: [], labels: [], calls: [], issues: [{ number: 24, title: '접수함', labels: ['vfc-goal'], author: 'kangmin', createdAt: now, body: block({ request: '사용자가 말한 목표 원문', canon_goal_ids: ['VG-L3-…'] }), comments: [{ author: 'kangmin', app: APP, at: now, body: block({ request: '정본에 없는 목표 id 로 새 목표를 요청한다', canon_goal_ids: ['VG-L3-ZZ-99'] }) }] }] }))
  const t = run(BRIDGE, ['tick', '--repo', XREPO, '--app', APP]).json
  assert.equal(t.goal_requests.length, 1, '본문 견본은 제외 · 댓글 1건만')
  assert.equal(t.goal_intake[0].outcome, 'rejected')
  assert.match(t.goal_intake[0].reason, /NO_GOAL/)
  assert.equal(run(VFC, ['ugoal', 'list', '--json']).json.goals.length, 0, '정본에 없는 id 로는 목표가 생기지 않는다')
})
