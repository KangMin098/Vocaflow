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
