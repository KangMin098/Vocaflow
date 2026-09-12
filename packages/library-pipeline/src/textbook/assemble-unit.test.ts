// packages/library-pipeline/src/textbook/assemble-unit.test.ts
//
// 단원 조립의 계약을 못 박는다. 특히 **부분 단원을 내지 않는 것**이 핵심이다 —
// 문항 2개짜리 단원이 섞이면 권 전체의 신뢰가 깎이고, 그건 되돌리기 어렵다.

import { describe, expect, it } from 'vitest'

import {
  PASSAGE_WORDS,
  assembleReadingUnit,
  isBlocked,
  pickVocabulary,
  UNIT_READ_WPM,
  type UnitItem,
  type UnitPassage,
  type UnitVocab,
} from './assemble-unit'

const passage = (over: Partial<UnitPassage> = {}): UnitPassage => ({
  ref_id: 'a1',
  title: 'Why Rivers Bend',
  word_count: 200,
  v_level: 5,
  cefr_level: 'B2',
  display_only: false,
  ...over,
})

const items = (orders: number, inserts: number): UnitItem[] => [
  ...Array.from({ length: orders }, (_, i) => ({
    type: 'order' as const,
    paragraph_idx: i,
    payload: {},
    answer_key: {},
  })),
  ...Array.from({ length: inserts }, (_, i) => ({
    type: 'insert' as const,
    paragraph_idx: i,
    payload: {},
    answer_key: {},
  })),
]

const vocab = (n: number, over: Partial<UnitVocab> = {}): UnitVocab[] =>
  Array.from({ length: n }, (_, i) => ({
    word: `w${i}`,
    meaning_ko: `뜻${i}`,
    v_level: 5,
    first_sentence: `Sentence ${i}.`,
    frequency_in_article: n - i,
    ...over,
  }))

describe('assembleReadingUnit', () => {
  it('재료가 충분하면 단원이 나온다', () => {
    const u = assembleReadingUnit(passage(), items(5, 4), vocab(40))
    expect(isBlocked(u)).toBe(false)
    if (isBlocked(u)) return
    expect(u.items.filter((i) => i.type === 'order')).toHaveLength(3)
    expect(u.items.filter((i) => i.type === 'insert')).toHaveLength(2)
    expect(u.vocabulary).toHaveLength(20)
  })


  it('교재 지문 범위를 벗어나면 막는다 — 13,942어짜리는 단원이 아니다', () => {
    // 실측: Prague(wikivoyage) 13,942어가 "127분 단원" 으로 통과하고 있었다.
    const u = assembleReadingUnit(passage({ word_count: 13942 }), items(9, 9), vocab(40))
    expect(isBlocked(u)).toBe(true)
    if (!isBlocked(u)) return
    expect(u.reason).toContain('13,942')
    // 버리라는 게 아니라 발췌하라는 것이다.
    expect(u.reason).toContain('발췌')
  })

  it('길이를 문항보다 먼저 본다 — 문항이 넘쳐도 길면 막힌다', () => {
    const long = assembleReadingUnit(passage({ word_count: 9000 }), items(9, 9), vocab(40))
    if (!isBlocked(long)) throw new Error('막혀야 한다')
    expect(long.reason).toContain('발췌')
    expect(long.reason).not.toContain('문항 부족')
  })

  it('경계값은 통과시킨다', () => {
    for (const w of [PASSAGE_WORDS.min, PASSAGE_WORDS.max]) {
      expect(isBlocked(assembleReadingUnit(passage({ word_count: w }), items(5, 4), vocab(40))), String(w)).toBe(false)
    }
  })

  it('문항이 모자라면 **부분 단원을 내지 않고 막는다**', () => {
    const u = assembleReadingUnit(passage(), items(2, 1), vocab(40))
    expect(isBlocked(u)).toBe(true)
    if (!isBlocked(u)) return
    // 사유에 숫자가 있어야 운영자가 무엇이 모자란지 안다.
    expect(u.reason).toContain('순서 2/3')
    expect(u.reason).toContain('삽입 1/2')
    // 원인까지 적는다 — 이 저장소 실측에서 VOA 는 문단이 짧아 수확량이 0.3/편이었다.
    expect(u.reason).toContain('4~6문장')
  })

  it('ND 지문은 문항이 넘쳐도 막는다 — 본문을 실을 수 없다', () => {
    const u = assembleReadingUnit(passage({ display_only: true }), items(9, 9), vocab(40))
    expect(isBlocked(u)).toBe(true)
    if (!isBlocked(u)) return
    expect(u.reason).toContain('display_only')
    // 버리라는 게 아니라 다른 경로로 보내라는 것이다.
    expect(u.reason).toContain('재저작')
  })

  it('문항을 서로 다른 문단에서 고른다 — 한 문단만 붙들고 끝내지 않도록', () => {
    const spread: UnitItem[] = [
      { type: 'order', paragraph_idx: 0, payload: {}, answer_key: {} },
      { type: 'order', paragraph_idx: 0, payload: {}, answer_key: {} },
      { type: 'order', paragraph_idx: 1, payload: {}, answer_key: {} },
      { type: 'order', paragraph_idx: 2, payload: {}, answer_key: {} },
      { type: 'insert', paragraph_idx: 3, payload: {}, answer_key: {} },
      { type: 'insert', paragraph_idx: 4, payload: {}, answer_key: {} },
    ]
    const u = assembleReadingUnit(passage(), spread, vocab(30))
    if (isBlocked(u)) throw new Error('막히면 안 된다')
    const paras = u.items.filter((i) => i.type === 'order').map((i) => i.paragraph_idx)
    expect(new Set(paras).size).toBe(3)
  })

  it('소요 시간은 읽기 + 문항 + 어휘를 합친다', () => {
    // ⚠️ 어수는 창(100~200) 안이어야 한다. 예전 픽스처는 240어였고, 그때 창이
    //   120~250 이라 통과했다 — 창을 시중 선언 어수(최대 198)로 좁히자 막혔다.
    //   시간 계산을 재는 테스트가 창 때문에 깨진 것이므로 픽스처만 창 안으로 옮긴다.
    const u = assembleReadingUnit(passage({ word_count: 180 }), items(5, 4), vocab(40))
    if (isBlocked(u)) throw new Error('막히면 안 된다')
    // 180/120=1.5→올림 2분 + 5문항×2 + 20어휘×0.25=5분
    expect(u.estimated_minutes).toBe(2 + 10 + 5)
    expect(UNIT_READ_WPM).toBe(120)
  })
})

describe('pickVocabulary', () => {
  it('뜻이 없는 낱말은 뺀다 — 교재에 빈칸이 인쇄된다', () => {
    const pool = [...vocab(3), ...vocab(3, { meaning_ko: null, word: 'empty' })]
    const picked = pickVocabulary(pool, 10, 5)
    expect(picked.every((v) => v.meaning_ko)).toBe(true)
    expect(picked).toHaveLength(3)
  })

  it('밴드 ±1 을 먼저 담는다 — i+1 (Desirable Difficulty)', () => {
    const pool: UnitVocab[] = [
      { word: 'far', meaning_ko: '뜻', v_level: 9, first_sentence: null, frequency_in_article: 99 },
      { word: 'near', meaning_ko: '뜻', v_level: 5, first_sentence: null, frequency_in_article: 1 },
    ]
    // 빈도만 보면 far 가 1위지만, 밴드 밖이라 near 가 먼저다.
    expect(pickVocabulary(pool, 2, 5)[0]!.word).toBe('near')
  })

  it('밴드 안에서는 지문 빈도 순 — 자주 나온 낱말이 먼저다', () => {
    const pool: UnitVocab[] = [
      { word: 'rare', meaning_ko: '뜻', v_level: 5, first_sentence: null, frequency_in_article: 1 },
      { word: 'often', meaning_ko: '뜻', v_level: 6, first_sentence: null, frequency_in_article: 9 },
    ]
    expect(pickVocabulary(pool, 2, 5)[0]!.word).toBe('often')
  })

  it('밴드가 없으면 빈도만 본다 — 조용히 빈 목록을 내지 않는다', () => {
    const picked = pickVocabulary(vocab(5, { v_level: null }), 3, null)
    expect(picked).toHaveLength(3)
  })
})
