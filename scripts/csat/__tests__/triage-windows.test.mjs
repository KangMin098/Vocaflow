// scripts/csat/__tests__/triage-windows.test.mjs
//
// **창 판정(B)은 보관만 확정한다 — 보관이 아닌 것은 전문 판정(C)으로 간다**(criteria.md §13).
// 폐기는 되돌릴 수 없고 버린 원문은 흔적이 없다. 창만 읽고 폐기가 적재되면 이 설계 전체가 무너진다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { retainProblems, retainRecord, needsFullRead } from '../retain-record.mjs'
import { CRITERIA_VERSION } from '../gate-rules.mjs'

const base = (over = {}) => ({
  id: '00000000-0000-0000-0000-000000000001', kind: 'retain', basis: 'windows', criteria_version: CRITERIA_VERSION,
  source_updated_at: '2026-09-26T00:00:00Z', body_sha256: 'a'.repeat(64),
  retention: 'keep', genre: 'science', why: '원인과 결과가 첫 창 안에서 선다.',
  slots: { ages: ['high2'], purposes: ['csat'], types: ['topic'], levels: ['V6'], platform: [] },
  processing: { detachable: true, standsAlone: true, vocabAdjustable: false, sample: 'Rivers carry heat north', note: '첫 창 단락이 홀로 선다' },
  window_verdicts: [{ i: 0, verdict: 'use', genre: 'science', uses: ['factual'] }, { i: 1, verdict: 'reject', genre: 'data-table', uses: [] }],
  ...over,
})

test('창 판정 보관은 그대로 적재된다', () => {
  assert.deepEqual(retainProblems(base()), [])
  assert.equal(needsFullRead(base()), false)
  assert.equal(retainRecord(base()).basis, 'windows')
  assert.equal(retainRecord(base()).window_verdicts.length, 2)
})

test('창 판정의 보류·폐기와 escalate 는 전문으로 간다', () => {
  assert.equal(needsFullRead(base({ retention: 'discard' })), true)
  assert.equal(needsFullRead(base({ retention: 'hold', hold_reason: 'criteria-gap' })), true)
  assert.equal(needsFullRead(base({ escalate: true })), true)
  // 전문 판정은 마지막 단계 — 폐기도 확정이다.
  const { window_verdicts: _w, ...full } = base({ basis: 'full', retention: 'discard' })
  assert.equal(needsFullRead(full), false)
})

test('창 판정은 창마다 내용 판정을 남긴다', () => {
  assert.ok(retainProblems(base({ window_verdicts: [] })).some((p) => p.includes('window_verdicts')))
  assert.ok(retainProblems(base({ window_verdicts: [{ i: 0, verdict: 'use', genre: 'science', uses: [] }] })).length)
  assert.ok(retainProblems(base({ window_verdicts: [{ i: 3, verdict: 'use', genre: 'science', uses: ['factual'] }] })).length)
  // 쓸 창이 하나도 없는데 보관이면 모순이다.
  assert.ok(retainProblems(base({ window_verdicts: [{ i: 0, verdict: 'reject', genre: 'data-table', uses: [] }] })).some((p) => p.includes('모순')))
})

test('전문 판정에는 창 키가 없다', () => {
  assert.ok(retainProblems(base({ basis: 'full' })).some((p) => p.includes('window_verdicts')))
  assert.ok(retainProblems(base({ basis: 'excerpt' })).some((p) => p.includes('basis')))
})
