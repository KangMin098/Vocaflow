// tests/context.test.mjs — Context Sync(WF-S9) · 성능 측정 회귀
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { measureRuns } from '../lib/perf.mjs'
import { limitsFor } from '../lib/usergoals.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const CANON = 'VG-L3-A2-01'

/** 가짜 제품 저장소: origin/main 참조까지 만든다 */
function product() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-prod-'))
  const g = (...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.mkdirSync(path.join(d, 'src', 'lib', '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# A\n\n## 프로젝트\n\n- 테스트 플랫폼 요약\n\n## 다음\n')
  fs.writeFileSync(path.join(d, 'src', 'lib', 'feature.ts'), '// src/lib/feature.ts\nexport const apiKey = "sk-abcdefghijklmnopqrstuvwxyz123456"\nconst password = "hunter22222"\nexport function f() { return 1 }\n')
  fs.writeFileSync(path.join(d, 'src', 'lib', '__tests__', 'feature.test.ts'), 'test("f", () => {})\n')
  fs.writeFileSync(path.join(d, 'src', 'lib', '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY=should-never-appear\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  return { d, g }
}
function vfc(root, prod, args) {
  const r = spawnSync(process.execPath, [VFC, ...args, '--json'], { env: { ...process.env, VFC_ROOT: root, VFC_PRODUCT_REPO: prod }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}
function goal(root, prod) {
  vfc(root, prod, ['init'])
  const f = path.join(root, 'd.json')
  fs.writeFileSync(f, JSON.stringify({ summary: 's', acceptance: ['f 가 1 을 돌려준다', '새 기능'], allowed_paths: ['src/lib/**'], db_changes: false }))
  return vfc(root, prod, ['ugoal', 'start', '--from', 'claude', '--title', 'ctx', '--goals', CANON, '--design-file', f, '--by', 'claude'])
}

test('패킷: main 커밋·출처 등급·관련 테스트 · 비밀 경로 제외 · 키 모양 문자열 가림', () => {
  const { d } = product()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const g = goal(root, d)
  const c = vfc(root, d, ['ugoal', 'context', g.ug_id])
  assert.equal(c.cached, false)
  const dir = c.dir
  const all = c.files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  assert.doesNotMatch(all, /should-never-appear|\.env\.local/, '비밀 경로는 읽지도 나열하지도 않는다')
  assert.doesNotMatch(all, /sk-abcdefghijklmnop|hunter22222/, '키·비밀번호 모양은 가린다')
  assert.match(all, /\[REDACTED\]/)
  assert.match(fs.readFileSync(path.join(dir, 'existing-features.md'), 'utf8'), /feature\.test\.ts/)
  assert.match(fs.readFileSync(path.join(dir, 'platform-summary.md'), 'utf8'), /테스트 플랫폼 요약/)
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'evidence-manifest.json'), 'utf8'))
  assert.match(m.base_commit, /^[0-9a-f]{40}$/)
  assert.ok(m.generated_at && m.cache_key && m.classes['unverified-assumptions.md'] === 'unverified')
  assert.match(fs.readFileSync(path.join(dir, 'unverified-assumptions.md'), 'utf8'), /\[0\] f 가 1 을 돌려준다 — 아직 통과 증거 없음/)
})

test('캐시: 같은 main 이면 재사용 · main 이 움직이면 새로 만든다', () => {
  const { d, g } = product()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u = goal(root, d)
  const a = vfc(root, d, ['ugoal', 'context', u.ug_id])
  const b = vfc(root, d, ['ugoal', 'context', u.ug_id])
  assert.equal(b.cached, true)
  fs.appendFileSync(path.join(d, 'src', 'lib', 'feature.ts'), 'export const g = 2\n')
  g('commit', '-qam', 'change')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const c = vfc(root, d, ['ugoal', 'context', u.ug_id])
  assert.equal(c.cached, false)
  assert.notEqual(c.base_commit, a.base_commit)
})

test('설계 요청은 패킷을 자동 첨부하고 thread 에 컨텍스트 커밋을 남긴다 · 패킷 실패는 요청을 막지 않는다', () => {
  const { d } = product()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u = goal(root, d)
  const r = vfc(root, d, ['ugoal', 'request-design', u.ug_id, '--by', 'claude'])
  assert.ok(r.context && r.context.files.includes('evidence-manifest.json'))
  assert.equal(r.thread.context_base_commit, r.context.base_commit)
  const text = fs.readFileSync(r.file, 'utf8')
  assert.match(text, /최신 컨텍스트 패킷/)
  assert.match(text, /goal-brief\.md/)
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u2 = goal(root2, d)
  const r2 = vfc(root2, path.join(root2, 'not-a-repo'), ['ugoal', 'request-design', u2.ug_id, '--by', 'claude'])
  assert.equal(r2.context, null)
  assert.ok(r2.context_error)
  assert.match(fs.readFileSync(r2.file, 'utf8'), /컨텍스트 패킷 없음/)
})

test('응답 인수 뒤 새 설계를 main 코드와 대조 — 없는 경로는 승인 대기 사유에 표시', () => {
  const { d } = product()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u = goal(root, d)
  const q = vfc(root, d, ['ugoal', 'request-design', u.ug_id, '--by', 'claude'])
  const h = JSON.parse(fs.readFileSync(q.file, 'utf8').match(/```json vfc-request\s*\n([\s\S]*?)\n```/)[1])
  const resp = { schema: 'vfc-response/1', request_id: q.request_id, responder: 'chatgpt', responded_at: new Date().toISOString(), canon_version: h.canon_version, verdict: 'revise', summary: 's', findings: [], proposed_decisions: [], open_questions: [], thread_id: h.thread.thread_id, goal_ref: h.thread.goal_ref, round_id: h.thread.round_id, design_version: h.thread.design_version, context_base_commit: h.thread.context_base_commit, plan: { goal_fit: 'g', design: 'd', priority: 'P1 — x', learner_value: 'v', scope: 's', preserved_contracts: ['c'], acceptance: ['a'], risks: ['r'], allowed_paths: ['src/lib/new.ts', 'apps/nowhere/x.ts'], db_changes: false } }
  fs.writeFileSync(path.join(root, 'planning', 'responses', `${q.request_id}.response.md`), `\`\`\`json vfc-response\n${JSON.stringify(resp)}\n\`\`\`\n`)
  const r = vfc(root, d, ['ugoal', 'intake', '--min-age-ms', '0', '--by', 'user'])
  const cc = r.results[0].code_check
  assert.deepEqual(cc.missing.map((m) => m.path), ['apps/nowhere/x.ts'])
  assert.deepEqual(cc.new_files.map((m) => m.path), ['src/lib/new.ts'])
  const rt = vfc(root, d, ['ugoal', 'route', u.ug_id])
  assert.equal(rt.route, 'APPROVAL_REQUIRED')
  assert.match(rt.reason, /main 에 없는 경로 apps\/nowhere\/x\.ts/)
})

test('세션 매핑: chat_surface·chat_url 은 참조용(검증된 URL 만) · 프로필이 Codex 리뷰 강도를 정한다', () => {
  const { d } = product()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u = goal(root, d)
  const l = vfc(root, d, ['ugoal', 'link', u.ug_id, '--surface', 'work', '--url', 'https://chatgpt.com/c/abc', '--by', 'user'])
  assert.equal(l.chat_surface, 'work')
  const bad = spawnSync(process.execPath, [VFC, 'ugoal', 'link', u.ug_id, '--surface', 'work', '--url', 'https://evil.example/x', '--by', 'user'], { env: { ...process.env, VFC_ROOT: root }, encoding: 'utf8' })
  assert.notEqual(bad.status, 0)
  assert.equal(vfc(root, d, ['ugoal', 'status', u.ug_id]).chat_url, 'https://chatgpt.com/c/abc')
  const base = { max_review_rounds: 3, claude_budget_usd: 5 }
  const st = (profile) => ({ userGoals: { goals: { U: { profile } } } })
  assert.equal(limitsFor(st('BALANCED'), { user_goal_id: 'U' }, base).codex_effort, 'medium')
  assert.equal(limitsFor(st('CRITICAL'), { user_goal_id: 'U' }, base).codex_effort, 'high')
  assert.equal(limitsFor(st('CRITICAL'), {}, base).codex_effort, undefined, '플랫폼 작업은 기존(high) 그대로')
})

test('perf: 단계 사이 시간을 단계별로 합산하고 작업별 구현·리뷰 시간을 낸다', () => {
  const t = (s) => new Date(Date.UTC(2026, 9, 9, 0, 0, s)).toISOString()
  const m = measureRuns({ runs: { R1: { run_id: 'R1', cost_usd: 1, tasks_done: [{ task_id: 'T-1', outcome: 'completed' }], events: [{ at: t(0), phase: 'goal_check' }, { at: t(10), phase: 'select' }, { at: t(11), phase: 'implement', task_id: 'T-1' }, { at: t(71), phase: 'implement_done', task_id: 'T-1' }, { at: t(72), phase: 'review', task_id: 'T-1' }, { at: t(102), phase: 'review_done' }] } } })
  assert.equal(m.wall_ms, 102000)
  assert.equal(m.by_phase.implement.ms, 60000)
  assert.equal(m.by_phase.review.ms, 30000)
  assert.equal(m.per_task['T-1'].implement_ms, 60000)
  assert.equal(m.completed_tasks, 1)
})

test('r1: JSON·환경변수형 비밀값 가림 · DB 덤프 제외 · 중첩 glob · 캐시 파일 누락 시 재생성 · 캐시도 manifest 첨부', () => {
  const { d, g } = product()
  fs.mkdirSync(path.join(d, 'src', 'lib', 'n1', 'n2'), { recursive: true })
  fs.writeFileSync(path.join(d, 'src', 'lib', 'n1', 'n2', 'deep.ts'), '// deep\nconst cfg = {"password":"hunter2x"}\nSUPABASE_SERVICE_ROLE_KEY=eyabcdef1234\n')
  fs.writeFileSync(path.join(d, 'src', 'lib', 'users.sql'), "INSERT INTO users VALUES ('kim@example.com');\n")
  g('add', '.')
  g('commit', '-qm', 'more')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ctx-'))
  const u = goal(root, d)
  const c = vfc(root, d, ['ugoal', 'context', u.ug_id])
  const all = c.files.map((f) => fs.readFileSync(path.join(c.dir, f), 'utf8')).join('\n')
  assert.match(all, /n1\/n2\/deep\.ts/, 'src/lib/** 는 중첩 파일까지')
  assert.doesNotMatch(all, /hunter2x|eyabcdef1234|kim@example\.com/)
  assert.doesNotMatch(fs.readFileSync(path.join(c.dir, 'existing-features.md'), 'utf8'), /users\.sql/)
  const m = JSON.parse(fs.readFileSync(path.join(c.dir, 'evidence-manifest.json'), 'utf8'))
  assert.ok(m.excluded.data_paths.includes('src/lib/users.sql'))
  assert.equal(m.excluded.secret_paths, 1)
  assert.ok(m.source_files.some((f) => f.path === 'AGENTS.md'))
  fs.rmSync(path.join(c.dir, 'goal-brief.md'))
  const again = vfc(root, d, ['ugoal', 'context', u.ug_id])
  assert.equal(again.cached, false, '파일이 빠진 캐시는 다시 만든다')
  const hit = vfc(root, d, ['ugoal', 'context', u.ug_id])
  assert.equal(hit.cached, true)
  assert.ok(hit.files.includes('evidence-manifest.json'))
})

test('패킷 기준: 위임 작업 브랜치가 원격에 있으면 그 브랜치 · 없거나 실패하면 origin/main', async () => {
  const { contextRefFor } = await import('../lib/context.mjs')
  const st = (dl) => ({ userGoals: { goals: { 'UG-x-1': { delegations: dl } } } })
  const calls = []
  const ok = (...a) => { calls.push(a.join(' ')); return 'abc' }
  assert.equal(contextRefFor(st([{ branch: 'feat/w' }]), 'UG-x-1', ok), 'origin/feat/w')
  assert.ok(calls.some((c) => c.startsWith('fetch')), '브랜치를 먼저 받아 온다')
  const bad = () => { throw new Error('no such ref') }
  assert.equal(contextRefFor(st([{ branch: 'feat/none' }]), 'UG-x-1', bad), 'origin/main')
  assert.equal(contextRefFor(st([]), 'UG-x-1', ok), 'origin/main')
})
