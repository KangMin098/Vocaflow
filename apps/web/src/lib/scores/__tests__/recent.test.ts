// apps/web/src/lib/scores/__tests__/recent.test.ts
//
// 최근 기록 날짜 라벨 계약.
//
// 왜 테스트가 필요한가: 허브가 보여주던 '오늘 / 어제 / 4일 전' 은 상수 문자열이었다.
// 실데이터로 바꾸면 라벨을 **계산**해야 하는데, 여기서 흔한 실수가 두 가지다 —
//   ① 경과 시간(24시간)으로 세기: 23:50 학습과 다음날 00:10 조회가 "오늘" 이 된다
//   ② UTC 로 세기: 한국 09:00 이전 학습이 전부 "어제" 로 밀린다
// 둘 다 학습자에게는 "내가 언제 했는지" 가 틀리게 보이는 것이고, 스트릭 감각을 망친다.

import { describe, expect, it } from 'vitest'

import { relativeDayLabel } from '../recent'

/** KST 로 해석되는 시각을 UTC ISO 로 — 테스트 의도를 읽히게 하는 헬퍼. */
function kst(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(Date.UTC(y, m - 1, d, h - 9, min)).toISOString()
}

describe('relativeDayLabel', () => {
  const now = new Date(kst(2026, 8, 12, 14, 30)) // KST 2026-08-12 14:30

  it('같은 KST 날짜는 오늘', () => {
    expect(relativeDayLabel(kst(2026, 8, 12, 0, 5), now)).toBe('오늘')
    expect(relativeDayLabel(kst(2026, 8, 12, 14, 29), now)).toBe('오늘')
  })

  it('KST 날짜 경계로 센다 — 20분 차이도 날짜가 넘어가면 어제다', () => {
    // 어제 23:50 학습 → 오늘 00:10 에 보면 "20분 전" 이 아니라 "어제"
    const justAfterMidnight = new Date(kst(2026, 8, 12, 0, 10))
    expect(relativeDayLabel(kst(2026, 8, 11, 23, 50), justAfterMidnight)).toBe('어제')
  })

  it('KST 오전(UTC 로는 전날)에 한 학습이 어제로 밀리지 않는다', () => {
    // KST 08:00 = UTC 전날 23:00. UTC 로 날짜를 세면 "어제" 가 된다 — 그 실수를 막는다.
    expect(relativeDayLabel(kst(2026, 8, 12, 8, 0), now)).toBe('오늘')
  })

  it('이틀 이상은 N일 전', () => {
    expect(relativeDayLabel(kst(2026, 8, 11, 20, 0), now)).toBe('어제')
    expect(relativeDayLabel(kst(2026, 8, 10, 20, 0), now)).toBe('2일 전')
    expect(relativeDayLabel(kst(2026, 8, 8, 1, 0), now)).toBe('4일 전')
  })

  it('미래 시각도 오늘로 다룬다 (시계 오차가 "-1일 전" 으로 새지 않게)', () => {
    expect(relativeDayLabel(kst(2026, 8, 13, 9, 0), now)).toBe('오늘')
  })
})
