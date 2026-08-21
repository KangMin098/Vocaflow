// packages/library-pipeline/src/textbook/bias-review.test.ts
//
// 편향·차별 검사 회귀. 지키려는 것은 **판정하지 않는 것** 이다.
// 이 검사는 사람의 눈이 갈 자리를 좁힐 뿐이고, 아무것도 지우거나 반려하지 않는다.

import { describe, expect, it } from 'vitest'
import {
  GENDERED_OCCUPATIONS,
  measurePronounBalance,
  reviewPassage,
  reviewStock,
} from './bias-review'

const derogatory = new Map([
  ['gypsy', '민족 집단을 낮잡아 이르는 낡은 호칭이다.'],
  ['fatso', '외모를 놓고 사람을 낮잡아 이르는 말이다.'],
])

describe('지문 검토 표시', () => {
  it('성별 표시 직업어를 중립 대안과 함께 표시한다', () => {
    const f = reviewPassage('The chairman thanked every fireman on the coastal crew.')
    const kinds = f.map((x) => x.kind)
    expect(kinds).toEqual(['gendered_occupation', 'gendered_occupation'])
    expect(f[0]!.cue).toBe('chairman')
    expect(f[0]!.alternative).toContain('chairperson')
    expect(f[1]!.cue).toBe('fireman')
  })

  it('하이픈 낱말도 잡는다', () => {
    const f = reviewPassage('The lake is man-made and quite shallow.')
    expect(f.map((x) => x.cue)).toContain('man-made')
  })

  it('비하 표현은 **주입된 목록**으로만 잡는다 — 목록을 코드에 박지 않는다', () => {
    const withList = reviewPassage('A gypsy caravan crossed the valley.', derogatory)
    expect(withList.map((x) => x.kind)).toEqual(['derogatory'])
    expect(withList[0]!.why).toContain('낡은 호칭')
    // 목록 없이 부르면 아무것도 안 잡는다 — 기본값이 조용히 판정하지 않는다.
    expect(reviewPassage('A gypsy caravan crossed the valley.')).toEqual([])
  })

  it('같은 낱말이 여러 번 나와도 한 번만 표시한다 — 같은 자리를 여러 번 보게 하지 않는다', () => {
    const f = reviewPassage('The chairman spoke. The chairman left. The chairman returned.')
    expect(f).toHaveLength(1)
  })

  it('**깨끗한 지문에는 아무 표시도 없다** — 없는 문제를 만들지 않는다', () => {
    expect(
      reviewPassage('Researchers tracked a herd of elk across the valley for three winters.'),
    ).toEqual([])
  })

  it('논쟁적인 짝은 목록에 없다 — 당사자 선호가 갈리는 것을 기계가 정하지 않는다', () => {
    expect(GENDERED_OCCUPATIONS['actress']).toBeUndefined()
  })

  it('인용은 지문에 실제로 있는 문자열이다', () => {
    const text = 'The stewardess greeted every passenger warmly.'
    for (const f of reviewPassage(text)) {
      expect(text.toLowerCase()).toContain(f.cue)
    }
  })
})

describe('성별 대명사 균형', () => {
  it('**지문 하나가 기우는 것은 편향이 아니다** — 표본이 작으면 유의하지 않다', () => {
    const b = measurePronounBalance(['He walked home. He opened his door.'])
    expect(b.male).toBeGreaterThan(b.female)
    expect(b.imbalanced).toBe(false)
  })

  it('여러 글을 모아 놓고 크게 기울면 잡는다', () => {
    const many = Array.from({ length: 40 }, () => 'He said his plan would work for him.')
    const b = measurePronounBalance(many)
    expect(b.male).toBeGreaterThan(100)
    expect(b.female).toBe(0)
    expect(b.imbalanced).toBe(true)
  })

  it('고르면 잡지 않는다', () => {
    const mixed = Array.from({ length: 40 }, () => 'He said her plan would work. She agreed with him.')
    const b = measurePronounBalance(mixed)
    expect(b.imbalanced).toBe(false)
  })

  it('대명사가 하나도 없어도 터지지 않는다', () => {
    const b = measurePronounBalance(['Rain fell all week across the northern valley.'])
    expect(b.male).toBe(0)
    expect(b.female).toBe(0)
    expect(b.imbalanced).toBe(false)
  })
})

describe('재고 검토', () => {
  const stock = [
    'The chairman opened the meeting beside the harbour wall.',
    'Researchers tracked a herd of elk across the valley.',
    'A gypsy caravan crossed the valley before dawn.',
    'The chairman thanked every fireman on the crew.',
  ]

  it('**표시된 지문 수만 사람이 보면 된다** — 전체를 보게 하지 않는다', () => {
    const r = reviewStock(stock, derogatory)
    expect(r.passages).toBe(4)
    expect(r.flagged).toBe(3) // 두 번째는 깨끗하다
  })

  it('가장 자주 걸린 표현을 앞에 낸다 — 어디부터 손볼지', () => {
    const r = reviewStock(stock, derogatory)
    expect(r.topCues[0]!.cue).toBe('chairman')
    expect(r.topCues[0]!.count).toBe(2)
  })

  it('종류별로 나눠 센다', () => {
    const r = reviewStock(stock, derogatory)
    expect(r.byKind.derogatory).toBe(1)
    expect(r.byKind.gendered_occupation).toBe(3) // chairman 2 + fireman 1
  })

  it('빈 재고에서 터지지 않는다', () => {
    const r = reviewStock([])
    expect(r.passages).toBe(0)
    expect(r.flagged).toBe(0)
    expect(r.pronouns.imbalanced).toBe(false)
  })
})
