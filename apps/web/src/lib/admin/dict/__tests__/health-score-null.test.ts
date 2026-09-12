// apps/web/src/lib/admin/dict/__tests__/health-score-null.test.ts
//
// **못 잰 것을 0 으로 두면 실패가 만점이 된다.**
//
// `reclassifiedCount` 는 화면에 찍히기만 하는 수가 아니라 사전 건강 점수의 **감점 항**으로
// 나눠 쓰인다. 예전에는 질의 경계에서 `count ?? 0` 이었고, 그러면:
//
//   질의 실패 → count=null → 0 → 재분류 비율 0% → 감점 0 → **가장 좋은 점수**
//
// 즉 재는 데 실패할수록 점수가 좋아졌다. 눈으로는 절대 안 보이는 종류의 결함이라
// 회귀로 못 박는다. `0` 과 `null` 은 정반대의 뜻이다 —
// 0 = "규칙과 사람 판단이 일치한다"(좋음) · null = "그 신호를 못 읽었다"(모름).

import { describe, expect, it } from 'vitest'

import { reclassAdjustment, vrlSummaryText } from '../health-score-v2'
import type { VrlClassificationStatsData } from '../types'

const base: VrlClassificationStatsData = {
  totalClassified: 10_000,
  totalUnclassified: 2_000,
  classifiedRatio: 10_000 / 12_000,
  byLevel: [],
  reclassifiedCount: 0,
}

describe('재분류 감점 — 0 과 null 을 가른다', () => {
  it('정정이 실제로 없으면(0) 감점이 없다', () => {
    expect(reclassAdjustment(0, 10_000)).toBe(0)
  })

  it('못 쟀으면(null) 감점을 매기지 않는다 — 추측으로 깎지도 않는다', () => {
    expect(reclassAdjustment(null, 10_000)).toBe(0)
  })

  // ⚠️ 위 둘의 점수가 같다는 것이 바로 위험의 근거다. 숫자가 같으니 화면 문구로만
  //    갈릴 수 있고, 그래서 아래 요약 검사가 이 스펙의 핵심이다.
  it('같은 감점(0)이라도 요약 문구는 달라야 한다', () => {
    expect(vrlSummaryText({ ...base, reclassifiedCount: 0 })).not.toContain('못 잼')
    expect(vrlSummaryText({ ...base, reclassifiedCount: null })).toContain('재분류 못 잼')
  })

  it('임계값 — 15% 초과 -2 · 30% 초과 -5 (경계는 감점 없음)', () => {
    expect(reclassAdjustment(1_500, 10_000)).toBe(0) // 정확히 15% = 미만 아님
    expect(reclassAdjustment(1_501, 10_000)).toBe(-2)
    expect(reclassAdjustment(3_000, 10_000)).toBe(0 - 2) // 정확히 30%
    expect(reclassAdjustment(3_001, 10_000)).toBe(-5)
  })

  it('분모가 0 이면 비율을 만들지 않는다 — 0 으로 나누지 않는다', () => {
    expect(reclassAdjustment(5, 0)).toBe(0)
    expect(reclassAdjustment(null, 0)).toBe(0)
  })

  it('요약은 분류 진행도를 그대로 싣는다', () => {
    expect(vrlSummaryText(base)).toContain('10,000 / 12,000')
  })
})
