// agents/scripts/__tests__/safe-merge.test.mjs — 병합 게이트 판정 회귀(2026-10-10 PR #200: build FAILURE 인데 병합됨)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, classify } from '../safe-merge.mjs'

const run = (name, conclusion, status = 'COMPLETED') => ({ __typename: 'CheckRun', name, status, conclusion })
const pr = (checks, over = {}) => ({ state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: 'a'.repeat(40), statusCheckRollup: checks, ...over })

// PR #200 병합 시점의 실제 체크 묶음(이름 중복 · 한쪽 SKIPPED · build FAILURE)
const PR200 = [
  run('verify', 'SUCCESS'), run('TypeScript 0 error', 'SUCCESS'), run('TypeScript 0 error', 'SUCCESS'), run('build', 'FAILURE'),
  run('docs/*.md broken link check', 'SUCCESS'), run('migration ↔ docs/DB_SCHEMA / CHANGELOG 정합', 'SKIPPED'), run('e2e', 'SUCCESS'),
  run('migration ↔ docs/DB_SCHEMA / CHANGELOG 정합', 'SUCCESS'), run('docs/CHANGELOG.md Unreleased 비어있지 않음', 'SKIPPED'),
  run('docs/CHANGELOG.md Unreleased 비어있지 않음', 'SUCCESS'),
]

test('SM1 PR #200 실측: build FAILURE 면 병합하지 않는다', () => {
  const d = decide(pr(PR200))
  assert.equal(d.ok, false)
  assert.ok(d.reasons.some((r) => r.startsWith('실패: build')))
  assert.equal(d.pending, false, '실패는 기다려도 풀리지 않는다')
})

test('SM2 같은 이름이 SKIPPED + SUCCESS 면 통과 · 모두 SUCCESS 면 병합 가능', () => {
  const fixed = PR200.map((c) => (c.name === 'build' ? run('build', 'SUCCESS') : c))
  assert.deepEqual(decide(pr(fixed)).reasons, [])
  assert.equal(decide(pr(fixed)).ok, true)
})

test('SM3 SKIPPED·NEUTRAL 뿐인 체크는 통과가 아니다', () => {
  for (const c of ['SKIPPED', 'NEUTRAL']) {
    const d = decide(pr([run('verify', 'SUCCESS'), run('build', c)]))
    assert.equal(d.ok, false, c)
    assert.ok(d.reasons.some((r) => r.startsWith('통과 아님: build')))
  }
})

test('SM4 진행 중 체크는 대기(PENDING) — 통과 아님 · --wait 대상', () => {
  const d = decide(pr([run('verify', 'SUCCESS'), run('build', null, 'IN_PROGRESS')]))
  assert.equal(d.ok, false)
  assert.equal(d.pending, true)
  const mixed = decide(pr([run('build', 'FAILURE'), run('e2e', null, 'QUEUED')]))
  assert.equal(mixed.pending, false, '실패가 섞이면 기다리지 않는다')
})

test('SM5 모르는 결론 · 체크 없음 · 충돌 · 닫힌 PR 은 병합하지 않는다', () => {
  assert.equal(decide(pr([run('build', 'WEIRD')])).ok, false)
  assert.equal(classify(run('build', 'WEIRD')).state, 'unknown')
  assert.equal(decide(pr([])).ok, false)
  assert.equal(decide(pr([run('build', 'SUCCESS')], { mergeable: 'CONFLICTING' })).ok, false)
  assert.equal(decide(pr([run('build', 'SUCCESS')], { mergeable: 'UNKNOWN' })).ok, false)
  assert.equal(decide(pr([run('build', 'SUCCESS')], { state: 'MERGED' })).ok, false)
})

test('SM6 실패 결론 전부(CANCELLED·TIMED_OUT·ACTION_REQUIRED·STARTUP_FAILURE·STALE)는 실패', () => {
  for (const c of ['CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE']) assert.equal(classify(run('x', c)).state, 'fail', c)
})

test('SM7 StatusContext(옛 상태 API)도 같은 규칙', () => {
  const ctx = (state) => ({ __typename: 'StatusContext', context: 'ci/legacy', state })
  assert.equal(classify(ctx('SUCCESS')).state, 'pass')
  assert.equal(classify(ctx('PENDING')).state, 'pending')
  assert.equal(classify(ctx('FAILURE')).state, 'fail')
})

// ── 정책 v1.1 게이트(2026-10-11) ──
import { createHash } from 'node:crypto'
import { gates, loadPolicy } from '../safe-merge.mjs'

const policy = loadPolicy()
const sha = (t) => createHash('sha256').update(t).digest('hex')

test('SM-P1 필수 체크가 하나라도 없으면 누락 — 통과가 아니다(돌지 않은 e2e)', () => {
  const all = policy.required_checks.map((n) => run(n, 'SUCCESS'))
  assert.equal(decide(pr(all), { required: policy.required_checks }).ok, true)
  const d = decide(pr(all.filter((c) => c.name !== 'e2e')), { required: policy.required_checks })
  assert.equal(d.ok, false)
  assert.ok(d.reasons.some((r) => r.startsWith('누락: e2e')))
  assert.equal(d.pending, false, '누락은 기다려도 풀리지 않는다')
})

test('SM-P2 base ≠ main 이면 종속 PR — 병합 안 함', () => {
  const g = gates({ baseRefName: 'feat/map-v4-plan', body: '', files: [] }, policy)
  assert.equal(g.ok, false)
  assert.ok(g.reasons[0].startsWith('종속 PR'))
  assert.equal(gates({ baseRefName: 'main', body: '', files: [] }, policy).ok, true)
})

test('SM-P3 마이그레이션 변경은 HEAD 본문 해시와 맞는 DB-Approved 증거가 있어야 한다', () => {
  const p = 'supabase/migrations/20261010180218_map_v4_plan.sql'
  const text = 'create table x (id int);\n'
  const files = [{ path: p }, { path: 'apps/web/a.ts' }]
  assert.ok(gates({ baseRefName: 'main', body: '', files }, policy, { [p]: text }).reasons[0].includes('승인 증거 없음'))
  const ok = gates({ baseRefName: 'main', body: `설명\r\nDB-Approved: 20261010180218_map_v4_plan.sql sha256=${sha(text).slice(0, 12)}\r\n`, files }, policy, { [p]: text })
  assert.equal(ok.ok, true, ok.reasons.join())
  const changed = gates({ baseRefName: 'main', body: `DB-Approved: 20261010180218_map_v4_plan.sql sha256=${sha(text).slice(0, 12)}`, files }, policy, { [p]: text + '-- 승인 뒤 수정\n' })
  assert.ok(changed.reasons[0].includes('승인 뒤 바뀜'))
  assert.ok(gates({ baseRefName: 'main', body: '', files }, policy, {}).reasons[0].includes('읽지 못해'), '본문을 못 읽으면 통과시키지 않는다')
})

test('SM-P4 데이터 삭제 구문 · 삭제된 마이그레이션도 증거 필요', () => {
  const p = 'supabase/migrations/20261011000000_x.sql'
  const r = gates({ baseRefName: 'main', body: '', files: [{ path: p }] }, policy, { [p]: 'TRUNCATE public.t;' })
  assert.ok(r.reasons[0].startsWith('DB 변경 + 데이터 삭제 구문'))
  const gone = gates({ baseRefName: 'main', body: '', files: [{ path: p }] }, policy, { [p]: null })
  assert.ok(gone.reasons[0].startsWith('삭제된 마이그레이션'))
  assert.equal(gates({ baseRefName: 'main', body: 'DB-Approved: 20261011000000_x.sql sha256=removed', files: [{ path: p }] }, policy, { [p]: null }).ok, true)
})

test('SM-P5 30파일 이상은 승인이 아니라 「## 검증」 절 — 없으면 병합 안 함', () => {
  const files = Array.from({ length: policy.large_change.files }, (_, i) => ({ path: `apps/web/f${i}.ts` }))
  assert.ok(gates({ baseRefName: 'main', body: '요약만', files }, policy).reasons[0].startsWith('대규모 변경'))
  assert.equal(gates({ baseRefName: 'main', body: '## 검증\n- 전체 테스트 통과', files }, policy).ok, true)
})

test('SM-P6 정책 정본 — 자동 병합은 활성화 조건 확인 전까지 꺼져 있다', () => {
  assert.equal(policy.mode, 'AUTO_CONTINUE')
  assert.equal(policy.merge.auto_merge_enabled, false)
  assert.deepEqual(Object.keys(policy.approval_required).sort(), ['data_deletion', 'db_change'])
  for (const n of ['verify', 'build', 'e2e']) assert.ok(policy.required_checks.includes(n), n)
})

test('SM-P7 _pending_ 제안본은 증거 대상 아님 — 메모로만 · 적용 번호 파일은 그대로 증거 필요', () => {
  const g = gates({ baseRefName: 'main', body: '', files: [{ path: 'supabase/migrations/_pending_x.sql' }] }, policy, {})
  assert.equal(g.ok, true)
  assert.ok(g.notes[0].startsWith('제안본 _pending_x.sql'))
})
