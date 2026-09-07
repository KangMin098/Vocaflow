// packages/library-pipeline/src/textbook/school-band-level.test.ts
//
// **길이가 맞아도 난이도가 그 학년이 아니면 그 학년 교재가 아니다.**
//
// 조립기가 어수만 보던 동안 초·중 창(42~173어) 269편 중 **135편(50%)만** 실제로
// 그 학년 난이도였다. 가장 큰 덩어리가 NASA 사진 설명글 121편 —
// FK 15.37 · 문장 26.3어(중1 교재는 13.9어) · 교육과정 별표 적중 22.4% 인데,
// **100어 남짓이라는 이유로 초6 자리를 지나가고 있었다.**
//
// ⚠️ 이 결함은 아무 오류도 내지 않는다. 단원은 정상으로 조립되고 지문만 어렵다.
//   학년별 난이도를 따로 재기 전에는 보이지 않는다 — 그래서 테스트로 못을 박는다.

import { describe, expect, it } from 'vitest'

import {
  assembleReadingUnit,
  SCHOOL_BAND_MAX_CEFR,
  SCHOOL_BAND_MAX_V,
  type UnitItem,
  type UnitPassage,
  type UnitVocab,
} from './assemble-unit'

const passage = (over: Partial<UnitPassage> = {}): UnitPassage => ({
  ref_id: 'a1',
  title: '표본 지문',
  word_count: 160,
  v_level: 2,
  cefr_level: 'B1',
  display_only: false,
  ...over,
})

const items = (order: number, insert: number): UnitItem[] => [
  ...Array.from({ length: order }, (_, i) => ({
    id: `o${i}`,
    type: 'order' as const,
    paragraph_idx: i,
    stem: '순서',
    answer: 'A',
  })),
  ...Array.from({ length: insert }, (_, i) => ({
    id: `n${i}`,
    type: 'insert' as const,
    paragraph_idx: i,
    stem: '삽입',
    answer: 'B',
  })),
]

const vocab = (n: number): UnitVocab[] =>
  Array.from({ length: n }, (_, i) => ({
    word: `w${i}`,
    meaning_ko: '뜻',
    v_level: 2,
    first_sentence: null,
    frequency_in_article: 1,
  }))

const isBlocked = (u: unknown) => (u as { blocked?: boolean }).blocked === true
const reasonOf = (u: unknown) => (u as { reason?: string }).reason ?? ''

describe('초·중 밴드 난이도 게이트', () => {
  it('길이가 맞아도 C1 지문은 초·중에 못 실린다 — NASA 사진설명이 통과하던 자리', () => {
    const u = assembleReadingUnit(passage({ cefr_level: 'C1' }), items(5, 4), vocab(40))
    expect(isBlocked(u)).toBe(true)
    // 막은 이유가 길이가 아니라 난이도라고 말해야 한다 — 아니면 발췌하러 간다.
    expect(reasonOf(u)).toContain('C1')
    expect(reasonOf(u)).not.toContain('발췌')
  })

  it('C2 도 막는다', () => {
    expect(isBlocked(assembleReadingUnit(passage({ cefr_level: 'C2' }), items(5, 4), vocab(40)))).toBe(true)
  })

  it('B2 는 초·중 상한을 넘는다 — 실측 FK 중앙 12.7 로 중3(10.67)보다 위다', () => {
    expect(isBlocked(assembleReadingUnit(passage({ cefr_level: 'B2' }), items(5, 4), vocab(40)))).toBe(true)
  })

  it('A1~B1 은 통과한다 — 시중 중1 교재가 FK 7.6(≈B1)이다', () => {
    for (const c of ['A1', 'A2', 'B1']) {
      const u = assembleReadingUnit(passage({ cefr_level: c }), items(5, 4), vocab(40))
      expect(isBlocked(u), c).toBe(false)
    }
  })

  it('고등 밴드(V5+)는 이 게이트를 받지 않는다 — 거기서는 C1 이 정상이다', () => {
    const u = assembleReadingUnit(
      passage({ cefr_level: 'C1', v_level: SCHOOL_BAND_MAX_V + 1 }),
      items(5, 4),
      vocab(40)
    )
    expect(isBlocked(u)).toBe(false)
  })

  it('CEFR 을 모르면 막지 않는다 — 모름은 금지가 아니다', () => {
    // 재저작 지문 38편이 여기 해당한다(FK 1.9 — 실제로는 쉬운 글).
    // 모르는 것을 어렵다고 판정하면 그 38편이 통째로 사라진다.
    const u = assembleReadingUnit(passage({ cefr_level: null }), items(5, 4), vocab(40))
    expect(isBlocked(u)).toBe(false)
  })

  it('길이가 먼저다 — 창 밖이면 난이도를 보기 전에 막힌다(발췌하러 가야 한다)', () => {
    const u = assembleReadingUnit(
      passage({ cefr_level: 'C1', word_count: 9_000 }),
      items(5, 4),
      vocab(40)
    )
    expect(isBlocked(u)).toBe(true)
    expect(reasonOf(u)).toContain('발췌')
  })

  it('상한 상수가 B1 이고 초·중 V 상한이 4 다 — 값이 바뀌면 여기서 걸린다', () => {
    expect(SCHOOL_BAND_MAX_CEFR).toBe('B1')
    expect(SCHOOL_BAND_MAX_V).toBe(4)
  })
})
