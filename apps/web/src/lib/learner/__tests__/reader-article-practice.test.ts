// apps/web/src/lib/learner/__tests__/reader-article-practice.test.ts
// T-0204 — Reader 연습 조회 세 상태: 조회 실패 ≠ 연습 0. 실패도 연습 페이지 링크만(화면 안 재호출 없음).
import { describe, expect, it } from 'vitest'

import { classifyPracticeLookup } from '../reader-article-practice'

const ID = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const HREF = `/practice/article/${ID}`
const ROW = { id: 'b69f287f-7d20-4770-8b88-8dfe0050ad0f', type: 'title', paragraph_idx: 0, payload: { passage: 'p', stem_ko: '제목은?', choices: ['a', 'b', 'c', 'd', 'e'] } }

describe('classifyPracticeLookup', () => {
  it('정상 행 → available + 기존 연습 주소', () => {
    expect(classifyPracticeLookup(ID, { data: [ROW], error: null })).toEqual({ state: 'available', href: HREF })
  })
  it('정상 빈 배열 → none(링크 없음)', () => {
    expect(classifyPracticeLookup(ID, { data: [], error: null })).toEqual({ state: 'none' })
  })
  it('RPC error → failed, 링크는 연습 페이지', () => {
    expect(classifyPracticeLookup(ID, { data: null, error: { code: '57014', message: 'timeout' } })).toEqual({ state: 'failed', href: HREF })
  })
  it('반환 모양이 맞지 않음(null · 객체 · 알 수 없는 행만) → failed — none 으로 뭉개지 않는다', () => {
    expect(classifyPracticeLookup(ID, { data: null, error: null })).toEqual({ state: 'failed', href: HREF })
    expect(classifyPracticeLookup(ID, { data: { rows: [] }, error: null })).toEqual({ state: 'failed', href: HREF })
    expect(classifyPracticeLookup(ID, { data: [{ id: 'x', type: 'summary' }], error: null })).toEqual({ state: 'failed', href: HREF })
  })
  it('상태에 payload · 오류 원문이 실리지 않는다', () => {
    const s = JSON.stringify([classifyPracticeLookup(ID, { data: [ROW], error: null }), classifyPracticeLookup(ID, { data: null, error: { message: 'secret sql' } })])
    expect(s).not.toMatch(/passage|choices|secret|sql/)
  })
})
