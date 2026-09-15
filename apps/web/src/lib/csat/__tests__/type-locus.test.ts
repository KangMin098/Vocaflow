// apps/web/src/lib/csat/__tests__/type-locus.test.ts
//
// 집계가 **통째로 죽는 것**을 막는다. 골격을 못 읽으면 이 모듈은 빈 지도를 남기고 화면은
// 그 절을 안 그린다 — 오류 없이 **조용히 사라진다.** 그게 여기서 가장 위험한 실패다.

import { describe, expect, it } from 'vitest'

import { MIN_SAMPLE } from '../locus-model'
import { typeLocus, typeLocusCoverage } from '../type-locus'

describe('typeLocus — 커밋된 골격에서 센다', () => {
  it('집계가 살아 있다 — 0 이면 골격을 못 읽은 것이다', () => {
    const { types, withSummary } = typeLocusCoverage()
    // 실측 2026-09-15: 25유형이 잡히고 그중 21유형이 표본 8 이상이었다.
    // 바닥은 한참 밑에 둔다 — 정확한 수를 박으면 기출이 늘 때마다 깨진다.
    // 여기서 막으려는 것은 **0** 이다.
    expect(types, '유형이 하나도 안 잡혔다 — 골격에 type_id 가 없거나 파일을 못 읽었다').toBeGreaterThan(15)
    expect(withSummary, '요약이 하나도 안 나왔다').toBeGreaterThan(12)
  })

  it('실제 유형 하나가 제대로 나온다 — R-IRRELEVANT 는 근거가 끝에 몰린다', () => {
    // 실측: 22문항 전부(100%)가 마지막 문장이었다. 이 유형은 «무관한 문장» 이고,
    // 판정 근거가 뒤쪽 되돌아보는 표지에 있다는 것이 유형 리포트의 관찰과도 맞는다.
    const s = typeLocus('R-IRRELEVANT')
    expect(s, 'R-IRRELEVANT 요약이 없다').not.toBeNull()
    expect(s!.n).toBeGreaterThanOrEqual(MIN_SAMPLE)
    expect(s!.top.key).toBe('end')
    expect(s!.lateShare).toBeGreaterThan(0.9)
  })

  it('구간이 언제나 다섯이고 합이 n 과 같다', () => {
    const s = typeLocus('R-BLANK')
    expect(s).not.toBeNull()
    expect(s!.bands).toHaveLength(5)
    expect(s!.bands.reduce((a, b) => a + b.count, 0)).toBe(s!.n)
  })

  it('없는 유형에 null — 지어내지 않는다', () => {
    expect(typeLocus('NOPE')).toBeNull()
    expect(typeLocus(null)).toBeNull()
    expect(typeLocus(undefined)).toBeNull()
    expect(typeLocus('')).toBeNull()
  })

  it('두 번 불러도 같다 — 캐시가 값을 바꾸지 않는다', () => {
    expect(typeLocus('R-INSERT')).toEqual(typeLocus('R-INSERT'))
  })

  it('평균이 0~1 안에 있다', () => {
    for (const t of ['R-BLANK', 'R-INSERT', 'R-NOTICE', 'R-PURPOSE']) {
      const s = typeLocus(t)
      if (!s) continue
      expect(s.avg).toBeGreaterThanOrEqual(0)
      expect(s.avg).toBeLessThanOrEqual(1)
    }
  })
})
