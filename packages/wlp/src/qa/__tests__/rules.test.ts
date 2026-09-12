// packages/wlp/src/qa/__tests__/rules.test.ts
// VCB QA rules — R1~R8 핵심 케이스 단위 테스트.
// 옵션 (a): 각 룰 happy path + 1~2 핵심 케이스.

import { describe, it, expect } from 'vitest'
import {
  checkR1Schema,
  checkR2MinDefinitionsKo,
  checkR3LemmaInExamples,
  checkR4KoLengthValid,
  checkR5CefrNgslConsistent,
  checkR6Confidence,
  checkR7Profanity,
  checkR8SelfReference,
  lemmaInExample,
  type QaItem,
} from '../rules'
import { runQaGate } from '../index'

const baseItem: QaItem = {
  queue_id: 1,
  lemma: 'abandon',
  pos: 'VERB',
  ipa: '/əˈbændən/',
  cefr: 'B2',
  definitions_ko: [{ sense: '버리다', register: 'neutral' }],
  definitions_en: [{ sense: 'to leave permanently' }],
  examples: [
    { en: 'She abandoned her old car.', ko: '그녀는 낡은 차를 버렸다.' },
    { en: 'They abandoned the plan.', ko: '그들은 그 계획을 포기했다.' },
  ],
  synonyms: ['desert', 'forsake'],
  antonyms: ['keep', 'retain'],
  collocations: ['abandon hope', 'abandon ship'],
  korean_learner_note: null,
  confidence: 0.85,
}

describe('R1 schema', () => {
  it('passes valid item', () => {
    expect(checkR1Schema(baseItem)).toHaveLength(0)
  })

  it('rejects missing lemma', () => {
    const flags = checkR1Schema({ ...baseItem, lemma: '' })
    expect(flags.some((f) => f.code === 'R1' && f.field === 'lemma')).toBe(true)
  })

  it('rejects invalid pos', () => {
    const flags = checkR1Schema({ ...baseItem, pos: 'verb' as unknown as 'VERB' })
    expect(flags.some((f) => f.field === 'pos')).toBe(true)
  })

  it('rejects out-of-range confidence', () => {
    const flags = checkR1Schema({ ...baseItem, confidence: 1.5 })
    expect(flags.some((f) => f.field === 'confidence')).toBe(true)
  })

  it('rejects null root', () => {
    expect(checkR1Schema(null).length).toBeGreaterThan(0)
  })
})

describe('R2 min definitions_ko', () => {
  it('passes 1 entry', () => {
    expect(checkR2MinDefinitionsKo(baseItem)).toHaveLength(0)
  })

  it('rejects empty', () => {
    const flags = checkR2MinDefinitionsKo({ ...baseItem, definitions_ko: [] })
    expect(flags[0]?.severity).toBe('reject')
  })

  it('flags >3 entries', () => {
    const many = Array(4).fill({ sense: 'x', register: 'neutral' as const })
    const flags = checkR2MinDefinitionsKo({ ...baseItem, definitions_ko: many })
    expect(flags[0]?.severity).toBe('flag')
  })
})

describe('R3 lemma in examples', () => {
  it('passes when lemma appears literally', () => {
    expect(checkR3LemmaInExamples(baseItem)).toHaveLength(0)
  })

  it('passes inflection (running for run)', () => {
    const item: QaItem = {
      ...baseItem,
      lemma: 'run',
      examples: [
        { en: 'He is running fast.', ko: '그는 빠르게 달리고 있다.' },
        { en: 'They ran yesterday.', ko: '그들은 어제 달렸다.' },
      ],
    }
    expect(checkR3LemmaInExamples(item)).toHaveLength(0)
  })

  it('flags when lemma missing', () => {
    const item: QaItem = {
      ...baseItem,
      examples: [
        { en: 'She left her car.', ko: '그녀는 차를 떠났다.' },
        { en: 'They quit the plan.', ko: '그들은 계획을 그만뒀다.' },
      ],
    }
    const flags = checkR3LemmaInExamples(item)
    expect(flags.length).toBe(2)
    expect(flags.every((f) => f.severity === 'flag')).toBe(true)
  })

  it('lemmaInExample handles short lemmas safely', () => {
    expect(lemmaInExample('I go home.', 'go')).toBe(true)
    expect(lemmaInExample('She left.', 'go')).toBe(false)
  })

  it('lemmaInExample recognizes irregular verb forms', () => {
    // production R3 false-positives from cast-2000 run
    expect(lemmaInExample('They fought bravely.', 'fight')).toBe(true)
    expect(lemmaInExample('The lake froze last winter.', 'freeze')).toBe(true)
    expect(lemmaInExample('She hung the picture.', 'hang')).toBe(true)
    expect(lemmaInExample('He bound the books with rope.', 'bind')).toBe(true)
    expect(lemmaInExample('The shirt shrank in the wash.', 'shrink')).toBe(true)
    expect(lemmaInExample('She overcame her fears.', 'overcome')).toBe(true)
    expect(lemmaInExample('He lit the candle.', 'light')).toBe(true)
    expect(lemmaInExample('The hikers walked on their feet.', 'foot')).toBe(true)
  })

  it('lemmaInExample uses word boundaries for irregular forms', () => {
    // "sat" alone should not match inside "satisfy"
    expect(lemmaInExample('Did this satisfy you?', 'sit')).toBe(false)
    // but "sat" as a standalone word should match
    expect(lemmaInExample('She sat down.', 'sit')).toBe(true)
  })
})

describe('R4 ko length', () => {
  it('passes adequate length', () => {
    expect(checkR4KoLengthValid(baseItem)).toHaveLength(0)
  })

  it('flags too short ko', () => {
    const item: QaItem = {
      ...baseItem,
      lemma: 'abandon',
      examples: [
        { en: 'She abandoned it.', ko: '버렸다' },
        { en: 'He abandoned it.', ko: '버려.' },
      ],
    }
    const flags = checkR4KoLengthValid(item)
    expect(flags.length).toBe(2)
  })
})

describe('R5 CEFR ↔ NGSL', () => {
  it('passes when no NGSL rank', () => {
    expect(checkR5CefrNgslConsistent(baseItem, null)).toHaveLength(0)
  })

  it('passes when CEFR matches NGSL band', () => {
    expect(checkR5CefrNgslConsistent({ ...baseItem, cefr: 'A2' }, 200)).toHaveLength(0)
  })

  it('flags when CEFR too high for low rank', () => {
    const flags = checkR5CefrNgslConsistent({ ...baseItem, cefr: 'C2' }, 100)
    expect(flags.length).toBe(1)
    expect(flags[0]?.severity).toBe('flag')
  })
})

describe('R6 confidence', () => {
  it('passes ≥ 0.6', () => {
    expect(checkR6Confidence(baseItem)).toHaveLength(0)
  })

  it('flags < 0.6', () => {
    const flags = checkR6Confidence({ ...baseItem, confidence: 0.5 })
    expect(flags[0]?.severity).toBe('flag')
  })
})

describe('R7 profanity', () => {
  it('passes clean content', () => {
    expect(checkR7Profanity(baseItem, ['fuck', 'shit'])).toHaveLength(0)
  })

  it('rejects when profanity in example.en', () => {
    const item: QaItem = {
      ...baseItem,
      examples: [
        { en: 'What the fuck happened?', ko: '뭐가 일어났냐.' },
        baseItem.examples[1]!,
      ],
    }
    const flags = checkR7Profanity(item, ['fuck'])
    expect(flags.length).toBeGreaterThan(0)
    expect(flags[0]?.severity).toBe('reject')
  })

  it('word boundary — class does not match ass', () => {
    const item: QaItem = {
      ...baseItem,
      examples: [
        { en: 'I go to class.', ko: '나는 수업에 간다.' },
        baseItem.examples[1]!,
      ],
    }
    expect(checkR7Profanity(item, ['ass'])).toHaveLength(0)
  })

  it('대문자 브랜드는 대소문자를 구분한다 — SAT(시험) vs sat(sit 과거형)', () => {
    // 실측 2026-08-17: 호출부가 브랜드 목록과 금칙어 목록을 합쳐 이 규칙에 넘기는데,
    // 브랜드 목록의 시험명 `SAT` 가 소문자 비교 탓에 `sat` 를 잡아 멀쩡한 항목이
    // reject 됐다(사유는 "profanity detected" 로 표시돼 원인 추적도 어려웠다).
    const sat: QaItem = {
      ...baseItem,
      examples: [
        { en: 'She sat amongst her colleagues.', ko: '그녀는 동료들 사이에 앉았다.' },
        baseItem.examples[1]!,
      ],
    }
    expect(checkR7Profanity(sat, ['SAT'])).toHaveLength(0)

    // 진짜 시험명은 여전히 잡아야 한다.
    const exam: QaItem = {
      ...baseItem,
      examples: [
        { en: 'He studied for the SAT last year.', ko: '그는 작년에 SAT 를 준비했다.' },
        baseItem.examples[1]!,
      ],
    }
    expect(checkR7Profanity(exam, ['SAT']).length).toBeGreaterThan(0)
  })

  it('소문자 금칙어는 대소문자 무관하게 잡는다', () => {
    const item: QaItem = {
      ...baseItem,
      examples: [{ en: 'What the FUCK.', ko: '이런.' }, baseItem.examples[1]!],
    }
    expect(checkR7Profanity(item, ['fuck']).length).toBeGreaterThan(0)
  })

  it('empty denylist returns empty', () => {
    expect(checkR7Profanity(baseItem, [])).toHaveLength(0)
  })
})

describe('R8 self-reference auto-fix', () => {
  it('passes when no self-ref', () => {
    const result = checkR8SelfReference(baseItem)
    expect(result.flags).toHaveLength(0)
    expect(result.fixed).toBeUndefined()
  })

  it('fixes synonyms containing lemma', () => {
    const item: QaItem = {
      ...baseItem,
      synonyms: ['abandon', 'desert', 'forsake'],
    }
    const result = checkR8SelfReference(item)
    expect(result.flags[0]?.severity).toBe('auto_fix')
    expect(result.fixed?.synonyms).toEqual(['desert', 'forsake'])
  })

  it('fixes antonyms (case insensitive)', () => {
    const item: QaItem = {
      ...baseItem,
      antonyms: ['ABANDON', 'keep'],
    }
    const result = checkR8SelfReference(item)
    expect(result.fixed?.antonyms).toEqual(['keep'])
  })
})

describe('runQaGate integration', () => {
  it('passes clean item', () => {
    const result = runQaGate(baseItem, {
      ngslRank: 2143,
      profanityDenylist: ['fuck'],
    })
    expect(result.passed).toBe(true)
    expect(result.flags.length).toBe(0)
  })

  it('blocks on R1 reject — short-circuit', () => {
    const result = runQaGate({ ...baseItem, lemma: '' })
    expect(result.passed).toBe(false)
    expect(result.flags.every((f) => f.code === 'R1')).toBe(true)
  })

  it('passes with flags only (not failed)', () => {
    const item = { ...baseItem, confidence: 0.4 }
    const result = runQaGate(item)
    expect(result.passed).toBe(true)
    expect(result.flags.some((f) => f.code === 'R6')).toBe(true)
  })

  it('returns fixed item when R8 triggers', () => {
    const item: QaItem = { ...baseItem, synonyms: ['abandon', 'desert'] }
    const result = runQaGate(item)
    expect(result.fixed_item).toBeDefined()
    expect((result.fixed_item as QaItem).synonyms).toEqual(['desert'])
  })
})
