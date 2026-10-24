// docs/research/csat-learning-eval-20261024/tool/__tests__/review-gates-v2.test.mjs
// v2 검증기·집계 회귀(합성 문장만). 합의(pair_agreed)와 반영(reflected) 구분, 조건→verdict 결속, 감사 전 미반영.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateJudgmentsV2, aggregateV2, deriveVerdict } from '../review-gates-v2.mjs'

const packet = {
  items: [
    { item_id: 'X#1', role: 'candidate', official_answer: 2, sentences: [1, 2, 3, 4, 5].map((i) => ({ i, s: `Synthetic sentence number ${i} talks about a topic in plain words.` })), choices: [1, 2, 3, 4, 5].map((n) => ({ n, text: `synthetic option ${n}` })), revision_conflicts: [{ option: 4, labels_by_version: { 1: '부분 사실', 2: '반대 진술' } }] },
    { item_id: 'A#1', role: 'anchor', official_answer: 1, sentences: [{ i: 1, s: 'Anchor only.' }], choices: [], revision_conflicts: [] },
  ],
}
const cond = (who, met = [true, true, true]) => [1, 2, 3].map((k) => ({ id: `C${k}`, met: met[k - 1], evidence: met[k - 1] === 'unsure' ? [] : [k], note: `${who} 조건 ${k} 은 ${k}번 문장으로 판단한다(합성)` }))
const good = (who, t = {}) => ({
  reviewer: who,
  items: [{
    item_id: 'X#1',
    original: { content_verdict: t.content || 'CONFIRM', data_defects: t.defects || ['NONE'], reason: `${who} 지문 흐름이 온전하고 발문이 기출 형식과 같다` },
    anchor_function: { conditions: cond(who, t.met), verdict: deriveVerdict(cond(who, t.met)), counterexample_condition: `${who} 결론 문장을 지우면 C1 이 거짓이 된다` },
    near_distractor: { option: t.option || 3, primary_code: t.code || 'PARTIAL_TRUE', counter_evidence: [2], reason: `${who} 3번은 진단 문장만 옮겨 결론이 아니다`, code_decision_path: `${who} 무관·통념·반대·과대·과소가 아니고 진단 문장이라 6단계` },
    revision_options: [{ option: 4, chosen_label: t.label || '부분 사실', evidence: [4], reason: `${who} 4번 선지 명제는 4번 문장에 있으므로 부분 사실` }],
  }],
})

test('verdict 는 조건에서 정해진다', () => {
  assert.equal(deriveVerdict(cond('x')), 'SAME')
  assert.equal(deriveVerdict(cond('x', [true, false, true])), 'DIFFERENT')
  assert.equal(deriveVerdict(cond('x', [true, 'unsure', true])), 'UNSURE')
})

test('검증기 v2: 올바른 판정 통과 · 기준 문항은 판정 대상 아님', () => {
  assert.deepEqual(validateJudgmentsV2(good('A'), packet), { ok: true, errors: [] })
  const j = good('A')
  j.items.push({ item_id: 'A#1' })
  assert.ok(validateJudgmentsV2(j, packet).errors.some((e) => e.includes('판정 대상(후보)이 아님')))
})

test('검증기 v2: 조건과 어긋난 verdict · NONE+결함 · 코드표 밖 · 결정 경로 누락 거부', () => {
  const j = good('A')
  j.items[0].anchor_function.verdict = 'SAME'
  j.items[0].anchor_function.conditions[1].met = false
  j.items[0].original.data_defects = ['NONE', 'FOOTNOTE_IN_CHOICE']
  j.items[0].near_distractor.primary_code = 'MADE_UP'
  delete j.items[0].near_distractor.code_decision_path
  const r = validateJudgmentsV2(j, packet)
  for (const frag of ['조건에서 정해지는 값', 'NONE 과', '코드표 밖', 'code_decision_path']) assert.ok(r.errors.some((e) => e.includes(frag)), frag)
})

test('집계 v2: 합의해도 감사 전에는 반영 값이 없다', () => {
  const g = aggregateV2(good('A'), good('B'), packet)
  assert.equal(g.rows[0].anchor_function.pair_agreed_value, 'SAME')
  assert.equal(g.rows[0].anchor_function.reflected_value, null)
  assert.equal(g.gates.anchor_function.meets_floor, true)
  assert.equal(g.gates.anchor_function.reflect, false)
})

test('집계 v2: 하한 충족 + 감사 통과일 때만 반영, 감사 실패면 미반영', () => {
  const pass = { original: { pass: true }, anchor_function: { pass: true }, near_distractor: { pass: false, failed_items: ['X#1'] }, revision_options: { pass: true } }
  const g = aggregateV2(good('A', { defects: ['FOOTNOTE_IN_CHOICE'] }), good('B', { defects: ['CHOICES_ARE_FRAGMENTS'] }), packet, pass)
  assert.equal(g.rows[0].original.reflected_value, 'CONFIRM')
  assert.deepEqual(g.rows[0].original.data_defects_union, ['FOOTNOTE_IN_CHOICE', 'CHOICES_ARE_FRAGMENTS'])
  assert.equal(g.rows[0].anchor_function.reflected_value, 'SAME')
  assert.equal(g.rows[0].near_distractor.reflected_value, null)
  assert.equal(g.rows[0].revision_options[0].reflected_value, '부분 사실')
  const split = aggregateV2(good('A'), good('B', { met: [true, false, true], label: '반대 진술', code: 'SCOPE_UNDER' }), packet, pass)
  assert.equal(split.gates.anchor_function.meets_floor, false)
  assert.equal(split.rows[0].anchor_function.reflected_value, null)
  assert.equal(split.rows[0].revision_options[0].pair_agreed_value, null)
})
