// scripts/csat/__tests__/body-suspect.test.mjs
//
// 지문 의심 판정(lib-body-suspect) 회귀. 학평 원문은 커밋하지 않으므로 합성 지문으로 모양만 재현한다.
import assert from 'node:assert/strict'
import test from 'node:test'
import { suspectBody } from '../lib-body-suspect.mjs'

const SUMMARY_HAKPYEONG = 'People trust stories more than numbers. They remember them longer. Stories are (A) to recall because they are (B) with emotion.'

test('학평 요약문: ______ 가 지워져도 (A)·(B) 자리가 있으면 의심하지 않는다', () => {
  assert.equal(suspectBody(SUMMARY_HAKPYEONG, 'R-SUMMARY'), false)
})

test('요약문: (A)·(B) 중 하나라도 없고 빈칸 표시도 없으면 여전히 의심한다', () => {
  assert.equal(suspectBody('Stories are (A) to recall because they carry emotion.', 'R-SUMMARY'), true)
  assert.equal(suspectBody('Stories are easy to recall because they carry emotion.', 'R-SUMMARY'), true)
})

test('수능·모평 요약문처럼 ______ 가 남아 있으면 그대로 통과한다', () => {
  assert.equal(suspectBody('Stories are (A) ______ to recall because they are (B) ______ with emotion.', 'R-SUMMARY'), false)
})

test('빈칸 추론은 (A)·(B) 예외를 받지 않는다 — 빈칸 위치가 곧 정답 근거다', () => {
  assert.equal(suspectBody('Stories are (A) to recall because they are (B) with emotion.', 'R-BLANK'), true)
})

test('요약문이라도 다른 의심 신호(홀로 선 마침표)는 그대로 잡는다', () => {
  assert.equal(suspectBody('People trust stories . I more than numbers. Stories are (A) to recall and (B) with emotion.', 'R-SUMMARY'), true)
})
