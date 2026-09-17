// apps/web/src/lib/csat/__tests__/axes-steps.test.ts
//
// **두 축이 합쳐지는 것을 막는다.** (학습자 단계 레일 `steps.ts` 는 2026-09-17 학습자 재설계로 걷었다 — docs/csat-learner/DECISIONS.md D8)
//
// 이 두 모델은 화면 다섯이 함께 읽는다. 틀리면 화면마다 다른 색·다른 순서를 말하는데,
// 그건 스타일 문제로 보여서 아무도 버그로 신고하지 않는다. 그래서 여기서 잠근다.

import { describe, expect, it } from 'vitest'

import { AXIS, DENSITY_STEPS, densityBg, densityFg, densityStep } from '../axes'

describe('두 축은 절대 합치지 않는다', () => {
  it('형식과 소재는 다른 색·다른 기호를 쓴다', () => {
    expect(AXIS.format.fg).not.toBe(AXIS.topic.fg)
    expect(AXIS.format.mark).not.toBe(AXIS.topic.mark)
  })

  it('모든 역할의 기호가 서로 다르다 — 색약 사용자는 기호로 읽는다', () => {
    const marks = Object.values(AXIS).map((a) => a.mark)
    expect(new Set(marks).size).toBe(marks.length)
  })

  it('색은 전부 토큰 참조다 — 하드코딩 hex 금지', () => {
    for (const [k, v] of Object.entries(AXIS)) {
      expect(v.fg, `${k}.fg`).toMatch(/^var\(--/)
      expect(v.bg, `${k}.bg`).toMatch(/^var\(--/)
    }
  })

  it('3점 표시에 error 색을 쓰지 않는다 — 어려움은 실패가 아니다', () => {
    expect(AXIS.hard.fg).not.toContain('error')
    expect(AXIS.hard.bg).not.toContain('error')
  })

  it('모든 역할이 라벨과 설명을 갖는다', () => {
    for (const [k, v] of Object.entries(AXIS)) {
      expect(v.label.length, k).toBeGreaterThan(0)
      expect(v.says.length, k).toBeGreaterThan(0)
    }
  })
})

describe('히트맵 농도', () => {
  it('0 은 0 단계 — 안 나온 칸은 빈 칸이다', () => {
    expect(densityStep(0, 9)).toBe(0)
    expect(densityBg(0)).toBe('transparent')
  })

  it('1 번이라도 나오면 0 단계가 아니다 — 「없음」과 구별된다', () => {
    expect(densityStep(1, 9)).toBeGreaterThan(0)
  })

  it('최댓값은 맨 윗 단계다', () => {
    expect(densityStep(9, 9)).toBe(DENSITY_STEPS - 1)
  })

  it('단조 증가한다 — 더 많이 나온 칸이 더 옅어지지 않는다', () => {
    let prev = -1
    for (let n = 0; n <= 9; n += 1) {
      const s = densityStep(n, 9)
      expect(s, `n=${n}`).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })

  it('max 가 1 이면 나온 칸은 맨 윗 단계 — 0 으로 나누지 않는다', () => {
    expect(densityStep(1, 1)).toBe(DENSITY_STEPS - 1)
    expect(() => densityStep(1, 0)).not.toThrow()
  })

  it('진한 칸 위 글자는 배경색으로 뒤집힌다', () => {
    expect(densityFg(0)).toBe('var(--t1)')
    expect(densityFg(DENSITY_STEPS - 1)).toBe('var(--bg)')
  })

  it('농도도 토큰으로 만든다 — 새 색을 만들지 않는다', () => {
    expect(densityBg(3)).toContain('var(--p)')
  })
})

