// scripts/csat/__tests__/inquiry-review-guard.test.mjs
//
// 공개 가드(v3 M2) — 실패→성공 회귀: 판정 없음 · revise 아님 · 자기 검수 · 낡은 pass · 기준 버전 충돌 · 혼합 판정
//   node --test scripts/csat/__tests__/inquiry-review-guard.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CRITERIA_VERSION, classifyReview, contentHash, stableStringify } from '../lib-inquiry-review.mjs'

const item = {
  id: '2026#34',
  analysis_version: 5,
  status: 'ok',
  writer_run: 'w-01',
  distractors: [{ n: 1, truth: 'false', operation: 'scope', preserved: [{ component: '대상', text: 'law' }], altered: [{ component: '범위', from: 'a', to: 'b' }], note: '범위를 넓혔다' }],
  principle: { statement: 's', when_applies: ['a'], when_not: ['b'] },
}
const h = contentHash(item)
const pass = (o = {}) => ({ verdict: 'pass', reviewer: 'rv-01', content_hash: h, criteria: CRITERIA_VERSION, file: 'review-rv-01.json', ...o })

test('판정이 없으면 unreviewed — 「revise 가 아니다」는 pass 가 아니다', () => {
  assert.equal(classifyReview(item, []).state, 'unreviewed')
})

test('현재 해시에 묶인 독립 pass 면 verified', () => {
  assert.equal(classifyReview(item, [pass()]).state, 'verified')
})

test('검수자 = 작성자면 verified 아님(자기 검수)', () => {
  assert.equal(classifyReview(item, [pass({ reviewer: 'w-01' })]).state, 'unreviewed')
})

test('작성 run 이 없으면 자기 검수를 배제할 수 없어 verified 아님', () => {
  assert.equal(classifyReview({ ...item, writer_run: undefined }, [pass()]).state, 'unreviewed')
})

test('내용이 바뀐 뒤의 옛 pass 는 낡은 판정 — unreviewed', () => {
  const changed = { ...item, principle: { ...item.principle, statement: '고쳐 쓴 원리' } }
  assert.equal(classifyReview(changed, [pass()]).state, 'unreviewed')
})

test('기준 버전이 다른 pass 는 verified 아님', () => {
  assert.equal(classifyReview(item, [pass({ criteria: 'inquiry-v0' })]).state, 'unreviewed')
})

test('같은 내용에 pass 와 revise 가 섞이면 revise — 파일 이름 순서와 무관', () => {
  const rv = pass({ verdict: 'revise', reviewer: 'rv-02', file: 'review-aa.json' })
  assert.equal(classifyReview(item, [pass({ file: 'review-zz.json' }), rv]).state, 'revise')
  assert.equal(classifyReview(item, [rv, pass({ file: 'review-zz.json' })]).state, 'revise')
})

test('해시 결속 없는 v1 판정은 legacy 로만 — verified 로 승격하지 않는다', () => {
  assert.equal(classifyReview(item, [{ verdict: 'pass', reviewer: 'rv-01', file: 'review-rv-01.json' }]).state, 'legacy')
  assert.equal(classifyReview(item, [{ verdict: 'revise', reviewer: 'rv-01', file: 'review-rv-01.json' }]).state, 'revise')
})

test('해시는 키 순서와 무관하고 검수 칸 밖(review_note)은 무시한다', () => {
  const reordered = { principle: item.principle, distractors: item.distractors, status: 'ok', analysis_version: 5, id: '2026#34', review_note: '메모' }
  assert.equal(contentHash(reordered), h)
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }))
})

test('v3 칸은 해시에 들어가고, v3 없는 문항의 해시는 바뀌지 않는다', () => {
  assert.equal(contentHash({ ...item, v3: undefined }), h)
  assert.notEqual(contentHash({ ...item, v3: { requirement: { requested: 'x' } } }), h)
})
