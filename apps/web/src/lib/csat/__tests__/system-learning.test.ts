// apps/web/src/lib/csat/__tests__/system-learning.test.ts
//
// T-0091 학습 정리 — 시스템 자료만으로 정리 · 미준비는 「준비 중」(가짜 과제 없음) · 다음 활동은 실제 갈 수 있는 것만.
import { describe, expect, it } from 'vitest'

import { buildLearningSummary, compareWithModel, hasWrittenHistory, PROCEDURE_CARDS, relationCardsFor } from '../system-learning'

const base = {
  goal: { relation: ' 근거가 판단을 받친다 ', units: ['sentence', 'table_cell', 'sentence'] as never },
  principle: { statement: '원리', when_applies: ['조건'], when_not: ['반례'] } as never,
  rejects: [
    { key: 'analysis:reject:2', title: '2', body: ['', '배제 이유 2'] },
    { key: 'analysis:reject:4', title: '4', body: [] },
  ],
  checks: [] as { kind: 'evidence' | 'lure' }[],
  checkScene: (k: 'evidence' | 'lure') => (k === 'lure' ? 'judgment' : 'meaning') as never,
  hasCompare: false,
  hasLecture: false,
}

describe('buildLearningSummary', () => {
  it('제공 관계 · 근거 단위 · 검수 오답 설명만 담는다(빈 설명은 버린다)', () => {
    const s = buildLearningSummary(base)
    expect(s.relation).toBe('근거가 판단을 받친다')
    expect(s.units).toEqual(['문장', '표 칸'])
    expect(s.evidence).toEqual([{ key: 'analysis:reject:2', choice: 2, title: '2', body: '배제 이유 2', sentences: [] }])
  })
  it('제공된 문장 연결만 선택지에 붙이며 중복·잘못된 번호는 쓰지 않는다', () => {
    const s = buildLearningSummary({ ...base, choiceEvidence: [{ n: 2, sentences: [2, 3, 2, 0, -1, 1.5] }] })
    expect(s.evidence[0].sentences).toEqual([2, 3])
    expect(s.evidence[0].body).toBe('배제 이유 2')
  })
  it('사전 구축 확인 과제가 없으면 preparing — 풀기 활동을 만들지 않는다', () => {
    const s = buildLearningSummary(base)
    expect(s.checks).toEqual({ readiness: 'preparing', count: 0, scene: null })
    expect(s.next.map((n) => n.id)).toEqual(['evidence'])
  })
  it('준비된 과제가 있을 때만 prepared · 그 과제 장면으로 간다', () => {
    const s = buildLearningSummary({ ...base, checks: [{ kind: 'lure' }, { kind: 'evidence' }], hasCompare: true, hasLecture: true })
    expect(s.checks).toEqual({ readiness: 'prepared', count: 2, scene: 'judgment' })
    expect(s.next.map((n) => n.id)).toEqual(['evidence', 'checks', 'compare', 'lecture'])
  })
  it('자료가 전혀 없으면 모두 비어 있다(지어내지 않는다)', () => {
    const s = buildLearningSummary({ ...base, goal: null, principle: null, rejects: [] })
    expect(s.relation).toBeNull()
    expect(s.principle).toBeNull()
    expect(s.evidence).toEqual([])
    expect(s.next).toEqual([])
  })
  it('같은 입력이면 같은 정리', () => {
    expect(buildLearningSummary(base)).toEqual(buildLearningSummary(base))
  })
})

describe('과거 기록 · 안내 연습 카드', () => {
  it('hasWrittenHistory', () => {
    expect(hasWrittenHistory({ explanations: 0, notes: 0 })).toBe(false)
    expect(hasWrittenHistory({ explanations: 0, notes: 0, meaning: 1 })).toBe(true)
  })
  it('제목 단계는 제목 관계 카드, 나머지는 근거 관계 카드', () => {
    expect(relationCardsFor('title')[0].id).toBe('metaphor')
    expect(relationCardsFor('topic')[0].id).toBe('reason')
    expect(PROCEDURE_CARDS.length).toBeGreaterThan(0)
  })
  it('시범 대조는 셈만 한 사실 문장이다(1-기반 표기)', () => {
    expect(compareWithModel(0, [2, 3], [0, 2, 5])).toBe('시범과 같은 문장 1·3 · 내가 더 고른 문장 4 · 시범만 짚은 문장 6')
    expect(compareWithModel(null, [], [])).toBe('시범과 같은 문장 없음 · 내가 더 고른 문장 없음 · 시범만 짚은 문장 없음')
  })
})
