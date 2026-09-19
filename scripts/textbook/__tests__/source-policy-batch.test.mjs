// scripts/textbook/__tests__/source-policy-batch.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSource } from '../../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { validateProjection, changedFields, assertCurrentProjection } from '../source-policy-batch.mjs'

const now = Date.parse('2026-09-19T12:00:00Z')
function fixture() {
  const input = { title: 'A garden', status: 'ready', articleVLevel: 4, wordCount: 150, register: 'expository', cefrLevel: 'B1', syntaxScore: 30, displayOnly: false, licenseClass: 'public_domain', copyrightSafeInKr: true, gatePublishable: true, gateBlockedBy: null, gateVerdict: 'use', gatePurpose: 'csat', gateGenre: 'science', excerptWindows: null, hasItems: false, outsidePct: null }
  return { article_id: '11111111-1111-1111-1111-111111111111', source: 'original', source_updated_at: '2026-09-18T20:00:00Z', measured_at: '2026-09-19T11:00:00Z', policy_version: 3, input, result: evaluateSource(input), linked_items: 0, quality_flags: [], excerpt_evidence: {} }
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
