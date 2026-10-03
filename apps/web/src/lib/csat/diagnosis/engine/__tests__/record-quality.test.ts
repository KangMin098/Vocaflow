// apps/web/src/lib/csat/diagnosis/engine/__tests__/record-quality.test.ts
//
// Record Quality Layer(rq-1) — 기록 한 회의 입력 신뢰도. 신호를 남기고, 규칙은 그 조합이다.

import { describe, expect, it } from 'vitest'

import { RQ1, recordQuality } from '../record-quality'

const answers = (chosen: (i: number) => number | null, n = 45) => Array.from({ length: n }, (_, i) => ({ no: i + 1, chosen: chosen(i) }))

describe('recordQuality', () => {
  it('45문항 전부 같은 번호 → excluded_pending_review(실측 사례: 전부 ② · 전부 ③)', () => {
    for (const opt of [2, 3]) {
      const q = recordQuality(answers(() => opt))
      expect(q.status).toBe('excluded_pending_review')
      expect(q.signals).toMatchObject({ answered: 45, dominantOption: opt, dominantRatio: 1, longestStreak: 45, distinctOptions: 1 })
    }
  })

  it('정상 풀이처럼 퍼진 기록 → trusted', () => {
    const q = recordQuality(answers((i) => ((i * 7) % 5) + 1))
    expect(q.status).toBe('trusted')
    expect(q.reasons).toEqual([])
  })

  it('한 번호 90% 이상(그러나 전부는 아님) → suspicious', () => {
    const q = recordQuality(answers((i) => (i < 41 ? 4 : (i % 5) + 1)))
    expect(q.signals.dominantRatio).toBeGreaterThanOrEqual(RQ1.dominantRatio)
    expect(q.status).toBe('suspicious')
  })

  it('같은 번호가 길게 이어지면 비율이 낮아도 suspicious', () => {
    const q = recordQuality(answers((i) => (i >= 10 && i < 10 + RQ1.streak ? 5 : (i % 4) + 1)))
    expect(q.signals.longestStreak).toBeGreaterThanOrEqual(RQ1.streak)
    expect(q.status).toBe('suspicious')
  })

  it('답한 문항이 적으면 패턴을 판정하지 않는다(무응답은 세지 않는다)', () => {
    const q = recordQuality(answers((i) => (i < RQ1.minAnswered - 1 ? 1 : null)))
    expect(q.signals.answered).toBe(RQ1.minAnswered - 1)
    expect(q.status).toBe('trusted')
  })

  it('문항 순서가 섞여 들어와도 연속 길이는 번호 순으로 잰다', () => {
    const shuffled = answers((i) => (i < 20 ? 1 : (i % 5) + 1)).reverse()
    expect(recordQuality(shuffled).signals.longestStreak).toBeGreaterThanOrEqual(20)
  })
})
