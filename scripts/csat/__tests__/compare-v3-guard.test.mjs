// scripts/csat/__tests__/compare-v3-guard.test.mjs
//
// v3 비교 쌍 — 형식 검증 · 해시 결속 공개 가드(실패→성공). 한쪽 탐구 해시가 바뀌면 옛 pass 는 무효.
//   node --test scripts/csat/__tests__/compare-v3-guard.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validatePair } from '../compare-v3-validate.mjs'
import { classifyReview, pairContentHash, PAIR_CRITERIA_VERSION } from '../lib-inquiry-review.mjs'

const sents = (n) => Array.from({ length: n }, (_, i) => ({ n: i + 1, text: `s${i + 1}` }))
const input = {
  pair_id: 'A#1~B#2',
  left: { id: 'A#1', units_hash: 'ua', inquiry_hash: 'ia', sentences: sents(5) },
  right: { id: 'B#2', units_hash: 'ub', inquiry_hash: 'ib', sentences: sents(6) },
}
const out = (over = {}) => ({
  pair_id: 'A#1~B#2', status: 'ok', kind: 'same_structure', writer_run: 'wr-1',
  left: { id: 'A#1', units_hash: 'ua', inquiry_hash: 'ia' }, right: { id: 'B#2', units_hash: 'ub', inquiry_hash: 'ib' },
  focus: '두 문항 모두 처방 문장을 요지로 고른다',
  mappings: [{ left: { sentences: [3], choices: [2] }, right: { sentences: [5], choices: [4] }, relation: '둘 다 진단 뒤의 처방 문장이 요지 선지와 대응한다' }],
  shared_conditions: ['진단 뒤 처방이 이어진다'], decisive_differences: [],
  principle: { level: 'bounded', statement: '처방이 있는 글에서는 처방 범위가 요지다', when_applies: ['진단 뒤 처방'], when_not: ['진단만 있는 글'] },
  limitation: '두 문항 범위의 관찰이다', ...over,
})
const opts = { criteria: PAIR_CRITERIA_VERSION, hashOf: pairContentHash }
const pass = (o, reviewer = 'rv-1') => ({ verdict: 'pass', reviewer, content_hash: pairContentHash(o), criteria: PAIR_CRITERIA_VERSION })

test('정상 쌍은 검증 오류 0', () => assert.deepEqual(validatePair(input, out()), []))

test('결속 해시가 입력과 다르면 오류 · contrast 에 가르는 조건이 없으면 오류 · generalized 금지', () => {
  assert.ok(validatePair(input, out({ left: { id: 'A#1', units_hash: 'ua', inquiry_hash: 'OLD' } })).some((x) => x.includes('inquiry_hash')))
  assert.ok(validatePair(input, out({ kind: 'contrast' })).some((x) => x.includes('decisive_differences 없음')))
  assert.ok(validatePair(input, out({ principle: { ...out().principle, level: 'generalized' } })).some((x) => x.includes('bounded 만')))
  assert.ok(validatePair(input, out({ focus: '이 원리는 항상 통한다' })).some((x) => x.includes('보편 단정')))
  assert.ok(validatePair(input, out({ limitation: '입력 메모는 대비로 보았지만 같은 규칙이다' })).some((x) => x.includes('작성 과정')))
})

test('not_applicable 은 이유만 있으면 통과', () => {
  assert.deepEqual(validatePair(input, { pair_id: 'A#1~B#2', status: 'not_applicable', reason: '같은 함정 이름뿐 판단 구조가 다르다' }), [])
  assert.ok(validatePair(input, { pair_id: 'A#1~B#2', status: 'not_applicable' }).some((x) => x.includes('reason')))
})

test('공개 가드: 독립 pass 만 verified · 자기 검수 · revise 우선 · 한쪽 탐구가 바뀌면 옛 pass 무효', () => {
  const o = out()
  assert.equal(classifyReview(o, [], opts).state, 'unreviewed')
  assert.equal(classifyReview(o, [pass(o, 'wr-1')], opts).state, 'unreviewed')
  assert.equal(classifyReview(o, [pass(o)], opts).state, 'verified')
  assert.equal(classifyReview(o, [pass(o), { ...pass(o, 'rv-2'), verdict: 'revise' }], opts).state, 'revise')
  const changed = out({ right: { id: 'B#2', units_hash: 'ub', inquiry_hash: 'NEW' } })
  assert.equal(classifyReview(changed, [pass(o)], opts).state, 'unreviewed')
})
