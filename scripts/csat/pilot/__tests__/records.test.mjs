// scripts/csat/pilot/__tests__/records.test.mjs
//   node --no-warnings --test scripts/csat/pilot/__tests__/records.test.mjs
// G6 점검 · 봉인 공용 검사기 — 검증 기록(PII 가드 · E2E) 원본 검사 · 배포 env 메타 = docs 정본.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { rulesHash } from '../../error-evidence/model-input/deidentify.mjs'
import { E2E_REQUIRED_SPEC, envMetaState, recordFailures } from '../live.mjs'

const RUN = 'ec-pilot-run-20261020-1'
const C = 'a'.repeat(40)
const pii = (over = {}) => ({ sha256: '1'.repeat(64), json: { format: 'ec-pilot-pii-guard-1', runId: RUN, commit: C, rulesHash: rulesHash(), passed: 53, failed: 0, at: '2026-10-19T09:00:00Z', ...over } })
const e2e = (over = {}) => ({ sha256: '2'.repeat(64), json: { format: 'ec-pilot-e2e-1', runId: RUN, commit: C, build: 'production', specs: [E2E_REQUIRED_SPEC], passed: 9, failed: 0, skipped: 0, at: '2026-10-19T10:00:00Z', playwright: '1.47.0', reportSha256: '3'.repeat(64), ...over } })

test('점검 · 봉인 스크립트가 쓰는 export 가 모두 있다(모듈 그래프 회귀)', async () => {
  const live = await import('../live.mjs')
  for (const k of ['readLive', 'readRecord', 'recordFailures', 'envMetaState', 'loadPg', 'configProbeCap', 'rulesHash', 'ROOT', 'RUNS']) assert.ok(k in live, k)
})

test('정상 기록 — 실패 없음', () => assert.deepEqual(recordFailures(RUN, { pii: pii(), e2e: e2e() }, null), []))

test('없는 기록 · 다른 run · 실패 · 건너뜀 → 실패', () => {
  assert.ok(recordFailures(RUN, { pii: null, e2e: e2e() }, null).includes('record:piiGuard.missing'))
  assert.ok(recordFailures(RUN, { pii: pii({ runId: 'ec-pilot-run-20261001-1' }), e2e: e2e() }, null).includes('record:piiGuard.fields'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ runId: 'ec-pilot-run-20261001-1' }) }, null).includes('record:e2e.fields'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ failed: 1 }) }, null).includes('record:e2e.fields'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ skipped: 2 }) }, null).includes('record:e2e.fields'))
  assert.ok(recordFailures(RUN, { pii: pii({ format: 'x' }), e2e: e2e() }, null).includes('record:piiGuard.fields'))
})

test('E2E — production 빌드 · e2e 52 포함 · 리포트 해시 필수', () => {
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ build: 'dev' }) }, null).includes('record:e2e.build'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ specs: ['tests/e2e/01-smoke.spec.ts'] }) }, null).includes('record:e2e.specs'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ reportSha256: undefined }) }, null).includes('record:e2e.reportSha256'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e() }, null, { e2eReportSha256: '4'.repeat(64) }).includes('record:e2e.report'))
})

test('PII 규칙이 바뀌면 기록이 낡는다 · 두 기록 커밋이 다르면 실패', () => {
  assert.ok(recordFailures(RUN, { pii: pii({ rulesHash: '5'.repeat(64) }), e2e: e2e() }, null).includes('record:piiGuard.rulesHash'))
  assert.ok(recordFailures(RUN, { pii: pii(), e2e: e2e({ commit: 'b'.repeat(40) }) }, null).includes('record:commit.differs'))
})

test('메타 요약과 파일이 다르면 실패', () => {
  const meta = { verification: { piiGuard: { recordSha256: '1'.repeat(64), commit: C, passed: 53, rulesHash: rulesHash() }, e2e: { recordSha256: '9'.repeat(64), commit: C, passed: 9, at: '2026-10-19T10:00:00Z' } } }
  const f = recordFailures(RUN, { pii: pii(), e2e: e2e() }, meta)
  assert.ok(!f.includes('record:piiGuard.meta'))
  assert.ok(f.includes('record:e2e.meta'))
})

test('배포 env 메타 = docs 정본', () => {
  const meta = { runId: RUN, b: 1, a: [1, 2] }
  assert.equal(envMetaState(meta, ''), 'missing')
  assert.equal(envMetaState(meta, '{oops'), 'invalid')
  assert.equal(envMetaState(meta, JSON.stringify({ a: [1, 2], b: 1, runId: RUN })), 'match')
  assert.equal(envMetaState(meta, JSON.stringify({ ...meta, b: 2 })), 'differs')
})
