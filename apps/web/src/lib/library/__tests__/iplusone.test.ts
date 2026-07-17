// apps/web/src/lib/library/__tests__/iplusone.test.ts
// judgeIPlusOne 경계값 고정 — 85/95/98 임계 + 그림책 −7pp 보정 + article gap 판정.
// (스냅샷이 아닌 assert — 경계는 명세이므로 diff 허용 없음)

import { describe, it, expect } from 'vitest'
import {
  judgeIPlusOne,
  judgeArticleIPlusOne,
  coverageAtLevel,
} from '../i-plus-one'

const cov = (v: number) => ({ '5': v })

describe('judgeIPlusOne — 텍스트 임계 (85/95/98)', () => {
  it.each([
    [84.9, 'hard'],
    [85, 'challenge'],
    [94.9, 'challenge'],
    [95, 'ideal'],
    [97.9, 'ideal'],
    [98, 'easy'],
  ] as const)('coverage %s → %s', (c, tier) => {
    expect(judgeIPlusOne(cov(c), 5)?.tier).toBe(tier)
  })

  it('미진단(vLevel<1) → null', () => {
    expect(judgeIPlusOne(cov(90), 0)).toBeNull()
  })

  it('coverage 데이터 부재 → null', () => {
    expect(judgeIPlusOne(null, 5)).toBeNull()
    expect(judgeIPlusOne({}, 5)).toBeNull()
  })
})

describe('judgeIPlusOne — 그림책 −7pp 보정 (78/88/91)', () => {
  it.each([
    [77.9, 'hard'],
    [78, 'challenge'],
    [87.9, 'challenge'],
    [88, 'ideal'],
    [90.9, 'ideal'],
    [91, 'easy'],
  ] as const)('illustrated coverage %s → %s', (c, tier) => {
    expect(judgeIPlusOne(cov(c), 5, true)?.tier).toBe(tier)
  })
})

describe('coverageAtLevel — V레벨 클램프 (compute_book_coverage 는 1..10 만 산출)', () => {
  const map = { '1': 10, '10': 99 }
  it('범위 밖 V레벨은 1..10 으로 클램프', () => {
    expect(coverageAtLevel(map, 0)).toBe(10)
    expect(coverageAtLevel(map, 11)).toBe(99)
  })
})

describe('judgeArticleIPlusOne — gap 판정 (미진단 기본 V5)', () => {
  it.each([
    [5, 5, 'easy'], // gap 0
    [6, 5, 'ideal'], // gap +1
    [7, 5, 'challenge'], // gap +2
    [8, 5, 'hard'], // gap +3
    [4, 5, 'easy'], // gap 음수
  ] as const)('articleV %s / userV %s → %s', (a, u, tier) => {
    expect(judgeArticleIPlusOne(a, u)?.tier).toBe(tier)
  })

  it('미진단 userV(0) → effective V5 baseline', () => {
    const fit = judgeArticleIPlusOne(6, 0)
    expect(fit?.effectiveUserVLevel).toBe(5)
    expect(fit?.tier).toBe('ideal')
  })

  it('article_v_level 부재 → null', () => {
    expect(judgeArticleIPlusOne(null, 5)).toBeNull()
  })
})
