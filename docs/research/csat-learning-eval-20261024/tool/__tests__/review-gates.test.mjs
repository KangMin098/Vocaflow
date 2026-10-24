// docs/research/csat-learning-eval-20261024/tool/__tests__/review-gates.test.mjs
// 이중 검수 검증기·집계 회귀. 패킷·판정은 합성 문장만 쓴다.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateJudgments, aggregate, AGREEMENT_FLOOR } from '../review-gates.mjs'

const packet = {
  items: [
    { item_id: 'X#1', role: 'candidate', official_answer: 2, sentences: [1, 2, 3, 4, 5].map((i) => ({ i, s: `Synthetic sentence number ${i} talks about a topic in plain words.` })), revision_conflicts: [{ option: 4, labels_by_version: { 1: '부분 사실', 2: '반대 진술' } }] },
    { item_id: 'A#1', role: 'anchor', official_answer: 1, sentences: [1, 2, 3].map((i) => ({ i, s: `Anchor sentence ${i} is synthetic as well for the test.` })), revision_conflicts: [] },
  ],
}
const good = (reviewer, tweak = {}) => ({
  reviewer,
  items: [
    {
      item_id: 'X#1',
      original: { verdict: 'CONFIRM', reason: `${reviewer} 지문 문장 흐름이 끊기지 않고 선지 다섯 개가 온전하다` },
      evidence: { decisive: tweak.decisive || [4, 5], accepted_alternatives: [[3]], reason: `${reviewer} 4·5번이 결론을 다시 말해 정답 선지와 같은 관계를 만든다` },
      near_distractor: { option: tweak.option || 3, failure_code: 'PARTIAL_TRUE', counter_evidence: [2], reason: `${reviewer} 3번 선지는 2번 문장의 세부만 담아 요지가 아니다` },
      anchor_function: { verdict: tweak.verdict || 'DIFFERENT', reason: `${reviewer} 처방 문장이 없어 역할 포괄형과 기능이 다르다`, non_application: `${reviewer} 결론이 두괄로 고정되면 처방 위치 원리가 쓰이지 않는다` },
      revision_options: [{ option: 4, chosen_label: tweak.label || '부분 사실', reason: `${reviewer} 4번은 지문에 있는 진단을 옮겨 부분 사실에 해당한다` }],
    },
    {
      item_id: 'A#1',
      original: { verdict: 'CONFIRM', reason: `${reviewer} 기준 문항 원문이 기계 대조와 같고 조각 혼입이 없다` },
      evidence: { decisive: [3], accepted_alternatives: [], reason: `${reviewer} 마지막 문장이 처방이라 정답 범위를 정한다` },
      near_distractor: { option: 2, failure_code: 'SCOPE_UNDER', counter_evidence: [1], reason: `${reviewer} 2번은 두 축 중 하나만 담아 범위가 좁다` },
      revision_options: [],
    },
  ],
})

test('검증기: 올바른 판정 통과', () => {
  assert.deepEqual(validateJudgments(good('A'), packet), { ok: true, errors: [] })
})

test('검증기: 범위 밖 문장 · 정답을 오답으로 · 코드표 밖 · 짧은 이유 · 상투 이유 · 누락 거부', () => {
  const j = good('A')
  j.items[0].evidence.decisive = [9]
  j.items[0].near_distractor.option = 2
  j.items[0].near_distractor.failure_code = 'MADE_UP'
  j.items[1].original.reason = '짧다'
  j.items[1].evidence.reason = j.items[0].evidence.reason
  j.items[0].revision_options = []
  const r = validateJudgments(j, packet)
  assert.equal(r.ok, false)
  for (const frag of ['범위 밖', '정답 아닌', '코드표 밖', '미만', '상투', '4번 판정 없음']) assert.ok(r.errors.some((e) => e.includes(frag)), frag)
})

test('검증기: 지문 30자 복사 · 패킷 문항 누락 거부', () => {
  const j = good('A')
  j.items[0].evidence.reason = `근거는 ${packet.items[0].sentences[3].s} 이다`
  j.items.pop()
  const r = validateJudgments(j, packet)
  assert.ok(r.errors.some((e) => e.includes('복사')))
  assert.ok(r.errors.some((e) => e.includes('A#1: 판정 없음')))
})

test('집계: 둘 다 같으면 수용, 다르면 미수용, 일치율 0.85 미만 게이트는 반영 안 함', () => {
  const agreed = aggregate(good('A'), good('B'), packet)
  assert.equal(agreed.rows[0].anchor_function.accepted, 'DIFFERENT')
  assert.deepEqual(agreed.rows[0].evidence.gold, [4, 5])
  assert.equal(agreed.rows[0].revision_options[0].accepted_label, '부분 사실')
  assert.equal(agreed.gates.evidence.reflect, true)

  const split = aggregate(good('A'), good('B', { verdict: 'SAME', option: 4, label: '반대 진술', decisive: [1] }), packet)
  assert.equal(split.rows[0].anchor_function.accepted, null)
  assert.equal(split.rows[0].revision_options[0].accepted_label, null)
  assert.equal(split.rows[0].evidence.gold, null)
  assert.equal(split.gates.anchor_function.rate, 0)
  assert.equal(split.gates.anchor_function.reflect, false)
  assert.ok(AGREEMENT_FLOOR === 0.85)
})

test('집계: UNSURE 끼리 일치해도 수용 값은 없다', () => {
  const r = aggregate(good('A', { verdict: 'UNSURE' }), good('B', { verdict: 'UNSURE' }), packet)
  assert.equal(r.rows[0].anchor_function.agree, true)
  assert.equal(r.rows[0].anchor_function.accepted, null)
})
