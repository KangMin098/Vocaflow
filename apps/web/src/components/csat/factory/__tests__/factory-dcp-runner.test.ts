// apps/web/src/components/csat/factory/__tests__/factory-dcp-runner.test.ts
// 1D 클라이언트 경계 — 제출 키는 암호학적 UUID 만(시계 대체 없음) · 모양이 다른 200 은 완료로 올리지 않는다.
import { describe, expect, it } from 'vitest'

import { newMutationKey, readAttemptResponse } from '../FactoryDcpRunner'

const D = '11111111-1111-4111-8111-111111111111'
const A = '22222222-2222-4222-8222-222222222222'
const R = '66666666-6666-4666-8666-666666666666'
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newMutationKey', () => {
  it('randomUUID 를 쓴다', () => expect(newMutationKey({ randomUUID: () => R, getRandomValues: <T,>(b: T) => b })).toBe(R))
  it('randomUUID 가 없으면 getRandomValues 로 v4 를 만든다', () => {
    const k = newMutationKey({ getRandomValues: <T extends ArrayBufferView | null>(b: T) => { (b as unknown as Uint8Array).fill(0xab); return b } })
    expect(k).toMatch(V4)
  })
  it('암호 API 가 없거나 던지면 null(제출 실패) — 시계 기반 키를 만들지 않는다', () => {
    expect(newMutationKey(undefined)).toBeNull()
    expect(newMutationKey({} as never)).toBeNull()
    expect(newMutationKey({ getRandomValues: () => { throw new Error('no entropy') } })).toBeNull()
    expect(newMutationKey({ randomUUID: () => 'not-a-uuid', getRandomValues: <T,>(b: T) => b })).toBeNull()
  })
})

describe('readAttemptResponse — 200 이어도 영수증 · 실제 시도 id 가 없으면 완료가 아니다', () => {
  const ok = { result: { receiptId: R, deliveryId: D, correct: false, csatAttemptId: A, answerKey: { answer: 3 }, evidence: false, replayed: false } }
  it('정상', () => expect(readAttemptResponse(ok, D)).toEqual({ correct: false, csatAttemptId: A, answerKey: { answer: 3 }, replayed: false }))
  it.each([
    [{ result: { correct: true } }], [{ result: { ...ok.result, receiptId: undefined } }], [{ result: { ...ok.result, csatAttemptId: null } }],
    [{ result: { ...ok.result, csatAttemptId: 'x' } }], [{ result: { ...ok.result, deliveryId: A } }], [{ result: { ...ok.result, evidence: true } }],
    [{ result: { ...ok.result, correct: 'false' } }], [{ result: { ...ok.result, replayed: undefined } }], [null], [{}],
  ])('거절 %j', (j) => expect(readAttemptResponse(j, D)).toBeNull())
})
