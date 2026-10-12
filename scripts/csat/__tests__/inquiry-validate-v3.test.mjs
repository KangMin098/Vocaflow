// scripts/csat/__tests__/inquiry-validate-v3.test.mjs
//
// v3 검증기 — 실패→성공 회귀: 영어 표현이 근거 문장에 실재 · 선지 3칸 규칙 · v1/v3 내용 판정 일관성(2026-10-12 rv-v3-02 결함)
//   node --test scripts/csat/__tests__/inquiry-validate-v3.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateItem, validateV3 } from '../inquiry-drain-validate.mjs'

const input = {
  id: 'T#1',
  type_id: 'R-GIST',
  analysis_version: 1,
  distractors_are_true: false,
  slot_type: false,
  answer: 2,
  units_hash: 'u1',
  sentences: [
    { n: 1, text: 'Cooperation is often undervalued in organizations.' },
    { n: 2, text: 'This means leaders should reward collaborative work explicitly.' },
  ],
  choices: ['협력은 과소평가된다', '협력을 명시적으로 보상해야 한다', 'c', 'd', 'e'],
}
const dist = (n, truth) => ({
  n,
  truth,
  operation: truth === 'false' ? 'scope' : 'scope',
  preserved: [{ component: '대상', text: '협력' }],
  altered: truth === 'false' ? [{ component: '범위', from: '일부', to: '전부' }] : [],
  note: '지문의 범위를 바꾼 선택지로 판단 조건이 다르다',
})
const choice = (n, over = {}) => ({
  n,
  selected_as_answer: n === 2,
  content_truth: n === 2 ? 'true' : 'false',
  requirement_fit: n === 2 ? 'satisfies' : 'fails',
  decisive: '2번 문장의 처방이 요지라는 조건으로 갈린다',
  sentences: [2],
  ...over,
})
const out = (over = {}) => ({
  id: 'T#1',
  analysis_version: 1,
  status: 'ok',
  distractors: [1, 3, 4, 5].map((n) => dist(n, 'false')),
  principle: { statement: '요지는 처방 문장이 다루는 범위 전체를 담는다', when_applies: ['처방이 두 축을 다룰 때'], when_not: ['진단만 있는 글일 때는 진단이 요지다'] },
  v3: {
    units_hash: 'u1',
    requirement: { requested: '글의 요지를 고른다', polarity: 'positive', conditions: ['처방의 범위'] },
    meanings: [
      { id: 'm1', sentences: [1], expression: 'often undervalued', meaning_ko: '자주 실제보다 낮게 평가된다', scope: { kind: 'quantity', note: 'often 이 일반화를 한정한다' } },
      { id: 'm2', sentences: [2], expression: 'reward collaborative work explicitly', meaning_ko: '협력한 일을 드러내어 보상한다', scope: { kind: 'none' } },
    ],
    choices: [1, 2, 3, 4, 5].map((n) => choice(n)),
    design: { claims: [{ basis: 'source_observation', text: '2번 문장이 처방이다', sentences: [2] }, { basis: 'design_hypothesis', text: '진단과 처방을 구별하는 과제로 볼 수 있다', sentences: [1, 2] }], limitation: '실제 출제 과정은 확인할 수 없다' },
  },
  ...over,
})

test('정상 출력은 v1 · v3 모두 오류 0', () => {
  assert.deepEqual(validateItem(input, out()), [])
  assert.deepEqual(validateV3(input, out()), [])
})

test('영어 표현이 그 근거 문장에 없으면 오류', () => {
  const o = out()
  o.v3.meanings[0].expression = 'rarely praised'
  assert.ok(validateV3(input, o).some((x) => x.includes('m1 expression')))
})

test('정답 선택지에 요구 미충족 · 비선정에 충족이면 오류', () => {
  const o = out()
  o.v3.choices[1].requirement_fit = 'fails'
  assert.ok(validateV3(input, o).some((x) => x.includes('정답인데 요구 충족 fails')))
})

test('v1 은 거짓, v3 는 참이면 오류(모순) — 둘 다 참이면 통과(v3 문항은 v1 에 true 허용)', () => {
  const o = out()
  o.v3.choices[0] = choice(1, { content_truth: 'true' })
  assert.ok(validateV3(input, o).some((x) => x.includes('선지 1 내용 판정이 v1(false) 과 v3(true)')))
  o.distractors[0] = dist(1, 'true')
  assert.deepEqual(validateV3(input, o), [])
  assert.deepEqual(validateItem(input, o), [])
})

test('v3 없는 v1 문항은 여전히 거짓/확정 불가만(요지류 비선정에 true 를 쓰면 오류)', () => {
  const o = out({ v3: undefined })
  o.distractors[0] = dist(1, 'true')
  assert.ok(validateItem(input, o).some((x) => x.includes('truth=true')))
})

test('설계에 가설이 없으면 오류', () => {
  const o = out()
  o.v3.design.claims = o.v3.design.claims.filter((c) => c.basis !== 'design_hypothesis')
  assert.ok(validateV3(input, o).some((x) => x.includes('설계 가설')))
})

test('심경(R-MOOD) 두 낱말이 모두 틀린 선지는 preserved 를 비울 수 있다(note 에 사유 필수)', () => {
  const mood = { ...input, type_id: 'R-MOOD' }
  const o = out({ v3: undefined })
  o.distractors[0] = { ...o.distractors[0], preserved: [], note: '두 칸 모두 틀린 감정이라 모든 칸이 바뀌어 남은 지문 성분이 없다' }
  assert.deepEqual(validateItem(mood, o), [])
  o.distractors[0] = { ...o.distractors[0], note: '두 칸 모두 틀린 감정이다(사유 문구 없음)' }
  assert.ok(validateItem(mood, o).some((x) => x.includes('preserved 없음')))
})

test('부정 범위인데 부정어가 인용 밖이면 오류 — note 가 문장의 부정어를 짚으면 통과(rv-v3-3738 M2606#21)', () => {
  const neg = { ...input, sentences: [input.sentences[0], { n: 2, text: 'These feelings are not based on something you can take credit for.' }] }
  const o = out()
  o.v3.meanings[1] = { id: 'm2', sentences: [2], expression: 'something you can take credit for', meaning_ko: '내 공으로 돌릴 수 있는 것에 근거하지 않는다', scope: { kind: 'negation', note: '부정이 근거 전체에 걸린다' } }
  o.v3.choices = o.v3.choices.map((c) => ({ ...c, sentences: [1] }))
  assert.ok(validateV3(neg, o).some((x) => x.includes('m2 부정 범위인데')))
  o.v3.meanings[1].scope.note = 'not 이 근거 전체를 부정한다'
  assert.ok(!validateV3(neg, o).some((x) => x.includes('부정 범위인데')))
  o.v3.meanings[1].expression = 'are not based on something'
  o.v3.meanings[1].scope.note = '부정이 근거 전체에 걸린다'
  assert.ok(!validateV3(neg, o).some((x) => x.includes('부정 범위인데')))
})
