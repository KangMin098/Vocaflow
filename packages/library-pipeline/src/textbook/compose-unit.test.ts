// packages/library-pipeline/src/textbook/compose-unit.test.ts
//
// 풀 기반 단원 조합의 계약. 핵심은 **한 단원 안에서 원글이 겹치지 않는 것**이다 —
// 우리 풀은 원글이 적고 문항이 많아서(V6: 17편에서 168문항), 이 규칙이 없으면
// 한 단원의 네 문항이 전부 같은 글에서 나온다. 문항 수는 채워지지만 교재로는 실패다.

import { describe, expect, it } from 'vitest'

import {
  CSAT_ITEM_WORDS,
  DEFAULT_SLOTS,
  composeUnits,
  roundRobinByRef,
  type PoolItem,
} from './compose-unit'
import { type UnitVocab } from './assemble-unit'

let seq = 0
const item = (
  type: 'order' | 'insert',
  ref: string,
  words = 114,
  sentences = type === 'insert' ? 5 : 5,
): PoolItem => ({
  id: `i${seq++}`,
  type,
  ref_id: ref,
  ref_title: `글 ${ref}`,
  v_level: 5,
  passage_words: words,
  body_sentences: sentences,
  payload: {},
  answer_key: {},
})

/** 원글 n편 × 유형별 m문항. */
const pool = (refs: number, per: number): PoolItem[] => {
  seq = 0
  const out: PoolItem[] = []
  for (let r = 0; r < refs; r++)
    for (let k = 0; k < per; k++) {
      out.push(item('order', `r${r}`))
      out.push(item('insert', `r${r}`))
    }
  return out
}

const vocabFor = (refs: number): Map<string, UnitVocab[]> => {
  const m = new Map<string, UnitVocab[]>()
  for (let r = 0; r < refs; r++)
    m.set(
      `r${r}`,
      Array.from({ length: 30 }, (_, i) => ({
        word: `r${r}w${i}`,
        meaning_ko: '뜻',
        v_level: 5,
        first_sentence: null,
        frequency_in_article: 30 - i,
      })),
    )
  return m
}

describe('composeUnits', () => {
  it('한 단원의 문항은 서로 다른 원글에서 온다', () => {
    const { units } = composeUnits(pool(8, 3), vocabFor(8), { band: 5, unitCount: 5 })
    expect(units.length).toBeGreaterThan(0)
    for (const u of units) {
      const refs = u.items.map((i) => i.ref_id)
      expect(new Set(refs).size, `단원 ${u.no}`).toBe(refs.length)
    }
  })

  it('기본 구성은 순서 2 + 삽입 2', () => {
    const { units } = composeUnits(pool(8, 3), vocabFor(8), { band: 5, unitCount: 1 })
    const u = units[0]!
    expect(u.items.filter((i) => i.type === 'order')).toHaveLength(DEFAULT_SLOTS.order)
    expect(u.items.filter((i) => i.type === 'insert')).toHaveLength(DEFAULT_SLOTS.insert)
  })

  it('수능 규격 밖 지문은 쓰지 않고 몇 개를 걸렀는지 보고한다', () => {
    const p = [
      ...pool(8, 2),
      item('order', 'rX', 40), // 너무 짧다 — 순서 단서가 부족해 찍기가 된다
      item('order', 'rY', 900), // 너무 길다
    ]
    const { rejected } = composeUnits(p, vocabFor(8), { band: 5, unitCount: 1 })
    expect(rejected.tooShort).toBe(1)
    expect(rejected.tooLong).toBe(1)
    expect(CSAT_ITEM_WORDS.min).toBe(90)
  })

  it('수능 형식으로 못 바꾸는 삽입은 조합 전에 뺀다', () => {
    // 삽입은 지문이 5문장이어야 ①~⑤ 가 된다. 4문장짜리를 넣으면 단원에 "변환 불가"
    //   자리가 생기고, 그건 교재로 나갈 수 없다 — 조합한 뒤가 아니라 **앞에서** 거른다.
    const p = [...pool(8, 2), item('insert', 'rZ', 114, 4)]
    const { rejected } = composeUnits(p, vocabFor(8), { band: 5, unitCount: 1 })
    expect(rejected.wrongFormat).toBe(1)
  })

  it('원글이 모자라면 멈추고 **이유를 말한다**', () => {
    // 원글 3편이면 순서 2 + 삽입 2 = 원글 4편이 필요해 한 단원도 못 만든다.
    const r = composeUnits(pool(3, 5), vocabFor(3), { band: 5, unitCount: 3 })
    expect(r.units).toHaveLength(0)
    expect(r.stoppedBecause).toContain('원글')
    // 문항이 아니라 원글이 병목이라는 것을 명시해야 한다 — 숫자만 보면 오진한다.
    expect(r.stoppedBecause).toContain('문항 수보다')
  })

  it('원글을 번갈아 써서 뒤 단원이 굶지 않게 한다', () => {
    // 글 4편 × 유형별 5문항. 번갈아 쓰지 않으면 1단원이 한 글을 다 소진한다.
    const r = composeUnits(pool(4, 5), vocabFor(4), { band: 5, unitCount: 5 })
    expect(r.units.length).toBeGreaterThanOrEqual(5)
  })

  it('어휘는 그 단원이 쓴 글에서만 나온다 — 안 읽은 글의 낱말을 외우게 하지 않는다', () => {
    const { units } = composeUnits(pool(8, 3), vocabFor(8), { band: 5, unitCount: 1 })
    const u = units[0]!
    const refs = new Set(u.items.map((i) => i.ref_id))
    for (const v of u.vocabulary) {
      const owner = v.word.match(/^(r\d+)w/)?.[1]
      expect(refs.has(owner!), v.word).toBe(true)
    }
  })

  it('어휘를 글별 쿼터로 나눈다 — 긴 글 하나가 독식하지 않게', () => {
    // 실측: 단원 1의 어휘 12개가 전부 한 글(Black hole)에서 나왔다.
    //   글 A 는 낱말이 많고 빈도도 높고, 나머지 셋은 적다 — 합쳐서 빈도순이면 A 가 다 가져간다.
    const m = new Map()
    m.set('r0', Array.from({ length: 100 }, (_, i) => ({
      word: 'big' + i, meaning_ko: '뜻', v_level: 5, first_sentence: null, frequency_in_article: 100 - i,
    })))
    for (const r of ['r1','r2','r3','r4','r5','r6','r7']) m.set(r, Array.from({ length: 5 }, (_, i) => ({
      word: r + 'w' + i, meaning_ko: '뜻', v_level: 5, first_sentence: null, frequency_in_article: 2,
    })))
    const { units } = composeUnits(pool(8, 3), m, { band: 5, unitCount: 1 })
    const owners = new Set(units[0].vocabulary.map((v) => v.word.startsWith('big') ? 'r0' : v.word.slice(0, 2)))
    expect(owners.size).toBeGreaterThan(1)
  })

  it('같은 낱말이 여러 글에 나오면 한 번만 싣고 빈도를 합친다', () => {
    const shared: UnitVocab[] = [
      { word: 'shared', meaning_ko: '뜻', v_level: 5, first_sentence: null, frequency_in_article: 3 },
    ]
    const m = new Map<string, UnitVocab[]>()
    for (let r = 0; r < 8; r++) m.set(`r${r}`, [...shared])
    const { units } = composeUnits(pool(8, 3), m, { band: 5, unitCount: 1 })
    const hits = units[0]!.vocabulary.filter((v) => v.word === 'shared')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.frequency_in_article).toBe(12) // 글 4편 × 3
  })

  it('소요 시간은 문항 3분 + 어휘 0.25분', () => {
    const { units } = composeUnits(pool(8, 3), vocabFor(8), { band: 5, unitCount: 1 })
    expect(units[0]!.estimated_minutes).toBe(4 * 3 + Math.ceil(20 * 0.25))
  })

  it('출처를 남긴다 — PD·CC 라도 교재에 실으려면 필요하다', () => {
    const { units } = composeUnits(pool(8, 3), vocabFor(8), { band: 5, unitCount: 1 })
    expect(units[0]!.sources).toHaveLength(4)
  })
})

describe('roundRobinByRef', () => {
  it('같은 글의 문항이 연달아 오지 않는다', () => {
    const items = [
      item('order', 'a'),
      item('order', 'a'),
      item('order', 'a'),
      item('order', 'b'),
      item('order', 'c'),
    ]
    const out = roundRobinByRef(items).map((i) => i.ref_id)
    expect(out.slice(0, 3)).toEqual(['a', 'b', 'c'])
  })

  it('개수는 보존한다 — 재배열이지 필터가 아니다', () => {
    const items = pool(3, 2)
    expect(roundRobinByRef(items)).toHaveLength(items.length)
  })
})
