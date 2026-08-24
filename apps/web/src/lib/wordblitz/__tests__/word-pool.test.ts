// apps/web/src/lib/wordblitz/__tests__/word-pool.test.ts
//
// 회귀 고정: 챕터 보충 후보의 **사전 조회 키는 표면형이 아니라 lemma** 다.
//
// 2026-08-22 실측 — library_book_vocabularies 의 lemma 보유 1,591,690행 중 표면형이
// shared_dictionary 에 정확일치하는 것은 71.3% 뿐이고 lemma 는 100% 였다. 표면형으로 찾던
// 예전 코드는 나머지 28.7% 를 "뜻 없음"으로 버렸고, 게다가 자르기(slice)를 사전 조회 **전에**
// 해서 버퍼(need*3)를 뽑아 두고도 풀을 못 채웠다 — 게임이 조용히 짧아졌다.

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { buildWordBlitzPool } from '../word-pool'

type Row = Record<string, unknown>

/** Supabase 쿼리 빌더 최소 stub — 모든 체인 메서드가 자기 자신을 돌려주고, await 하면 data 를 낸다. */
function makeClient(tables: Record<string, Row[]>, spy: { dictKeys: string[] }) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const self = () => builder
      Object.assign(builder, {
        select: self,
        eq: self,
        not: self,
        order: self,
        limit: self,
        in: (_col: string, vals: string[]) => {
          if (table === 'shared_dictionary') spy.dictKeys = vals
          return builder
        },
        then: (resolve: (v: { data: Row[] }) => unknown) => resolve({ data: tables[table] ?? [] }),
      })
      return builder
    },
  } as unknown as SupabaseClient
}

/** 표면형은 사전에 없고 lemma 만 있는 챕터 어휘 — 실데이터의 28.7% 가 이 모양이다. */
const SURFACE_ONLY = [
  ['abated', 'abate'],
  ['leaves', 'leaf'],
  ['draped', 'drape'],
  ['inscriptions', 'inscription'],
  ['renounced', 'renounce'],
  ['paved', 'pave'],
  ['shorn', 'shear'],
  ['abounding', 'abound'],
  ['abutted', 'abut'],
  ['absolved', 'absolve'],
  ['abbreviated', 'abbreviate'],
  ['accommodated', 'accommodate'],
] as const

const lbvRows: Row[] = SURFACE_ONLY.map(([word, lemma], i) => ({
  word,
  lemma,
  base_learning_value: 100 - i,
}))

const dictRows: Row[] = SURFACE_ONLY.map(([, lemma]) => ({
  word: lemma,
  meaning_ko: `${lemma} 의 뜻`,
}))

describe('buildWordBlitzPool — 챕터 보충', () => {
  it('사전 조회를 표면형이 아니라 lemma 로 한다', async () => {
    const spy = { dictKeys: [] as string[] }
    const client = makeClient({ vocabularies: [], library_book_vocabularies: lbvRows, shared_dictionary: dictRows }, spy)

    await buildWordBlitzPool(client, 'user-1', 'book-1', 3)

    expect(spy.dictKeys).toContain('abate')
    expect(spy.dictKeys).not.toContain('abated')
    expect(spy.dictKeys).toContain('leaf')
    expect(spy.dictKeys).not.toContain('leaves')
  })

  it('표면형이 사전에 없어도 풀이 목표치(12)를 채운다', async () => {
    const spy = { dictKeys: [] as string[] }
    const client = makeClient({ vocabularies: [], library_book_vocabularies: lbvRows, shared_dictionary: dictRows }, spy)

    const pool = await buildWordBlitzPool(client, 'user-1', 'book-1', 3)

    expect(pool).toHaveLength(12)
    expect(pool.every((w) => w.ko.length > 0)).toBe(true)
    // 학습자에게 나가는 것은 표제어다 — 표면형을 그대로 내보내면 뜻과 어긋난다.
    expect(pool.map((w) => w.en)).toContain('abate')
  })

  it('같은 lemma 로 모이는 표면형은 한 번만 담는다', async () => {
    const spy = { dictKeys: [] as string[] }
    const dupRows: Row[] = [
      { word: 'leaves', lemma: 'leaf', base_learning_value: 90 },
      { word: 'leaf', lemma: 'leaf', base_learning_value: 80 },
      { word: 'abated', lemma: 'abate', base_learning_value: 70 },
    ]
    const client = makeClient(
      { vocabularies: [], library_book_vocabularies: dupRows, shared_dictionary: dictRows },
      spy,
    )

    const pool = await buildWordBlitzPool(client, 'user-1', 'book-1', 3)

    expect(pool.filter((w) => w.en === 'leaf')).toHaveLength(1)
    expect(pool).toHaveLength(2)
  })

  it('lemma 가 없는 행(고유명사·미지 토큰)은 후보에서 제외한다', async () => {
    const spy = { dictKeys: [] as string[] }
    const withNull: Row[] = [
      { word: 'jim', lemma: null, base_learning_value: 99 },
      { word: 'abated', lemma: 'abate', base_learning_value: 90 },
    ]
    const client = makeClient(
      { vocabularies: [], library_book_vocabularies: withNull, shared_dictionary: dictRows },
      spy,
    )

    const pool = await buildWordBlitzPool(client, 'user-1', 'book-1', 3)

    expect(spy.dictKeys).not.toContain('jim')
    expect(pool.map((w) => w.en)).toEqual(['abate'])
  })
})
