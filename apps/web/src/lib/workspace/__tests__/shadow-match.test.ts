// apps/web/src/lib/workspace/__tests__/shadow-match.test.ts

import { describe, it, expect } from 'vitest'

import {
  computeShadowMatch,
  normalizeWord,
  tokenizeWords,
  toneForRatio,
} from '../shadow-match'

describe('normalizeWord', () => {
  it('소문자화 + 구두점 제거', () => {
    expect(normalizeWord('Hello,')).toBe('hello')
    expect(normalizeWord('"World!"')).toBe('world')
  })
  it('양끝 아포스트로피 제거하되 내부는 보존', () => {
    expect(normalizeWord("don't")).toBe("don't")
    expect(normalizeWord("'tis")).toBe('tis')
  })
})

describe('tokenizeWords', () => {
  it('구두점을 경계로 분리', () => {
    expect(tokenizeWords('The quick, brown fox.')).toEqual([
      'the',
      'quick',
      'brown',
      'fox',
    ])
  })
  it('빈 문자열 → 빈 배열', () => {
    expect(tokenizeWords('   ')).toEqual([])
  })
})

describe('computeShadowMatch', () => {
  it('완전 일치 → ratio 1', () => {
    const m = computeShadowMatch('the cat sat', 'The cat sat.')
    expect(m.ratio).toBe(1)
    expect(m.matchedKeys.has('cat')).toBe(true)
  })

  it('부분 일치 → 비례 ratio + 맞춘 단어만 matchedKeys', () => {
    const m = computeShadowMatch('the cat sat down', 'the cat')
    expect(m.ratio).toBeCloseTo(0.5, 5)
    expect(m.matchedKeys.has('the')).toBe(true)
    expect(m.matchedKeys.has('cat')).toBe(true)
    expect(m.matchedKeys.has('sat')).toBe(false)
  })

  it('어순 무관 (집합 기반)', () => {
    const m = computeShadowMatch('cat sat mat', 'mat cat sat')
    expect(m.ratio).toBe(1)
  })

  it('빈 발화 → ratio 0, 빈 matchedKeys', () => {
    const m = computeShadowMatch('the cat sat', '')
    expect(m.ratio).toBe(0)
    expect(m.matchedKeys.size).toBe(0)
  })

  it('빈 목표 → ratio 0 (0 나눗셈 방지)', () => {
    const m = computeShadowMatch('', 'anything')
    expect(m.ratio).toBe(0)
  })
})

describe('toneForRatio', () => {
  it('경계값', () => {
    expect(toneForRatio(1)).toBe('great')
    expect(toneForRatio(0.7)).toBe('great')
    expect(toneForRatio(0.69)).toBe('good')
    expect(toneForRatio(0.35)).toBe('good')
    expect(toneForRatio(0.34)).toBe('gentle')
    expect(toneForRatio(0)).toBe('gentle')
  })
})
