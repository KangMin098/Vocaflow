// apps/web/src/lib/knowledge/__tests__/find-outcome.test.ts
import { describe, expect, it } from 'vitest'
import { CONFIRM_ITEMS, findOutcome, type FindAttemptRow, type FindTarget } from '../find-outcome'

const T = (itemRef: string, taskKey = 'claim-support'): FindTarget => ({ itemRef, taskKey })
const A = (itemRef: string, isCorrect: boolean | null, extra: Partial<FindAttemptRow> = {}): FindAttemptRow => ({
  itemRef, taskKey: 'claim-support', userId: 'u', phase: 'practice', isCorrect, synthetic: false, helpLevel: 'independent',
  afterViewedFirst: false, afterExplanation: false, ...extra,
})

describe('findOutcome — 한 번의 오답으로 확정하지 않는다', () => {
  it('기록 없음 → 아직 확인 안 함', () => {
    expect(findOutcome([T('2022#20'), T('2023#20')], []).state).toBe('untried')
  })
  it('한 문항 오답 → 확인 중(확정 아님)', () => {
    const r = findOutcome([T('2022#20'), T('2023#20')], [A('2022#20', false)])
    expect(r.state).toBe('in_progress')
    expect(r.message).toContain('한 문항으로는 판단하지 않아요')
  })
  it('확인 문항이 1개뿐인 단계는 문항을 더 기다린다고 말한다', () => {
    const r = findOutcome([T('2022#20')], [A('2022#20', false)])
    expect(r.state).toBe('in_progress')
    expect(r.needsMoreItems).toBe(true)
    expect(r.message).toContain('더 준비되면')
  })
  it(`서로 다른 ${CONFIRM_ITEMS}문항 모두 막힘 → 요구 확인됨`, () => {
    expect(findOutcome([T('2022#20'), T('2023#20')], [A('2022#20', false), A('2023#20', false)]).state).toBe('confirmed_need')
  })
  it('둘 다 맞힘 → 지금은 괜찮아 보임 · 섞이면 엇갈림', () => {
    expect(findOutcome([T('a'), T('b')], [A('a', true), A('b', true)]).state).toBe('not_needed')
    expect(findOutcome([T('a'), T('b')], [A('a', true), A('b', false)]).state).toBe('mixed')
  })
  it('해설 먼저 · 해설 뒤 · 합성 · 시각 불확실 · 정오 없음은 확인 근거가 아니다', () => {
    const rows = [
      A('a', false, { helpLevel: 'viewed_first' }),
      A('b', false, { afterExplanation: true }),
      A('a', false, { synthetic: true }),
      A('b', false, { timingUncertain: true }),
      A('a', null),
    ]
    expect(findOutcome([T('a'), T('b')], rows).state).toBe('untried')
  })
  it('이 단계 확인 과제가 아닌 문항 · 다른 과제 키 · 연습 외 단계는 세지 않는다', () => {
    const rows = [A('z', false), A('a', false, { taskKey: 'cohesion-link' }), A('b', false, { phase: 'transfer' })]
    expect(findOutcome([T('a'), T('b')], rows).state).toBe('untried')
  })
})
