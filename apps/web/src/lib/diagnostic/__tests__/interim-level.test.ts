// apps/web/src/lib/diagnostic/__tests__/interim-level.test.ts
import { describe, expect, it } from 'vitest'

import { interimLevel, PASS_ACCURACY } from '../interim-level'

const Q = [
  { id: 'a1', target_v_level: 1 },
  { id: 'a2', target_v_level: 1 },
  { id: 'b1', target_v_level: 4 },
  { id: 'b2', target_v_level: 4 },
  { id: 'b3', target_v_level: 4 },
  { id: 'c1', target_v_level: 7 },
  { id: 'c2', target_v_level: 7 },
  { id: 'x', target_v_level: null },
]

describe('interimLevel — 서버 analyze_diagnostic_result 와 같은 규칙', () => {
  it('문턱은 0.70 (서버 SQL `acc >= 0.70`)', () => {
    expect(PASS_ACCURACY).toBe(0.7)
  })

  it('답이 없으면 null — 1 로 칠하지 않는다', () => {
    expect(interimLevel(Q, [])).toBeNull()
  })

  it('정답률 ≥ 0.70 인 가장 높은 레벨', () => {
    const r = [
      { question_id: 'a1', knew: true },
      { question_id: 'b1', knew: true },
      { question_id: 'b2', knew: true },
      { question_id: 'b3', knew: false }, // 4: 2/3 = 0.667 → 미달
      { question_id: 'c1', knew: true },
      { question_id: 'c2', knew: true }, // 7: 1.0
    ]
    expect(interimLevel(Q, r)).toBe(7)
  })

  it('반올림 뒤 비교 — 2/3 은 0.667 로 미달, 7/10 은 통과', () => {
    const q10 = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, target_v_level: 5 }))
    const seven = q10.map((q, i) => ({ question_id: q.id, knew: i < 7 }))
    expect(interimLevel(q10, seven)).toBe(5)
  })

  it('통과한 레벨이 없으면 1 (서버 COALESCE(MAX, 1))', () => {
    expect(interimLevel(Q, [{ question_id: 'b1', knew: false }])).toBe(1)
  })

  it('레벨 없는 문항과 모르는 문항 id 는 세지 않는다', () => {
    expect(
      interimLevel(Q, [
        { question_id: 'x', knew: true },
        { question_id: 'zzz', knew: true },
      ]),
    ).toBe(1)
  })
})
