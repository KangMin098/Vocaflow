// apps/web/src/lib/csat/__tests__/understanding-check.test.ts
import { describe, expect, it } from 'vitest'

import { mergeDissection, withoutHeldCorrectness } from '../continuity'
import { emptyDissectionRecord, type CheckAttempt } from '../dissect'
import { buildChecks, judgeCheck, POSITION_TRAPS, PROPOSITION_TRAPS, reviewDays } from '../understanding-check'

const base = {
  id: '2026#22',
  type_id: 'R-GIST',
  distractors: [
    { n: 1, trap: '부분 사실' },
    { n: 2, trap: '반대 진술' },
    { n: 3, trap: '없는 라벨' },
  ],
  map: { sentenceCount: 9, answerSentences: [6, 7] },
}

describe('buildChecks — 검수된 관계로만 과제를 만든다', () => {
  it('근거 자리 과제: 정답 근거 문장 둘 중 어느 쪽이든 맞다(복수 근거 허용)', () => {
    const ev = buildChecks(base).find((c) => c.kind === 'evidence')!
    expect(ev).toMatchObject({ sentenceCount: 9, correct: [6, 7] })
    expect(judgeCheck(ev, 6)).toBe(true)
    expect(judgeCheck(ev, 7)).toBe(true)
    expect(judgeCheck(ev, 0)).toBe(false)
  })

  it('바뀐 성분 과제: 라벨표 안의 라벨만 정답이 되고 보기 넷은 같은 표에서 · 정답 포함 · 중복 없음', () => {
    const lure = buildChecks(base).find((c) => c.kind === 'lure')
    if (!lure || lure.kind !== 'lure') throw new Error('lure check missing')
    expect(['부분 사실', '반대 진술']).toContain(lure.correct)
    expect(lure.options).toHaveLength(4)
    expect(new Set(lure.options).size).toBe(4)
    expect(lure.options).toContain(lure.correct)
    for (const o of lure.options) expect(PROPOSITION_TRAPS as readonly string[]).toContain(o)
  })

  it('같은 문항은 다시 열어도 같은 과제 · 같은 보기 순서(Math.random 없음)', () => {
    expect(buildChecks(base)).toEqual(buildChecks(base))
  })

  it('위치형 유형은 위치형 라벨표를 쓴다', () => {
    const lure = buildChecks({ ...base, type_id: 'R-ORDER', distractors: [{ n: 4, trap: '어휘 반복 유인' }] }).find((c) => c.kind === 'lure')
    if (!lure || lure.kind !== 'lure') throw new Error('lure check missing')
    for (const o of lure.options) expect(POSITION_TRAPS as readonly string[]).toContain(o)
  })

  it('부정형 선택≠참거짓 유형(오답이 맞는 진술)은 바뀐 성분 과제를 만들지 않는다', () => {
    expect(buildChecks({ ...base, id: '2026#26', type_id: 'R-FACT' }).some((c) => c.kind === 'lure')).toBe(false)
  })

  it('지도가 없거나 근거 자리를 못 찾았으면 근거 과제를 만들지 않는다 · 라벨표 밖 라벨뿐이면 성분 과제도 없다', () => {
    expect(buildChecks({ ...base, map: null, distractors: [{ n: 3, trap: '없는 라벨' }] })).toEqual([])
    expect(buildChecks({ ...base, map: { sentenceCount: 9, answerSentences: [] } }).some((c) => c.kind === 'evidence')).toBe(false)
  })
})

describe('reviewDays — 복습 간격은 이해 확인 결과로', () => {
  const a = (kind: string, tries: number, revealed = false, correct = true) => ({ kind, tries, revealed, correct })
  it('확인하지 않았으면 1일 · 답을 열었으면 1일 · 다 첫 시도면 7일 · 다시 골랐으면 3일', () => {
    expect(reviewDays([])).toBe(1)
    expect(reviewDays([a('evidence', 2, true, false)])).toBe(1)
    expect(reviewDays([a('evidence', 1), a('lure', 1)])).toBe(7)
    expect(reviewDays([a('evidence', 1), a('lure', 3)])).toBe(3)
  })
  it('같은 과제를 다시 풀었으면 마지막 시도로 본다', () => {
    expect(reviewDays([a('evidence', 3), a('evidence', 1)])).toBe(7)
  })
})

describe('기록 — 기기 ↔ 서버 병합 · 보류 회차 가림', () => {
  const att = (id: string, item: string, at: number): CheckAttempt => ({ id, item, kind: 'evidence', correct: true, tries: 1, revealed: false, at, afterExplanation: true })
  it('이해 확인 · 비교 완료는 id 로 합친다(두 기기에서 와도 한 건)', () => {
    const l = { ...emptyDissectionRecord(1), checks: [att('a', '2026#22', 1)], compares: [{ id: 'c', item: '2026#22', other: '2025#22', at: 1 }], updatedAt: 1 }
    const s = { ...emptyDissectionRecord(1), checks: [att('a', '2026#22', 1), att('b', '2025#22', 2)], updatedAt: 2 }
    const m = mergeDissection(l, s)
    expect(m.checks?.map((x) => x.id)).toEqual(['a', 'b'])
    expect(m.compares?.map((x) => x.id)).toEqual(['c'])
  })
  it('보류 회차의 이해 확인 시도는 내보내지 않는다(정오가 실린 칸)', () => {
    const r = { ...emptyDissectionRecord(1), checks: [att('a', 'M2709#22', 1), att('b', '2026#22', 2)] }
    expect(withoutHeldCorrectness(r, (id) => id.startsWith('M2709')).checks?.map((x) => x.id)).toEqual(['b'])
  })
})
