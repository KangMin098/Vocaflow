// apps/web/src/lib/csat/map/__tests__/load-study-av.test.ts
//
// T-0186 run2 — 지도 자료가 기출 문항별 현재 분석 판본(studyAnalysisVersions)을 공급한다.
// 현재 판본 = 문항 화면 · 판단 결속과 같은 「최신 published 분석 version」 · 보류(embargo) 문항 · 판정 실패는 싣지 않는다 · 한 번에 읽는다(N+1 없음).
import { describe, expect, it } from 'vitest'

import { loadStudyAnalysisVersions } from '../load'

type Row = { item_id: string; version: number | null }
function fakeDb(rows: Row[], opts: { error?: boolean } = {}) {
  const calls: { table: string; select: string; eq: [string, unknown][]; inIds: string[] }[] = []
  const db = {
    from(table: string) {
      const c = { table, select: '', eq: [] as [string, unknown][], inIds: [] as string[] }
      calls.push(c)
      const q = {
        select(s: string) { c.select = s; return q },
        eq(k: string, v: unknown) { c.eq.push([k, v]); return q },
        in(_k: string, ids: string[]) { c.inIds = ids; return q },
        limit() { return q },
        then(res: (v: unknown) => unknown) {
          return Promise.resolve(opts.error ? { data: null, error: { message: 'x' } } : { data: rows.filter((r) => c.inIds.includes(r.item_id)), error: null }).then(res)
        },
      }
      return q
    },
  }
  return { db: db as never, calls }
}
const open = async () => ({ held: new Set<string>(), failed: false })

describe('loadStudyAnalysisVersions', () => {
  it('문항마다 최신 published version 을 싣는다 · 판본 번호만 한 번에 읽는다', async () => {
    const { db, calls } = fakeDb([{ item_id: '2019#23', version: 3 }, { item_id: '2019#23', version: 7 }, { item_id: '2020#24', version: 2 }])
    const out = await loadStudyAnalysisVersions(db, ['2019#23', '2020#24', '2019#23'], open)
    expect(out).toEqual({ '2019#23': 7, '2020#24': 2 })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ table: 'csat_item_analyses', select: 'item_id,version', eq: [['status', 'published']] })
    expect(calls[0].inIds.sort()).toEqual(['2019#23', '2020#24'])
  })
  it('보류 문항은 판본을 싣지 않고 읽지도 않는다', async () => {
    const { db, calls } = fakeDb([{ item_id: '2019#23', version: 7 }, { item_id: '2020#24', version: 2 }])
    const out = await loadStudyAnalysisVersions(db, ['2019#23', '2020#24'], async () => ({ held: new Set(['2020#24']), failed: false }))
    expect(out).toEqual({ '2019#23': 7 })
    expect(calls[0].inIds).toEqual(['2019#23'])
  })
  it('관문 판정 실패 · 조회 오류면 아무것도 싣지 않는다(판본 모름)', async () => {
    const a = fakeDb([{ item_id: '2019#23', version: 7 }])
    expect(await loadStudyAnalysisVersions(a.db, ['2019#23'], async () => ({ held: new Set(['2019#23']), failed: true }))).toEqual({})
    expect(a.calls).toHaveLength(0)
    const b = fakeDb([], { error: true })
    expect(await loadStudyAnalysisVersions(b.db, ['2019#23'], open)).toEqual({})
  })
  it('published 분석이 없거나 형식 밖 version 이면 싣지 않는다', async () => {
    const { db } = fakeDb([{ item_id: '2019#23', version: null }, { item_id: '2020#24', version: 0 }, { item_id: '2021#25', version: 1234567890 }])
    expect(await loadStudyAnalysisVersions(db, ['2019#23', '2020#24', '2021#25', '2022#26'], open)).toEqual({})
  })
  it('후보가 없으면 조회하지 않는다', async () => {
    const { db, calls } = fakeDb([])
    expect(await loadStudyAnalysisVersions(db, [], open)).toEqual({})
    expect(calls).toHaveLength(0)
  })
})
