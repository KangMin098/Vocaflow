// agents/scripts/__tests__/review.test.mjs
//
// 목적 대조 리뷰 지시문 — 목적 파일을 싣고, 없으면 「목적 파일 없음」을 P2 로 보고하게 한다.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { goalReviewPrompt } from '../review.mjs'

test('목적 파일 내용과 이탈 등급(P1·P2)을 지시문에 싣는다', () => {
  const p = goalReviewPrompt('# 목적\n기록만으로 진단\n# 하지 않을 것\n- 프로필 설문', { base: 'origin/main' })
  assert.match(p, /against origin\/main/)
  assert.match(p, /기록만으로 진단/)
  assert.match(p, /하지 않을 것/)
  assert.match(p, /\[P1\] reintroduces/)
  assert.match(p, /\[P2\] adds features/)
  assert.match(p, /목적 이탈/)
})

test('목적 파일이 없으면 통과로 치지 않고 P2 하나를 내게 한다', () => {
  for (const goal of [null, '', '   ']) {
    assert.match(goalReviewPrompt(goal), /\[P2\] \.agent-goal\.md — 목적 파일 없음/)
  }
})
