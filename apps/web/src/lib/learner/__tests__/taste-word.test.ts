// apps/web/src/lib/learner/__tests__/taste-word.test.ts
//
// 맛보기 단어의 **결정론** 규칙.
//
// 랜덤을 쓰지 않는 이유가 셋인데 전부 눈에 안 보이는 종류라 단언으로 잠근다:
//   ① SSR 과 CSR 이 다른 단어를 그리면 하이드레이션이 깨진다
//   ② 캡처·회귀가 매번 달라지면 판정 도구가 못 된다
//   ③ 같은 날 새로고침마다 단어가 바뀌면 "오늘의 단어" 라는 말이 거짓이 된다

import { describe, expect, it } from 'vitest'

import { pickIndex } from '../taste-word'

const DAY = 86_400_000
/** 2026-08-16 12:00 KST */
const NOW = Date.parse('2026-08-16T03:00:00Z')

describe('pickIndex — 날짜로 정한다', () => {
  it('같은 KST 날짜면 항상 같은 값', () => {
    const a = pickIndex(1000, Date.parse('2026-08-16T00:30:00Z')) // 09:30 KST
    const b = pickIndex(1000, Date.parse('2026-08-16T14:00:00Z')) // 23:00 KST
    expect(a).toBe(b)
  })

  it('날이 바뀌면 값도 바뀐다', () => {
    expect(pickIndex(1000, NOW)).not.toBe(pickIndex(1000, NOW + DAY))
  })

  it('KST 자정을 기준으로 넘어간다 (UTC 자정이 아니다)', () => {
    // 2026-08-15T14:00Z = 08-15 23:00 KST · 2026-08-15T16:00Z = 08-16 01:00 KST
    const before = pickIndex(1000, Date.parse('2026-08-15T14:00:00Z'))
    const after = pickIndex(1000, Date.parse('2026-08-15T16:00:00Z'))
    expect(before).not.toBe(after)
  })

  it('항상 범위 안에 든다', () => {
    for (const size of [1, 2, 7, 137, 1524]) {
      for (let d = 0; d < 40; d++) {
        const i = pickIndex(size, NOW + d * DAY)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(size)
      }
    }
  })

  it('후보가 없어도 죽지 않는다', () => {
    expect(pickIndex(0, NOW)).toBe(0)
    expect(pickIndex(-5, NOW)).toBe(0)
  })

  it('후보를 한 바퀴 도는 동안 같은 값이 반복되지 않는다', () => {
    const size = 30
    const seen = new Set<number>()
    for (let d = 0; d < size; d++) seen.add(pickIndex(size, NOW + d * DAY))
    expect(seen.size).toBe(size)
  })
})
