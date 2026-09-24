// apps/web/src/lib/textbook/__tests__/source-live.test.ts
//
// **맨 위 요약의 실시간 수 — RPC 행을 화면 모양으로 접는 규칙.**
//   · 원천 × 등급 행을 합쳐 전체 · 등급별 · 원천별이 서로 맞는다.
//   · 판정 규격 버전이 섞이면 범위로 드러난다(화면이 ⚠️ 를 띄운다).
//   · 첫 화면과 「지금 다시 세기」 단추가 같은 함수를 쓴다 — 여기가 그 함수다.

import { describe, expect, it } from 'vitest'

import { foldLive } from '../source-live'

const AT = '2026-09-24T12:00:00.000Z'

describe('foldLive', () => {
  const rows = [
    { source: 'plos', grade: 'usable', n: '100', with_items: '40', measured_min: '2026-09-24T03:45:00Z', measured_max: '2026-09-24T09:00:00Z', policy_min: 4, policy_max: 4 },
    { source: 'plos', grade: 'blocked', n: 30, with_items: 5, measured_min: '2026-09-24T04:00:00Z', measured_max: '2026-09-24T10:11:00Z', policy_min: 4, policy_max: 4 },
    { source: 'voa', grade: 'unjudged', n: 20, with_items: 0, measured_min: '2026-09-23T22:00:00Z', measured_max: '2026-09-24T01:00:00Z', policy_min: 3, policy_max: 4 },
  ]

  it('전체 · 등급별 · 원천별이 서로 맞는다 (문자열 bigint 도 수로 읽는다)', () => {
    const live = foldLive(rows, AT)
    expect(live.total).toBe(150)
    expect(live.usable).toBe(100)
    expect(live.byGrade).toEqual({ usable: 100, blocked: 30, unjudged: 20 })
    expect(live.withItems).toBe(45)
    expect(live.bySource).toEqual([
      { source: 'plos', total: 130, usable: 100, blocked: 30, unjudged: 0 },
      { source: 'voa', total: 20, usable: 0, blocked: 0, unjudged: 20 },
    ])
    expect(live.bySource.reduce((a, s) => a + s.total, 0)).toBe(live.total)
  })

  it('판정 시각 범위와 규격 버전 범위를 낸다 — 섞였으면 min ≠ max', () => {
    const live = foldLive(rows, AT)
    expect(live.measuredMin).toBe('2026-09-23T22:00:00Z')
    expect(live.measuredMax).toBe('2026-09-24T10:11:00Z')
    expect([live.policyMin, live.policyMax]).toEqual([3, 4])
    expect(live.countedAt).toBe(AT)
  })

  it('행이 없으면 0 이지만 ok 다 — 「판정할 원문이 없다」는 사실이고 못 센 것과 다르다', () => {
    const live = foldLive([], AT)
    expect(live.ok).toBe(true)
    expect(live.total).toBe(0)
    expect(live.measuredMin).toBeNull()
  })
})
