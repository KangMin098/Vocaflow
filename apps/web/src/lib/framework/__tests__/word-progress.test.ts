// apps/web/src/lib/framework/__tests__/word-progress.test.ts
//
// 면×단계 계산 — **틀려도 예외가 나지 않는 종류**의 코드다.
//
// 통과 기준을 잘못 잡으면 화면은 멀쩡하고 처방만 조용히 어긋난다: 1/1(100%)을 통과로 세면
// 우연히 한 번 맞힌 단어가 다음 면으로 올라가고, 횟수만 세면 2/10 도 통과가 된다.
// 둘 다 "무엇이 부족한가" 라는 이 축의 목적을 무너뜨린다. 그래서 규칙을 테스트로 고정한다.

import { describe, expect, it } from 'vitest'

import { ACCURACY_HOLD_BELOW, HITS_TO_PASS, type WordFrameworkState } from '../flow'
import {
  deriveWordState,
  deriveWordStates,
  facetDistribution,
  isFacetPassed,
  stageOfWord,
  weakestFacet,
  type FacetAttempt,
} from '../word-progress'

/** flashcard = recognize · spellforge = spell · dictation = sound·spell·use (레지스트리 실값) */
const att = (word: string, module: string, isCorrect: boolean): FacetAttempt => ({
  word,
  module,
  isCorrect,
})

describe('isFacetPassed — 횟수와 정답률을 함께 본다', () => {
  it('한 번 맞힌 것은 통과가 아니다 (우연을 통과로 세지 않는다)', () => {
    expect(isFacetPassed(1, 1)).toBe(false)
  })

  it('HITS_TO_PASS 를 채우고 정답률도 넘으면 통과', () => {
    expect(isFacetPassed(HITS_TO_PASS, HITS_TO_PASS)).toBe(true)
  })

  it('여러 번 맞혔어도 그만큼 틀렸으면 통과가 아니다', () => {
    // 2/10 = 20% — 횟수만 세는 구현이었다면 통과였을 것이다
    expect(isFacetPassed(2, 10)).toBe(false)
  })

  it('경계는 ACCURACY_HOLD_BELOW 포함(이상)이다', () => {
    // 7/10 = 0.7 = 기준값 → 통과
    expect(ACCURACY_HOLD_BELOW).toBe(0.7)
    expect(isFacetPassed(7, 10)).toBe(true)
    expect(isFacetPassed(6, 10)).toBe(false)
  })

  it('시도가 없으면 통과가 아니다', () => {
    expect(isFacetPassed(0, 0)).toBe(false)
  })
})

describe('deriveWordState — 활동이 훈련하는 면으로 이력을 접는다', () => {
  it('활동의 면이 그 단어의 면 이력이 된다', () => {
    const s = deriveWordState({
      word: 'bribe',
      attempts: [att('bribe', 'flashcard', true), att('bribe', 'flashcard', true)],
      memory: 'shaky',
      encounters: 12,
    })
    expect(s.passed).toContain('recognize')
    expect(s.accuracy.recognize).toBe(1)
    expect(s.hits.recognize).toBe(2)
  })

  it('한 활동이 여러 면을 훈련하면 그 면들이 모두 올라간다', () => {
    // Dictation 은 sound·spell·use 를 함께 훈련한다(레지스트리 선언)
    const s = deriveWordState({
      word: 'grove',
      attempts: [att('grove', 'dictation', true), att('grove', 'dictation', true)],
      memory: 'stable',
      encounters: 20,
    })
    expect(s.passed.sort()).toEqual(['sound', 'spell', 'use'].sort())
  })

  it('레지스트리에 없는 module 은 세지 않는다 (없는 면이 생기면 안 된다)', () => {
    const s = deriveWordState({
      word: 'ghost',
      attempts: [att('ghost', 'not-an-activity', true), att('ghost', 'flashcard', true)],
      memory: 'new',
      encounters: 3,
    })
    // flashcard 1회뿐이라 통과는 없고, 미상 module 이 면을 만들지도 않았다
    expect(s.passed).toEqual([])
    expect(Object.keys(s.accuracy)).toEqual(['recognize'])
  })

  it('오답도 시도로 세어 정답률을 떨어뜨린다', () => {
    const s = deriveWordState({
      word: 'lumber',
      attempts: [
        att('lumber', 'flashcard', true),
        att('lumber', 'flashcard', false),
        att('lumber', 'flashcard', false),
      ],
      memory: 'risk',
      encounters: 9,
    })
    expect(s.accuracy.recognize).toBeCloseTo(1 / 3, 5)
    expect(s.passed).toEqual([])
  })
})

describe('deriveWordStates — 단어별로 모은다', () => {
  it('대소문자가 달라도 같은 단어다 (결합 키는 소문자 word)', () => {
    const states = deriveWordStates(
      [att('Bribe', 'flashcard', true), att('bribe', 'flashcard', true)],
      new Map([['bribe', { memory: 'shaky' as const, encounters: 10 }]]),
    )
    expect(states).toHaveLength(1)
    expect(states[0].word).toBe('bribe')
    expect(states[0].passed).toContain('recognize')
  })

  it('메타가 없는 단어는 new · 노출 0 으로 둔다 (모르는 것을 아는 척하지 않는다)', () => {
    const [s] = deriveWordStates([att('phantom', 'flashcard', true)], new Map())
    expect(s.memory).toBe('new')
    expect(s.encounters).toBe(0)
  })
})

describe('weakestFacet — 화면이 보여줄 면 하나', () => {
  const base: WordFrameworkState = {
    word: 'bribe',
    passed: [],
    accuracy: {},
    hits: {},
    memory: 'shaky',
    encounters: 12,
  }

  it('아무것도 안 해본 단어는 spine 첫 면부터', () => {
    expect(weakestFacet(base)?.facet).toBe('recognize')
    expect(weakestFacet(base)?.untried).toBe(true)
  })

  it('시도 없는 앞 면이 정답률 낮은 뒤 면보다 먼저다 (앞을 건너뛰지 않는다)', () => {
    // Spell 은 20% 로 낮지만, Recognize 를 아직 안 해봤으면 그것부터다
    const s: WordFrameworkState = {
      ...base,
      accuracy: { spell: 0.2 },
      hits: { spell: 1 },
    }
    expect(weakestFacet(s)?.facet).toBe('recognize')
  })

  it('전부 시도했으면 정답률이 가장 낮은 면', () => {
    const s: WordFrameworkState = {
      ...base,
      passed: ['recognize'],
      accuracy: { recognize: 0.9, spell: 0.5, use: 0.3, fluency: 0.6 },
      hits: { recognize: 9, spell: 5, use: 3, fluency: 6 },
    }
    expect(weakestFacet(s)?.facet).toBe('use')
    expect(weakestFacet(s)?.untried).toBe(false)
  })

  it('spine 을 다 통과했으면 권할 것이 없다', () => {
    const s: WordFrameworkState = {
      ...base,
      passed: ['recognize', 'spell', 'use', 'fluency'],
      accuracy: { recognize: 1, spell: 1, use: 1, fluency: 1 },
    }
    expect(weakestFacet(s)).toBeNull()
  })

  it('cross 면(Sound·Build)은 고르지 않는다 — 단계를 정의하지 않는다', () => {
    const s: WordFrameworkState = {
      ...base,
      passed: ['recognize', 'spell', 'use', 'fluency'],
      accuracy: { sound: 0.1, build: 0.1 },
      hits: { sound: 1, build: 1 },
    }
    // Sound 가 10% 여도 spine 이 끝났으면 null — "발음을 모르면 못 간다" 는 게이트를 만들지 않는다
    expect(weakestFacet(s)).toBeNull()
  })
})

describe('stageOfWord · facetDistribution', () => {
  it('단계는 통과한 spine 면에서 파생된다', () => {
    const s = deriveWordState({
      word: 'capacious',
      attempts: [att('capacious', 'flashcard', true), att('capacious', 'flashcard', true)],
      memory: 'shaky',
      encounters: 10,
    })
    expect(stageOfWord(s)).toBe('recognized')
  })

  it('분포는 시도와 통과를 구분한다 ("안 해봤다" 와 "못한다" 는 다르다)', () => {
    const states = deriveWordStates(
      [
        att('a', 'flashcard', true),
        att('a', 'flashcard', true), // a: recognize 통과
        att('b', 'flashcard', false), // b: recognize 시도했으나 통과 못함
      ],
      new Map(),
    )
    const dist = facetDistribution(states)
    expect(dist.recognize.tried).toBe(2)
    expect(dist.recognize.passed).toBe(1)
    // 아무도 안 해본 면은 둘 다 0 — 0/0 을 100% 로 보이게 하지 않는다
    expect(dist.build).toEqual({ passed: 0, tried: 0 })
  })
})
