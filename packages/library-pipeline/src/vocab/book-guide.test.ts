// packages/library-pipeline/src/vocab/book-guide.test.ts
//
// 설명 지면이 **광고가 되지 않는가**.
//
// 시중 머리말은 "난이도를 일정하게 배분해 두었습니다" 라고 쓰고 수치를 적지 않는다 —
// 학습자가 확인할 방법이 없다. 우리 규칙은 **근거 없는 주장은 싣지 않는다** 이고,
// 그 규칙이 실제로 지켜지는지를 여기서 잠근다.

import { describe, expect, it } from 'vitest'
import { buildBookGuide } from './book-guide'
import { typesetVocabSet, type TypesetWord } from './typeset'

const rich: TypesetWord[] = [
  {
    word: 'regular',
    meaningsKo: [
      { pos: 'adjective', meaning: '규칙적인', example: 'He was a regular customer.', example_ko: '그는 단골이었다.' },
      { pos: 'noun', meaning: '단골', example: null, example_ko: null },
    ],
    ipa: '/x/',
    synonyms: ['steady'],
    collocations: ['regular basis'],
    koreanLearnerNote: '잦다는 뜻이 아니다.',
    inflectionForms: ['regulars', 'regularly'],
  },
  {
    word: 'steady',
    meaningsKo: [{ pos: 'adjective', meaning: '꾸준한', example: 'Keep a steady pace.', example_ko: '꾸준히.' }],
  },
  { word: 'detect', meaningsKo: [{ pos: 'verb', meaning: '감지하다', example: null, example_ko: null }] },
  { word: 'decade', meaningKo: '10년' },
]

const bare: TypesetWord[] = [
  { word: 'aa', meaningKo: '가' },
  { word: 'bb', meaningKo: '나' },
  { word: 'cc', meaningKo: '다' },
]

describe('주장 — 근거 없으면 싣지 않는다', () => {
  it('재료가 없는 권은 예문·그물·주석 주장을 만들지 않는다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, reviewEveryDays: 0, words: bare }))
    const keys = g.claims.map((c) => c.key)
    expect(keys).not.toContain('In context')
    expect(keys).not.toContain('Networked')
    expect(keys).not.toContain('Annotated')
    expect(keys).not.toContain('Split senses')
    expect(keys).not.toContain('Recycled')
  })

  it('모든 주장에 근거 수치가 붙어 있다 — 빈 주장은 존재하지 않는다', () => {
    for (const words of [rich, bare]) {
      const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, words }))
      for (const c of g.claims) {
        expect(c.evidence.trim(), `${c.key} 에 근거가 없다`).not.toBe('')
        expect(c.evidence).toMatch(/\d/)
      }
    }
  })

  it('번호는 남은 주장 기준으로 다시 매겨진다 — 빠진 자리에 구멍이 없다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, reviewEveryDays: 0, words: bare }))
    expect(g.claims.map((c) => c.n)).toEqual(g.claims.map((_, i) => i + 1))
  })

  it('재료가 있으면 근거가 실제 값을 말한다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, words: rich }))
    const paced = g.claims.find((c) => c.key === 'Paced')!
    expect(paced.evidence).toBe('하루 2개 · 2일')
    const ctx = g.claims.find((c) => c.key === 'In context')!
    // 넷 중 둘이 예문을 갖는다 (regular · steady).
    expect(ctx.evidence).toContain('50%')
  })
})

describe('FEATURES — 없는 칸을 가리키지 않는다', () => {
  it('이 권이 채운 장치만 콜아웃한다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, reviewEveryDays: 0, words: bare }))
    const ids = g.features.map((f) => f.id)
    expect(ids).not.toContain('exampleEn')
    expect(ids).not.toContain('usageNote')
    expect(ids).not.toContain('derivedRow')
  })

  it('콜아웃은 일곱 개를 넘지 않는다 — 넘으면 지면이 번호밭이 된다', () => {
    const g = buildBookGuide(
      typesetVocabSet({ title: 'T', wordsPerDay: 2, principle: '어근 하나가 챕터 하나', words: rich }),
    )
    expect(g.features.length).toBeLessThanOrEqual(7)
    expect(g.features.length).toBeGreaterThan(0)
  })

  it('번호는 1부터 이어진다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, words: rich }))
    expect(g.features.map((f) => f.n)).toEqual(g.features.map((_, i) => i + 1))
  })

  it('설명이 라벨을 되풀이하지 않는다 — "예문: 예문입니다" 는 설명이 아니다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, words: rich }))
    for (const f of g.features) {
      expect(f.says.length).toBeGreaterThan(10)
      expect(f.says, `${f.id} 의 설명이 라벨 반복이다`).not.toBe(f.label)
    }
  })

  it('표본 표제어는 **이 권의 실제 첫 항목**이다 — 지어낸 예를 쓰지 않는다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: 'T', wordsPerDay: 2, words: rich }))
    expect(g.sampleWord).toBe('regular')
  })
})

describe('머리 질문', () => {
  it('그 권의 제목을 묻는다', () => {
    const g = buildBookGuide(typesetVocabSet({ title: '수능 필수 2,000', wordsPerDay: 2, words: rich }))
    expect(g.question).toContain('수능 필수 2,000')
  })
})
