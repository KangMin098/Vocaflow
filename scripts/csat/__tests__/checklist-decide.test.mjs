// scripts/csat/__tests__/checklist-decide.test.mjs
//
// 실험 2 규칙이 checklist-draft.md 의 「규칙」 순서대로 결정하는지 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { decide, missingAnswers, QUESTIONS } from '../checklist-exp/decide.mjs'

const good = {
  blocked: null, needsVisual: false, truncated: false, listOnly: false, linked: true, mainPoint: true,
  narrative: false, notice: false, detachable: true, standsAlone: true, vocabAdjustable: true,
  factsMany: true, stereotypeCore: false, gap: false,
}

test('온전한 답은 빠진 키가 없다 · 빈 답은 전부 빠졌다', () => {
  assert.deepEqual(missingAnswers(good), [])
  assert.deepEqual(missingAnswers(null), QUESTIONS)
  assert.deepEqual(missingAnswers({ ...good, linked: 'yes' }), ['linked'])
})

test('기본은 keep', () => assert.equal(decide(good).retention, 'keep'))

test('차단 장르가 가장 먼저 — 끊긴 글이어도 discard', () => {
  assert.deepEqual(decide({ ...good, blocked: 'pseudoscience', truncated: true }), { retention: 'discard', rule: 'blocked:pseudoscience' })
})

test('끊긴 글은 hold(incomplete-source)', () => {
  assert.equal(decide({ ...good, truncated: true }).hold_reason, 'incomplete-source')
})

test('칸이 없으면 discard', () => {
  assert.equal(decide({ ...good, mainPoint: false, factsMany: false }).rule, 'noSlot')
})

test('목록뿐이라도 공지 목적이 서면 keep', () => {
  assert.equal(decide({ ...good, listOnly: true, mainPoint: false, notice: true }).retention, 'keep')
  assert.equal(decide({ ...good, listOnly: true, mainPoint: false }).rule, 'listOnly')
})

test('문장 사이 연결이 없으면 discard (수치만 되풀이하는 단신)', () => {
  assert.equal(decide({ ...good, linked: false }).rule, 'notLinked')
})

test('가공 셋 다 안 되면 discard · 하나라도 되면 keep', () => {
  assert.equal(decide({ ...good, detachable: false, standsAlone: false, vocabAdjustable: false }).rule, 'noProcessing')
  assert.equal(decide({ ...good, detachable: false, standsAlone: false }).retention, 'keep')
})

test('gap 은 hold(criteria-gap)', () => {
  assert.equal(decide({ ...good, gap: true }).hold_reason, 'criteria-gap')
})

// ── v2 — 연결 세 값 + 걷어낸 뒤 남는 문장 ─────────────────────────────
const { linked: _drop, ...rest } = good
const v2 = { ...rest, linkage: 'strong', strippedRemains: true }

test('v2 온전한 답 · 판 구분', () => {
  assert.deepEqual(missingAnswers(v2), [])
  assert.deepEqual(missingAnswers({ ...v2, linkage: 'weak' }), ['linkage'])
  assert.equal(decide(v2).retention, 'keep')
})

test('v2 연결 없음 → discard', () => assert.equal(decide({ ...v2, linkage: 'none' }).rule, 'linkNone'))

test('v2 가는 연결 + 걷으면 남는 게 없음 → discard (수치 나열 단신)', () => {
  assert.equal(decide({ ...v2, linkage: 'thin', strippedRemains: false }).rule, 'thinAndStripped')
})

test('v2 가는 연결이지만 내용이 남음 → hold(borderline)', () => {
  assert.deepEqual(decide({ ...v2, linkage: 'thin' }), { retention: 'hold', rule: 'linkThin', hold_reason: 'borderline' })
})

test('v2 강한 연결이면 수치가 많아도 keep', () => {
  assert.equal(decide({ ...v2, strippedRemains: false }).retention, 'keep')
})
