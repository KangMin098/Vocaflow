// packages/library-pipeline/src/textbook/kid-source.test.ts
//
// **"게시 가능" 을 세는 법 — 이 저장소가 세 번 틀린 규칙이다.**
//
//   ① `publishable = true` 만 셈       → 방금 담은 미판정 행이 빠져 칸이 영영 안 참
//   ② `.not(col,'eq','false')` 로 셈   → NULL 이 UNKNOWN 이라 조용히 사라짐(449 vs 507)
//   ③ 스크립트와 화면이 각자 셈         → 같은 날 잰 값이 서로 어긋남
//
// 그래서 셈은 이 순수 함수 하나가 하고, 여기서 그 계약을 고정한다.

import { describe, expect, it } from 'vitest'

import {
  KID_BANDS,
  KID_SOURCE_TARGET,
  buildKidInventory,
  kidFeedLabel,
  type KidBand,
} from './kid-source'

const counts = (over: Partial<Record<KidBand, { held: number; quarantined: number }>> = {}) =>
  Object.fromEntries(
    KID_BANDS.map((b) => [b, over[b] ?? { held: 0, quarantined: 0 }])
  ) as Record<KidBand, { held: number; quarantined: number }>

describe('초·중 재고 셈', () => {
  it('게시 가능 = 적재 − 격리 (미판정은 격리가 아니다)', () => {
    // 실측 2026-09-05 의 그 숫자 그대로 — 652 적재 · 145 격리 · 미판정 58.
    // ①·②로 세면 449 가 나왔고, 옳은 값은 507 이다.
    const inv = buildKidInventory(counts({ '초3~4': { held: 652, quarantined: 145 } }), {
      held: 0,
      quarantined: 0,
    })
    expect(inv.bands[0]!.publishable).toBe(507)
  })

  it('각색분을 합계에 넣되 칸에는 섞지 않는다 — 다른 경로다', () => {
    const inv = buildKidInventory(counts({ 중3: { held: 100, quarantined: 10 } }), {
      held: 82,
      quarantined: 2,
    })
    expect(inv.adapted.publishable).toBe(80)
    expect(inv.total).toBe(90 + 80)
    expect(inv.bands.every((b) => b.band !== ('각색' as KidBand))).toBe(true)
  })

  it('남은 몫은 음수가 되지 않는다 — 넘긴 칸은 0 이지 "-30" 이 아니다', () => {
    const inv = buildKidInventory(
      counts({ '초5~6': { held: 2000, quarantined: 0 } }),
      { held: 0, quarantined: 0 }
    )
    expect(inv.bands[1]!.publishable).toBe(2000)
    expect(inv.bands[1]!.quotaLeft).toBe(0)
  })

  it('적재가 0 이면 격리율도 0 이다 — 0 으로 나누지 않는다', () => {
    const inv = buildKidInventory(counts(), { held: 0, quarantined: 0 })
    expect(inv.bands.every((b) => b.quarantinedPct === 0)).toBe(true)
    expect(inv.pct).toBe(0)
  })

  it('목표는 고등 재고의 절반이고, 칸 몫은 그 목표를 다섯으로 나눈 값이다', () => {
    expect(KID_SOURCE_TARGET.total).toBe(KID_SOURCE_TARGET.highSchoolStock / 2)
    expect(KID_SOURCE_TARGET.quotaPerBand * KID_BANDS.length).toBe(KID_SOURCE_TARGET.total)
  })

  it('조회 조건과 화면 표기가 한 곳에서 나온다', () => {
    // 라벨을 손으로 쓰면 조회는 `PD 발췌 · 초3~4` 를 찾는데 화면은 `초3-4` 를 보여주는 날이 온다.
    expect(kidFeedLabel('초3~4')).toBe('PD 발췌 · 초3~4')
  })
})
