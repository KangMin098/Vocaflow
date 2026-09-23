// scripts/textbook/__tests__/source-policy-batch.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSource } from '../../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { validateProjection, changedFields, assertCurrentProjection } from '../source-policy-batch.mjs'

const now = Date.parse('2026-09-19T12:00:00Z')
function fixture() {
  const input = { title: 'A garden', status: 'ready', articleVLevel: 4, wordCount: 150, register: 'expository', cefrLevel: 'B1', syntaxScore: 30, displayOnly: false, licenseClass: 'public_domain', copyrightSafeInKr: true, gatePublishable: true, gateBlockedBy: null, gateVerdict: 'use', gatePurpose: 'csat', gateGenre: 'science', excerptWindows: null, hasItems: false, outsidePct: null }
  return { article_id: '11111111-1111-1111-1111-111111111111', source: 'original', source_updated_at: '2026-09-18T20:00:00Z', measured_at: '2026-09-19T11:00:00Z', policy_version: 3, input, result: evaluateSource(input), linked_items: 0, quality_flags: [], excerpt_evidence: {}, uses: ['argument'] }
}
test('invalid, missing, future and expired measurement cannot bypass the age guard', () => {
  for (const measured_at of [null, undefined, 'bad', '2026-09-20T00:00:00Z', '2026-09-17T00:00:00Z']) assert.throws(() => validateProjection({ ...fixture(), measured_at }, now), /measurement/)
  assert.doesNotThrow(() => validateProjection(fixture(), now))
})
test('forged policy and inconsistent item evidence fail before writes', () => {
  assert.throws(() => validateProjection({ ...fixture(), result: { ...fixture().result, blockers: ['invented'] } }, now), /canonical/)
  assert.throws(() => validateProjection({ ...fixture(), linked_items: 2 }, now), /evidence/)
})
test('same grade with different input is a change; timestamp and JSON key formatting are not', () => {
  const row = fixture()
  assert.deepEqual(changedFields({ ...row, source_updated_at: '2026-09-18T20:00:00+00:00', input: Object.fromEntries(Object.entries(row.input).reverse()) }, row), [])
  assert.deepEqual(changedFields({ ...row, input: { ...row.input, title: 'Old title' } }, row), ['input'])
})
test('concurrent source and item changes require a new export', () => {
  const row = fixture()
  assert.doesNotThrow(() => assertCurrentProjection(row, { updated_at: row.source_updated_at }, 0))
  assert.throws(() => assertCurrentProjection(row, { updated_at: '2026-09-19T11:30:00Z' }, 0), /revision/)
  assert.throws(() => assertCurrentProjection(row, { updated_at: row.source_updated_at }, 1), /references/)
})

/* 교재 재료 태그 — 2026-09-23. 조회가 이 컬럼으로 걸리므로 **투영이 빠지면 조회가 거짓말을 한다.**
 * 여기서 지키는 성질 셋: ① null 과 [] 는 다른 뜻이라 둘 다 유효하다 ② 키가 통째로 빠진 것은
 * 무효다(옛 export 를 새 스키마에 흘리면 upsert 가 옛 태그를 그대로 남긴다) ③ 태그만 바뀐 행도
 * `changedFields` 가 잡는다(못 잡으면 「변경 없음」으로 걸러져 영영 안 써진다). */
test('재료 태그: null 과 빈 배열은 다른 뜻이고, 누락과 정본 밖 태그는 막는다', () => {
  assert.doesNotThrow(() => validateProjection({ ...fixture(), uses: null }, now))
  assert.doesNotThrow(() => validateProjection({ ...fixture(), uses: [] }, now))
  const missing = fixture(); delete missing.uses
  assert.throws(() => validateProjection(missing, now), /use tags/)
  assert.throws(() => validateProjection({ ...fixture(), uses: ['persuasive'] }, now), /use tags/)
})
test('재료 태그만 바뀌어도 변경으로 잡힌다', () => {
  const row = fixture()
  assert.deepEqual(changedFields({ ...row, uses: ['argument', 'mood'] }, row), ['uses'])
  assert.deepEqual(changedFields({ ...row, uses: null }, row), ['uses'])
  assert.deepEqual(changedFields(row, row), [])
})
