// tests/policy.test.mjs — 목표 단위 실행 정책 · 위험 분류 · 읽기 전용 live 검증
//
// ⚠ Claude·Codex·GitHub·vitest 는 가짜(tests/fakes). 승인 결정은 대화형 터미널 대역(VFC_TTY_FOR_TESTS · 임시 폴더에서만 유효).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pathRisk, classifyRisk, validatePolicy, policyCovers, policySha } from '../lib/policy.mjs'
import { preflight, runLive, importClosure } from '../lib/liveverify.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const ORCH = path.join(REPO, 'bin', 'goal-orchestrator.mjs')
const fake = (n) => `node ${path.join(REPO, 'tests', 'fakes', n).replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const CANON = 'VG-L3-A2-01'

const basePolicy = (over = {}) => ({
  goal_id: 'UG-x-0001',
  allowed_capabilities: ['read', 'plan', 'design_request', 'code_change', 'test', 'review', 'docs'],
  allowed_code_areas: ['src/**'],
  excluded_operations: ['db_write', 'schema_change', 'canon_change', 'deploy', 'merge_main', 'external_publish', 'auth_change', 'personal_data'],
  risk_level: 'MEDIUM',
  max_runtime_min: 60,
  max_cost_usd: 10,
  merge_policy: 'none',
  ...over,
})

test('위험 분류: 낮게 잘못 분류해 승인을 우회하지 못한다(HIGH 우선 · 모르면 높게)', () => {
  const high = ['supabase/migrations/1.sql', 'apps/web/src/lib/csat/map/__tests__/seed.sql', 'apps/web/.env.local', 'apps/web/src/lib/supabase/admin.ts', 'apps/web/src/middleware.ts', 'docs/csat-learner/LEARNING_MAP_VNEXT.md', 'goals/GOAL_ACCEPTANCE_CRITERIA.json', '.github/workflows/ci.yml', 'package.json', 'scripts/db/seed.mjs', 'apps/web/src/app/auth/callback/route.ts', 'docs/__tests__/x.sql']
  for (const p of high) assert.equal(pathRisk(p), 'HIGH', p)
  assert.equal(pathRisk('apps/web/src/lib/csat/map/load.ts'), 'MEDIUM')
  assert.equal(pathRisk('apps/web/src/components/csat/diagnosis/map/StepSheet.tsx'), 'MEDIUM')
  assert.equal(pathRisk('apps/web/src/lib/csat/map/__tests__/x.test.ts'), 'LOW')
  assert.equal(classifyRisk({ paths: [] }).level, 'HIGH', '경로 없음 = 범위 불명 = HIGH')
  assert.equal(classifyRisk({ paths: ['src/a.test.ts'], db_scope: { mode: 'write' } }).level, 'HIGH')
  assert.equal(classifyRisk({ paths: ['docs/a.md'], operations: ['merge_main'] }).level, 'HIGH')
  assert.equal(classifyRisk({ paths: ['docs/a.md'], db_scope: { mode: 'read' } }).level, 'MEDIUM')
})

test('정책 검사: HIGH 위임 불가 · 너무 넓은 영역 거부 · 범위 밖/위험 초과/능력 없음은 그 변경만 보류', () => {
  assert.deepEqual(validatePolicy(basePolicy()), [])
  assert.ok(validatePolicy(basePolicy({ risk_level: 'HIGH' })).some((e) => /HIGH/.test(e)))
  assert.ok(validatePolicy(basePolicy({ allowed_code_areas: ['apps/**'] })).some((e) => /넓다/.test(e)))
  assert.ok(validatePolicy(basePolicy({ allowed_code_areas: ['supabase/**'] })).some((e) => /HIGH/.test(e)))
  assert.ok(validatePolicy(basePolicy({ excluded_operations: ['db_write'] })).some((e) => /merge_main/.test(e)))
  const p = basePolicy()
  assert.equal(policyCovers(p, { paths: ['src/a.ts', 'src/__tests__/a.test.ts'] }).ok, true, '경로가 바뀌어도 같은 영역·위험이면 자동')
  assert.match(policyCovers(p, { paths: ['lib/x.ts'] }).why.join(), /영역 밖/)
  assert.match(policyCovers(p, { paths: ['src/a.ts'], db_changes: true }).why.join(), /HIGH/)
  assert.match(policyCovers(basePolicy({ risk_level: 'LOW' }), { paths: ['src/a.ts'] }).why.join(), /정책 상한 LOW/)
  assert.match(policyCovers(p, { paths: ['src/a.ts'], db_scope: { mode: 'read' } }).why.join(), /db_read_dev/)
})

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-pol-'))
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-polwt-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.mkdirSync(path.join(wt, 'src'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'AGENTS.md'), '# A\n')
  fs.writeFileSync(path.join(wt, 'src', 'x.ts'), 'export const x = 1\n')
  fs.writeFileSync(path.join(wt, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  g('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const env = { ...process.env, VFC_ROOT: root, VFC_PRODUCT_REPO: wt, VFC_CLAUDE_CMD: fake('fake-claude.mjs'), VFC_CODEX_CMD: fake('fake-codex.mjs'), FAKE_STATE_DIR: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir(), CLAUDECODE: '', VFC_AGENT: '' }
  const run = (bin, args, extra = {}, input) => {
    const r = spawnSync(process.execPath, [bin, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 240000, input })
    return { code: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  }
  const vfc = (...a) => {
    const r = run(VFC, [...a, '--json'])
    assert.equal(r.code, 0, r.err)
    return r.json
  }
  vfc('init')
  vfc('owner', 'bind-worktree', OWNER, wt, '--branch', 'feat/t')
  const tty = (args, code = 'abc123') => run(VFC, ['approve', ...args, '--json'], { VFC_TTY_FOR_TESTS: '1', VFC_TEST_CODE: code }, `${code}\n`)
  // DEEP 아닌 목표 + Work 설계(PROPOSED) 흉내: chatgpt 시작 파일
  const goal = (design) => {
    const f = path.join(root, `g-${Math.random().toString(16).slice(2, 6)}.md`)
    fs.writeFileSync(f, `\`\`\`json vfc-goal\n${JSON.stringify({ schema: 'vfc-goal/1', title: '정책 목표', canon_goal_ids: [CANON], profile: 'BALANCED', design })}\n\`\`\`\n`)
    return vfc('ugoal', 'start', '--from', 'chatgpt', '--file', f, '--by', 'user')
  }
  const draft = (ug, idx, over = {}) => {
    const f = path.join(root, `t-${Math.random().toString(16).slice(2, 6)}.json`)
    fs.writeFileSync(f, JSON.stringify({ goal_id: CANON, title: `작업 ${idx}`, description: 'd', priority: 'P1', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건'], worktree: wt, branch: 'feat/t', design_acceptance: idx, ...over }))
    return vfc('ugoal', 'task', 'add', ug, '--file', f, '--by', OWNER)
  }
  return { root, wt, vfc, run, tty, goal, draft }
}

const design = (over = {}) => ({ summary: 's', acceptance: ['기준 0', '기준 1'], preserved_contracts: ['c'], allowed_paths: ['src/**'], db_changes: false, ...over })

test('목표 위임 한 번 → 정책 안의 PROPOSED 설계 자동 승인 · 초안이 작업으로 · 연속 실행(버전별 승인 없음)', () => {
  const s = setup()
  const u = s.goal(design())
  s.draft(u.ug_id, [0])
  s.draft(u.ug_id, [1])
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id })))
  // 비대화형으로는 위임할 수 없다
  assert.match(s.run(VFC, ['approve', '--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf]).err, /TRUST_REQUIRED/)
  const d = s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf]).json
  assert.equal(d.policy_sha256, policySha(JSON.parse(fs.readFileSync(pf, 'utf8'))))
  const r = s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '3']).json
  assert.equal(r.run.tasks_done.filter((x) => x.outcome === 'completed').length, 2, JSON.stringify(r.iterations[0]))
  const st = s.vfc('ugoal', 'status', u.ug_id)
  assert.equal(st.approval.via_policy, true)
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'GOAL_VERIFIED')
})

test('정책 밖 설계(HIGH·영역 밖)는 자동 승인하지 않고 그 목표만 승인 대기 · 정책 파일 변조(sha 불일치)는 무시', () => {
  const s = setup()
  const u = s.goal(design({ db_changes: true }))
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id })))
  s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf])
  s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '1'])
  assert.equal(s.vfc('ugoal', 'route', u.ug_id).route, 'APPROVAL_REQUIRED', 'DB 변경 설계는 정책으로 승인되지 않는다')
  // 결정에 실린 정책을 사후에 넓혀도(파일·상태 변조) sha 가 달라 적용되지 않는다
  const v = s.goal(design())
  const pf2 = path.join(s.root, 'policy2.json')
  fs.writeFileSync(pf2, JSON.stringify(basePolicy({ goal_id: v.ug_id, allowed_code_areas: ['lib/**'] })))
  const d2 = s.tty(['--kind', 'goal_delegation', '--summary', `${v.ug_id}@policy`, '--policy-file', pf2], 'def456').json
  const logF = path.join(s.root, 'state', 'DECISION_LOG.json')
  const log = JSON.parse(fs.readFileSync(logF, 'utf8'))
  log.entries.find((e) => e.decision_id === d2.decision_id).policy.allowed_code_areas = ['src/**']
  fs.writeFileSync(logF, JSON.stringify(log))
  s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '1'])
  assert.equal(s.vfc('ugoal', 'status', v.ug_id).execution_policy, undefined, '변조된 정책은 장착되지 않는다')
})

test('정책 작업 게이트: 승인된 설계 안이라도 작업이 HIGH 경로면 그 작업만 보류', () => {
  const s = setup()
  const u = s.goal(design({ allowed_paths: ['src/**', 'src/db/x.sql'] }))
  s.draft(u.ug_id, [0], { allowed_paths: ['src/db/x.sql'] })
  s.draft(u.ug_id, [1], { allowed_paths: ['src/ok/**'] })
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id })))
  s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf])
  s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '2'])
  assert.notEqual(s.vfc('ugoal', 'route', u.ug_id).route, 'GOAL_VERIFIED', '설계에 .sql 이 있어 정책으로 승인되지 않는다')
})

test('읽기 전용 live 검증: 위임·테스트 계정·해시 결속 없으면 실행 안 함 · 건너뜀은 PASS 아님 · 통과만 PASS', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live-'))
  const src = path.join(wt, 'apps', 'web', 'src', 'lib')
  fs.mkdirSync(path.join(src, '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(src, 'reader.ts'), "export const read = (db) => db.from('t').select('*')\n")
  fs.writeFileSync(path.join(src, 'writer.ts'), "export const write = (db) => db.from('t').insert({})\nexport const ok = 1\n")
  fs.writeFileSync(path.join(src, '__tests__', 'x.live.test.ts'), "import { read } from '../reader'\nimport { ok } from '@/lib/writer'\n")
  const testRel = 'apps/web/src/lib/__tests__/x.live.test.ts'
  const cl = importClosure(wt, testRel)
  assert.deepEqual(cl.filter((c) => c.writes).map((c) => c.path), ['apps/web/src/lib/writer.ts'])
  const pol = basePolicy({ allowed_capabilities: ['read', 'test', 'db_read_dev'], live_test_user: '00000000-0000-4000-8000-000000000001' })
  assert.match(preflight({ ...pol, live_test_user: null }, wt, testRel).why.join(), /테스트 계정/)
  assert.match(preflight(pol, wt, testRel).why.join(), /확인 목록에 없다/)
  const w = cl.find((c) => c.writes)
  const attested = { ...pol, read_only_attestation: [{ path: w.path, sha256: w.sha256 }] }
  assert.equal(preflight(attested, wt, testRel).ok, true)
  fs.appendFileSync(path.join(src, 'writer.ts'), 'export const more = 2\n')
  assert.match(preflight(attested, wt, testRel).why.join(), /해시 불일치/, '확인 뒤 바뀐 파일은 다시 확인')
  process.env.VFC_VITEST_CMD = fake('fake-vitest.mjs')
  try {
    for (const [mode, want] of [['pass', 'PASS'], ['skip', 'UNVERIFIED'], ['fail', 'FAIL'], ['none', 'UNVERIFIED']]) {
      process.env.FAKE_VITEST = mode
      assert.equal(runLive({ worktree: wt, testRel, liveUser: pol.live_test_user }).status, want, mode)
    }
  } finally {
    delete process.env.VFC_VITEST_CMD
    delete process.env.FAKE_VITEST
  }
})

test('Codex P1·P2 회귀 — 부수 효과 import·재내보내기·공백 낀 쓰기 호출 · 러너 실패는 PASS 아님 · 정책 없으면 closure []', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live2-'))
  const src = path.join(wt, 'apps', 'web', 'src', 'lib')
  fs.mkdirSync(path.join(src, '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(src, 'side.ts'), "db.from('t').insert ({})\n")
  fs.writeFileSync(path.join(src, 'w2.ts'), "export const w = (db) => db.from('t')\n  .delete\n  ()\n")
  fs.writeFileSync(path.join(src, 'barrel.ts'), "export { w } from './w2'\n")
  fs.writeFileSync(path.join(src, '__tests__', 'y.live.test.ts'), "import '../side'\nimport { w } from '../barrel'\n")
  const testRel = 'apps/web/src/lib/__tests__/y.live.test.ts'
  const cl = importClosure(wt, testRel)
  assert.deepEqual(cl.filter((c) => c.writes).map((c) => c.path).sort(), ['apps/web/src/lib/side.ts', 'apps/web/src/lib/w2.ts'])
  fs.writeFileSync(path.join(src, '__tests__', 'z.live.test.ts'), "import '../missing'\nconst m = import(name)\n")
  const pol = basePolicy({ allowed_capabilities: ['read', 'test', 'db_read_dev'], live_test_user: '00000000-0000-4000-8000-000000000001' })
  const pz = preflight(pol, wt, 'apps/web/src/lib/__tests__/z.live.test.ts')
  assert.equal(pz.ok, false)
  assert.match(pz.why.join(), /찾지 못했다/)
  assert.match(pz.why.join(), /동적 import/)
  assert.deepEqual(preflight(null, wt, testRel).closure, [])
  // 통과 보고 + 러너 비정상 종료 → FAIL
  const fakeExit = path.join(wt, 'fake-exit.mjs')
  fs.writeFileSync(fakeExit, "import fs from 'node:fs'\nconst [, , , out] = process.argv\nfs.writeFileSync(out, JSON.stringify({ numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTotalTests: 1 }))\nprocess.exit(1)\n")
  process.env.VFC_VITEST_CMD = `node ${fakeExit.split(path.sep).join('/')}`
  try {
    assert.equal(runLive({ worktree: wt, testRel, liveUser: pol.live_test_user }).status, 'FAIL')
  } finally {
    delete process.env.VFC_VITEST_CMD
  }
})

test('Codex P1 회귀 — glob 범위 안이라도 실제로 바뀐 HIGH 파일은 막는다 · 정책 예산이 바닥나면 다음 라운드 전에 멈춘다', () => {
  const s = setup()
  const u = s.goal(design())
  s.draft(u.ug_id, [0])
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id })))
  s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf])
  // 가짜 Claude 가 src/ 아래 .sql 을 만든다(범위 src/** 안 · HIGH)
  const r = s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '1'], { FAKE_CLAUDE_EXTRA_FILE: 'src/seed.sql' }).json
  const out = r.run.tasks_done[0]?.outcome
  assert.match(String(out), /blocked/, JSON.stringify(r.run.tasks_done))
  const t = s.vfc('task', 'list').find?.((x) => x.user_goal_id === u.ug_id) ?? null
  assert.ok(t === null || t.status === 'BLOCKED')
})

test('Codex P1 회귀 2 — 소스 루트 밖 의존 거부 · 확인된 쓰기 함수를 새로 참조하면 재확인 · .env 가 테스트 계정을 덮지 못한다 · 다른 종류 승인으로 HIGH 파일 통과 불가', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live3-'))
  const src = path.join(wt, 'apps', 'web', 'src', 'lib')
  fs.mkdirSync(path.join(src, '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'apps', 'web', 'outside.ts'), "export const o = (db) => db.from('t').insert({})\n")
  fs.writeFileSync(path.join(src, '__tests__', 'o.live.test.ts'), "import { o } from '../../../outside'\n")
  const pol = basePolicy({ allowed_capabilities: ['read', 'test', 'db_read_dev'], live_test_user: '00000000-0000-4000-8000-000000000001' })
  assert.match(preflight(pol, wt, 'apps/web/src/lib/__tests__/o.live.test.ts').why.join(), /밖이다/)
  // 호출 경로 결속: 쓰기 함수가 있는 파일은 확인됐어도, 테스트가 그 함수를 새로 부르면 재확인
  fs.writeFileSync(path.join(src, 'writer.ts'), "export function doWrite(db) { return db.from('t').insert({}) }\nexport const safe = 1\n")
  fs.writeFileSync(path.join(src, '__tests__', 'p.live.test.ts'), "import { safe } from '../writer'\n")
  const rel = 'apps/web/src/lib/__tests__/p.live.test.ts'
  const w = importClosure(wt, rel).find((c) => c.writes)
  const att = { ...pol, read_only_attestation: [{ path: w.path, sha256: w.sha256 }], read_only_write_functions: ['doWrite'] }
  assert.equal(preflight(att, wt, rel).ok, true)
  fs.writeFileSync(path.join(src, '__tests__', 'p.live.test.ts'), "import { safe, doWrite } from '../writer'\ndoWrite(null)\n")
  assert.match(preflight(att, wt, rel).why.join(), /호출 경로 재확인/)
  // .env 에 다른 MAP_LIVE_USER 가 있어도 정책의 테스트 계정이 쓰인다
  const envFile = path.join(wt, 'test.env')
  fs.writeFileSync(envFile, 'MAP_LIVE_USER=11111111-1111-4111-8111-111111111111\nFAKE_SECRET=x\n')
  process.env.VFC_VITEST_CMD = fake('fake-vitest.mjs')
  process.env.FAKE_VITEST = 'pass'
  try {
    runLive({ worktree: wt, testRel: rel, liveUser: pol.live_test_user, envFile })
    const seen = fs.readdirSync(path.join(wt, '.vfc-runs')).filter((x) => x.endsWith('.env-seen'))
    const v = JSON.parse(fs.readFileSync(path.join(wt, '.vfc-runs', seen[0]), 'utf8'))
    assert.equal(v.MAP_LIVE_USER, pol.live_test_user)
    assert.equal(v.FAKE_SECRET_SEEN, true, '.env 값은 자식에게만 전달')
    assert.equal(process.env.FAKE_SECRET, undefined, '부모 환경은 그대로')
  } finally {
    delete process.env.VFC_VITEST_CMD
    delete process.env.FAKE_VITEST
  }
  const { highApprovalKind } = await import('../lib/policy.mjs')
  assert.equal(highApprovalKind('src/seed.sql'), 'db_write')
  assert.equal(highApprovalKind('apps/web/.env.local'), 'secret')
  assert.equal(highApprovalKind('apps/web/src/lib/supabase/admin.ts'), null, '인증·권한은 어떤 승인 종류로도 자동 작업에서 풀리지 않는다')
})

test('Codex P1 회귀 3 — 한 줄 여러 import 선언 · 러너 setupFiles 도 검사 대상', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live4-'))
  const web = path.join(wt, 'apps', 'web')
  const src = path.join(web, 'src', 'lib')
  fs.mkdirSync(path.join(src, '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(src, 'w.ts'), "export const write = (db) => db.from('t').insert({})\n")
  fs.writeFileSync(path.join(src, '__tests__', 'q.live.test.ts'), "import { test } from 'vitest'; import { write } from '../w'\n")
  const rel = 'apps/web/src/lib/__tests__/q.live.test.ts'
  assert.deepEqual(importClosure(wt, rel).filter((c) => c.writes).map((c) => c.path), ['apps/web/src/lib/w.ts'], '같은 줄 두 번째 import 도 따라간다')
  fs.mkdirSync(path.join(web, 'tests'), { recursive: true })
  fs.writeFileSync(path.join(web, 'tests', 'setup.ts'), "db.from('seed').upsert({})\n")
  fs.writeFileSync(path.join(web, 'vitest.config.ts'), "export default { test: { setupFiles: ['./tests/setup.ts'] } }\n")
  const cl = importClosure(wt, rel)
  assert.ok(cl.some((c) => c.path === 'apps/web/tests/setup.ts' && c.writes === 1), '러너가 먼저 싣는 setup 파일의 쓰기를 잡는다')
  fs.writeFileSync(path.join(web, 'vitest.config.ts'), "const s = ['./tests/setup.ts']\nexport default { test: { setupFiles: s } }\n")
  assert.match(importClosure(wt, rel).unresolved.join(), /문자열\(목록\)만/)
})

test('Codex 회귀 4 — setup 목록에 비문자 값이 섞이면 거부 · 빈 배열 허용 · 공유 설정 모듈의 setup 선언 거부 · 주석 속 import 무시', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live5-'))
  const web = path.join(wt, 'apps', 'web')
  const src = path.join(web, 'src', 'lib')
  fs.mkdirSync(path.join(src, '__tests__'), { recursive: true })
  fs.mkdirSync(path.join(web, 'tests'), { recursive: true })
  fs.writeFileSync(path.join(web, 'tests', 'safe.ts'), 'export const a = 1\n')
  fs.writeFileSync(path.join(src, '__tests__', 'r.live.test.ts'), "// 예: import { x } from './not-a-real-module'\n/* import '../nope' */\nexport const t = 1\n")
  const rel = 'apps/web/src/lib/__tests__/r.live.test.ts'
  const cfg = (body) => fs.writeFileSync(path.join(web, 'vitest.config.ts'), body)
  cfg("export default { test: { setupFiles: ['./tests/safe.ts', extra] } }\n")
  assert.match(importClosure(wt, rel).unresolved.join(), /문자열\(목록\)만/)
  cfg("export default { test: { setupFiles: [] } }\n")
  assert.deepEqual(importClosure(wt, rel).unresolved, [], '빈 배열 · 주석 속 import 는 문제 없음')
  fs.writeFileSync(path.join(web, 'shared.config.ts'), "export const shared = { setupFiles: ['./tests/safe.ts'] }\n")
  cfg("import { shared } from './shared.config'\nexport default { test: shared }\n")
  assert.match(importClosure(wt, rel).unresolved.join(), /공유 설정 모듈/)
})

test('live 실행 게이트 = 실행별 대화형 승인(closure·커밋 결속 · 1회용) — 정적 검사만으로는 실행하지 않는다', () => {
  const s = setup()
  const u = s.goal(design())
  // 검증 대상 worktree: 제품 형태(apps/web/src) + 커밋된 깨끗한 상태
  const wt = s.wt
  fs.mkdirSync(path.join(wt, 'apps', 'web', 'src', 'lib', '__tests__'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'apps', 'web', 'src', 'lib', '__tests__', 'v.live.test.ts'), 'export const v = 1\n')
  execFileSync('git', ['-C', wt, 'add', '.'])
  execFileSync('git', ['-C', wt, 'commit', '-q', '-m', 'live test'])
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id, allowed_capabilities: ['read', 'test', 'code_change', 'db_read_dev'], live_test_user: '00000000-0000-4000-8000-000000000001' })))
  s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf])
  s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '1'])
  s.vfc('decision', 'add', '--status', 'APPROVED', '--kind', 'design_approval', '--summary', `${u.ug_id}@v1 승인`, '--approved-by', 'user', '--ref', 't', '--by', 'user')
  const rel = 'apps/web/src/lib/__tests__/v.live.test.ts'
  const env = { VFC_VITEST_CMD: fake('fake-vitest.mjs'), FAKE_VITEST: 'pass' }
  const chk = s.run(VFC, ['verify', 'live', u.ug_id, '--test', rel, '--worktree', wt, '--check', '--json'], env).json
  assert.match(chk.approve_with, /--kind live_run/)
  assert.match(s.run(VFC, ['verify', 'live', u.ug_id, '--test', rel, '--worktree', wt], env).err, /TRUST_REQUIRED/, '실행 승인 없이는 실행하지 않는다')
  const bad = s.tty(['--kind', 'live_run', '--summary', `${u.ug_id}@live`, '--closure-sha', 'a'.repeat(64), '--commit', chk.commit], 'aa1111').json
  assert.match(s.run(VFC, ['verify', 'live', u.ug_id, '--test', rel, '--worktree', wt, '--decision', bad.decision_id], env).err, /APPROVAL_MISMATCH/)
  const good = s.tty(['--kind', 'live_run', '--summary', `${u.ug_id}@live`, '--closure-sha', chk.closure_sha, '--commit', chk.commit], 'bb2222').json
  const r = s.run(VFC, ['verify', 'live', u.ug_id, '--test', rel, '--worktree', wt, '--decision', good.decision_id, '--acceptance', '0', '--json'], env)
  assert.equal(r.json?.status, 'PASS', r.err)
  assert.match(s.run(VFC, ['verify', 'live', u.ug_id, '--test', rel, '--worktree', wt, '--decision', good.decision_id], env).err, /APPROVAL_USED/, '실행마다 새 승인')
})

test('담당 세션 실행 모드 — AI-Control 은 배정·인수 확인·리뷰만: 자동 작업은 담당 owner 받은 편지함으로 · 구현하지 않음 · 제출되면 독립 리뷰로 완료', () => {
  const s = setup()
  const u = s.goal(design())
  const pf = path.join(s.root, 'policy.json')
  fs.writeFileSync(pf, JSON.stringify(basePolicy({ goal_id: u.ug_id })))
  s.tty(['--kind', 'goal_delegation', '--summary', `${u.ug_id}@policy`, '--policy-file', pf])
  const stF = path.join(s.root, 'state', 'USER_GOALS.json')
  const st = JSON.parse(fs.readFileSync(stF, 'utf8'))
  Object.assign(st.goals[u.ug_id], { execution_mode: 'owner_session', dispatch_owner: OWNER })
  fs.writeFileSync(stF, JSON.stringify(st))
  // 실행 1: 정책 승인 → 작업 자동 생성 → 담당 owner 에게 배정(구현하지 않음)
  const r1 = s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '2']).json
  assert.equal(r1.run.tasks_done.length, 0, '오케스트레이터는 담당 세션 작업을 구현하지 않는다')
  const tasks = s.vfc('task', 'list')
  const t = (Array.isArray(tasks) ? tasks : tasks.tasks).find((x) => x.user_goal_id === u.ug_id)
  assert.equal(t.owner_id, OWNER)
  assert.equal(t.dispatch.to, OWNER)
  assert.equal(t.dispatch.accepted_at, null, '등록 ≠ 인수')
  const inbox = fs.readFileSync(path.join(s.root, 'planning', 'inbox', `${OWNER}.md`), 'utf8')
  assert.match(inbox, new RegExp(t.task_id))
  // 담당 세션: worktree 지정 → 인수 → 커밋 → 증거 → 제출
  s.vfc('task', 'assign-worktree', t.task_id, s.wt, '--by', OWNER, '--branch', 'feat/t')
  s.vfc('task', 'start', t.task_id, '--owner', OWNER, '--agent', 'claude', '--session', 'map-session-1')
  assert.equal(s.vfc('task', 'show', t.task_id).dispatch.accepted_session, 'map-session-1', '인수 기록')
  fs.writeFileSync(path.join(s.wt, 'src', 'owner.ts'), 'export const o = 1\n')
  execFileSync('git', ['-C', s.wt, 'add', '.'])
  execFileSync('git', ['-C', s.wt, 'commit', '-q', '-m', 'owner work'])
  const ev = path.join(s.root, 'ev.json')
  fs.writeFileSync(ev, JSON.stringify({ type: 'unit', command_or_protocol: 'node --test', result: 'pass', skip_count: 0, artifact_path_or_url: path.join(s.wt, 'src', 'owner.ts'), observed_at: new Date().toISOString(), covers: [0, 1] }))
  s.vfc('task', 'evidence', t.task_id, '--file', ev, '--by', OWNER)
  s.vfc('task', 'submit', t.task_id, '--by', OWNER)
  // 실행 2: 오케스트레이터는 독립 리뷰만 → 완료
  const r2 = s.run(ORCH, ['--no-ci', '--json', '--max-tasks', '1'])
  const done = s.vfc('task', 'show', t.task_id)
  assert.equal(done.status, 'COMPLETED', JSON.stringify(done.history?.slice(-2)))
  assert.ok(done.verified_commit)
})

test('REVIEW_UNKNOWN P1 회귀 — 승인한 테스트 파일 말고 다른 파일이 실행되면 live PASS 아님', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live6-'))
  fs.mkdirSync(path.join(wt, 'apps', 'web', 'src', 'lib', '__tests__'), { recursive: true })
  const rel = 'apps/web/src/lib/__tests__/a.live.test.ts'
  fs.writeFileSync(path.join(wt, rel), 'export const a = 1\n')
  const fx = path.join(wt, 'fx.mjs')
  fs.writeFileSync(fx, "import fs from 'node:fs'\nconst [, , , out] = process.argv\nfs.writeFileSync(out, JSON.stringify({ numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numTotalTests: 2, testResults: [{ name: 'D:/x/apps/web/src/lib/__tests__/a.live.test.ts' }, { name: 'D:/x/apps/web/src/lib/__tests__/a.live.test.ts.other.ts' }] }))\n")
  process.env.VFC_VITEST_CMD = `node ${fx.split(path.sep).join('/')}`
  try {
    const r = runLive({ worktree: wt, testRel: rel, liveUser: '00000000-0000-4000-8000-000000000001' })
    assert.equal(r.status, 'FAIL')
    assert.match(r.reason, /승인 밖/)
  } finally {
    delete process.env.VFC_VITEST_CMD
  }
})

test('Codex P1 — live 필터가 승인 파일 하나만 고르지 않으면 자격 증명을 주기 전에 멈춘다', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-live7-'))
  const d = path.join(wt, 'apps', 'web', 'src', 'lib', '__tests__')
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'load.live.test.ts'), 'export const a = 1\n')
  const d2 = path.join(wt, 'apps', 'web', 'legacy', 'src', 'lib', '__tests__')
  fs.mkdirSync(d2, { recursive: true })
  fs.writeFileSync(path.join(d2, 'load.live.test.ts'), 'export const b = 1\n') // 필터가 부분 일치로 이 파일도 고른다
  process.env.VFC_VITEST_CMD = fake('fake-vitest.mjs')
  process.env.FAKE_VITEST = 'pass'
  try {
    const r = runLive({ worktree: wt, testRel: 'apps/web/src/lib/__tests__/load.live.test.ts', liveUser: '00000000-0000-4000-8000-000000000001' })
    assert.equal(r.status, 'UNVERIFIED')
    assert.match(r.reason, /자격 증명을 주지 않았다/)
    assert.ok(!fs.existsSync(path.join(wt, '.vfc-runs')), '러너를 실행하지 않았다')
  } finally {
    delete process.env.VFC_VITEST_CMD
    delete process.env.FAKE_VITEST
  }
})
