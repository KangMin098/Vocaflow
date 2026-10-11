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
import { gates, loadPolicy, verifyRuns } from '../safe-merge.mjs'

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

test('SM-P3 마이그레이션 승인 증거 = 개발 DB 적용 이력 해시 일치 — PR 본문 문자열은 증거가 아니다', () => {
  const p = 'supabase/migrations/20261010180218_map_v4_plan.sql'
  const text = 'create table x (id int);\n'
  const files = [{ path: p }, { path: 'apps/web/a.ts' }]
  // 본문에 승인 줄을 써도 적용 이력이 없으면 막는다(작성자가 꾸밀 수 있는 문자열)
  const forged = gates({ baseRefName: 'main', body: `DB-Approved: 20261010180218_map_v4_plan.sql sha256=${sha(text)}`, files }, policy, { [p]: text }, {})
  assert.ok(forged.reasons[0].includes('적용 이력 없음'), forged.reasons.join())
  const ok = gates({ baseRefName: 'main', body: '', files }, policy, { [p]: text }, { '20261010180218': sha(text) })
  assert.equal(ok.ok, true, ok.reasons.join())
  const changed = gates({ baseRefName: 'main', body: '', files }, policy, { [p]: text + '-- 적용 뒤 수정\n' }, { '20261010180218': sha(text) })
  assert.ok(changed.reasons[0].includes('적용 뒤 바뀜'))
  assert.ok(gates({ baseRefName: 'main', body: '', files }, policy, { [p]: text }, null).reasons[0].includes('적용 이력을 읽지 못했다'), '이력을 못 읽으면 통과시키지 않는다')
  assert.ok(gates({ baseRefName: 'main', body: '', files }, policy, {}, {}).reasons[0].includes('읽지 못해'), '본문을 못 읽으면 통과시키지 않는다')
  const noVersion = gates({ baseRefName: 'main', body: '', files: [{ path: 'supabase/migrations/fix.sql' }] }, policy, { 'supabase/migrations/fix.sql': text }, {})
  assert.ok(noVersion.reasons[0].includes('버전 번호 없는'))
})

test('SM-P4 데이터 삭제 구문은 종류를 밝히고 · 마이그레이션 파일 삭제는 승인 대상', () => {
  const p = 'supabase/migrations/20261011000000_x.sql'
  const r = gates({ baseRefName: 'main', body: '', files: [{ path: p }] }, policy, { [p]: 'TRUNCATE public.t;' }, {})
  assert.ok(r.reasons[0].startsWith('DB 변경 + 데이터 삭제 구문'))
  assert.ok(gates({ baseRefName: 'main', body: '', files: [{ path: p }] }, policy, { [p]: null }, { '20261011000000': 'x' }).reasons[0].startsWith('적용된 마이그레이션 삭제'))
  assert.ok(gates({ baseRefName: 'main', body: '', files: [{ path: p }] }, policy, { [p]: null }, {}).reasons[0].startsWith('마이그레이션 삭제'))
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

test('SM-P7 _pending_ 제안본은 증거 대상 아님 — 메모로만', () => {
  const g = gates({ baseRefName: 'main', body: '', files: [{ path: 'supabase/migrations/_pending_x.sql' }] }, policy, {})
  assert.equal(g.ok, true)
  assert.ok(g.notes[0].startsWith('제안본 _pending_x.sql'))
})

test('SM-P8 필수 체크는 이 HEAD 에서 · 마지막 base 변경 뒤에 성공해야 한다', () => {
  const H = 'b'.repeat(40)
  const runAt = (name, at, conclusion = 'success', head = H) => ({ name, head_sha: head, status: 'completed', conclusion, started_at: at })
  const req = ['verify', 'e2e']
  assert.equal(verifyRuns(req, [runAt('verify', '2026-10-11T02:00:00Z'), runAt('e2e', '2026-10-11T02:00:00Z')], H, '2026-10-11T01:00:00Z').ok, true)
  const old = verifyRuns(req, [runAt('verify', '2026-10-11T00:00:00Z'), runAt('e2e', '2026-10-11T02:00:00Z')], H, '2026-10-11T01:00:00Z')
  assert.ok(old.reasons[0].includes('base 변경') && old.reasons[0].includes('verify'))
  const other = verifyRuns(req, [runAt('verify', '2026-10-11T02:00:00Z', 'success', 'c'.repeat(40)), runAt('e2e', '2026-10-11T02:00:00Z')], H, null)
  assert.ok(other.reasons[0].includes('에서 돈 「verify」 없음'), '다른 커밋의 성공은 이 HEAD 의 성공이 아니다')
  const skipped = verifyRuns(req, [runAt('verify', '2026-10-11T02:00:00Z', 'skipped'), runAt('e2e', '2026-10-11T02:00:00Z')], H, null)
  assert.ok(skipped.reasons[0].includes('성공 아님(skipped)'))
})

test('SM-P9 정책 비활성 — safe-merge 본체에 병합 차단 분기가 dry-run 다음 · gh pr merge 앞에 있다', async () => {
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('../safe-merge.mjs', import.meta.url), 'utf8')
  const iDry = src.indexOf('if (dry)')
  const iOff = src.indexOf('if (!policy.merge.auto_merge_enabled)')
  const iMerge = src.indexOf("gh(['pr', 'merge'")
  assert.ok(iDry > 0 && iOff > iDry && iMerge > iOff, '꺼짐 차단이 병합 호출보다 앞에 있어야 한다')
  assert.ok(!/--auto/.test(src.slice(iOff - 200, iOff + 300)), '자동/수동 구분 없이 막는다')
})
