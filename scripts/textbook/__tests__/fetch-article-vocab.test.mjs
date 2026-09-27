// scripts/textbook/__tests__/fetch-article-vocab.test.mjs
//
// **`fetchArticleVocab` — 행이 없는 지문을 조판이 조용히 「어휘 0」으로 내보내지 않는가.**
//
// 발행 안 된 글의 어휘 행을 걷어낼 계획(docs/reports/lav-retention-2026-09-24.md §4)에서
// 조판은 행 없는 지문을 만날 수 있다. 지키는 성질:
//   ① 행이 다 있으면 재생성을 한 번도 부르지 않는다
//   ② 없는 지문만 다시 만들고, **그 지문만** 다시 받아 합친다
//   ③ 상한을 넘는 몫은 만들지 않는다(밴드 전체 비교 손잡이가 수만 편을 재분석하지 않게)
//   ④ 재생성이 실패해도 조판은 계속된다 — 나머지 지문의 행은 그대로 돌아온다

import { describe, expect, it } from 'vitest'

import { fetchArticleVocab } from '../volume-pool.mjs'

/** 표를 흉내 낸다 — `ensure` 가 부르면 그 지문의 행이 생긴다. */
function fakeStore(initial) {
  const table = new Map(Object.entries(initial))
  const calls = { fetch: [], ensure: [] }
  const fetch = async (_db, _table, _cols, _col, refs) => {
    calls.fetch.push([...refs])
    return refs.flatMap((id) => (table.get(id) ?? []).map((word) => ({ library_article_id: id, word })))
  }
  const ensureWith = (fails = new Set()) => async (id) => {
    calls.ensure.push(id)
    if (fails.has(id)) throw new Error('본문이 비어')
    table.set(id, ['rebuilt'])
    return { rebuilt: true, rows: 1, vrlWarning: null }
  }
  return { fetch, ensureWith, calls }
}

describe('fetchArticleVocab', () => {
  it('① 행이 다 있으면 재생성을 부르지 않는다', async () => {
    const s = fakeStore({ a: ['x'], b: ['y'] })
    const rows = await fetchArticleVocab(null, 'cols', ['a', 'b'], { fetch: s.fetch, ensure: s.ensureWith() })
    expect(rows).toHaveLength(2)
    expect(s.calls.ensure).toEqual([])
    expect(s.calls.fetch).toHaveLength(1)
  })

  it('② 없는 지문만 다시 만들고 그것만 다시 받는다', async () => {
    const s = fakeStore({ a: ['x'] })
    const rows = await fetchArticleVocab(null, 'cols', ['a', 'b'], { fetch: s.fetch, ensure: s.ensureWith() })
    expect(s.calls.ensure).toEqual(['b'])
    expect(s.calls.fetch[1]).toEqual(['b'])
    expect(rows.map((r) => `${r.library_article_id}:${r.word}`).sort()).toEqual(['a:x', 'b:rebuilt'])
  })

  it('③ 상한을 넘는 몫은 만들지 않는다', async () => {
    const s = fakeStore({})
    await fetchArticleVocab(null, 'cols', ['a', 'b', 'c'], {
      fetch: s.fetch,
      ensure: s.ensureWith(),
      maxRebuild: 2,
    })
    expect(s.calls.ensure).toEqual(['a', 'b'])
  })

  it('④ 재생성 실패는 조판을 멈추지 않는다', async () => {
    const s = fakeStore({ a: ['x'] })
    const rows = await fetchArticleVocab(null, 'cols', ['a', 'b', 'c'], {
      fetch: s.fetch,
      ensure: s.ensureWith(new Set(['b'])),
    })
    expect(rows.map((r) => r.library_article_id).sort()).toEqual(['a', 'c'])
  })
})
