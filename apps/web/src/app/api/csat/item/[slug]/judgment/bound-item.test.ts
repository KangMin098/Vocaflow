// apps/web/src/app/api/csat/item/[slug]/judgment/bound-item.test.ts
//
// 문항 페이지가 직렬화해 보내는 판단 도구 문항(loadBoundJudgmentItem 반환값)에 정답 자료가 없는지 —
// 실제 개발 DB 읽기 export(G 픽스처 H1811G1#27)를 R-IRRELEVANT 로 바꿔 G 어댑터 경로 전체를 태운다(T-0161 r2 P2).
import { beforeEach, describe, expect, it, vi } from 'vitest'

import fx from '@/lib/csat/binding/__tests__/fixtures/real-items.json'
import type { BindInput } from '@/lib/csat/binding/adapter'
import { leakedAnswerKeys } from '@/lib/csat/judgment/evidence'

vi.mock('server-only', () => ({}))
const st = vi.hoisted(() => ({ lecture: false }))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => (st.lecture ? { sec: 60, cues: 3 } : null) }))

import { loadBoundJudgmentItem } from './bound-item'

const src = (fx as unknown as { rows: BindInput[] }).rows.find((r) => r.item.id === 'H1811G1#27')!
const row = { ...src.item, type_id: 'R-IRRELEVANT' }

function db(over: { analyses?: unknown[]; units?: unknown } = {}) {
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'limit']) chain[k] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
    return chain
  }
  return {
    from: (t: string) => q(t === 'csat_items' ? [row] : over.analyses ?? src.analyses),
    rpc: async (fn: string) => (fn === 'csat_current_units_many' ? { data: over.units === undefined ? [{ ...src.units, item_id: row.id }] : over.units, error: null } : { data: src.inputHash, error: null }),
  } as never
}

describe('loadBoundJudgmentItem — 첫 응답 도구 문항', () => {
  beforeEach(() => { st.lecture = false })

  it('현재 판본 결속이면 JudgmentItem — 직렬화 결과에 정답 별칭(T-0171 ANSWER_KEYS) 없음', async () => {
    const out = await loadBoundJudgmentItem(db(), row.id, 2)
    expect(out.item).not.toBeNull()
    const wire = JSON.parse(JSON.stringify(out.item))
    expect(leakedAnswerKeys(wire)).toEqual([])
    expect(wire.version).toEqual({ unitsVersion: 1, unitsHash: src.units!.units_hash, analysisVersion: 2 })
    // 해설 문장도 실리지 않는다
    const text = JSON.stringify(wire)
    for (const a of src.analyses) for (const c of a.choice_analysis ?? []) if (c.why_correct) expect(text).not.toContain(c.why_correct.slice(0, 30))
  })

  it('해설 극장 판본과 결속 판본이 다르면 null', async () => {
    expect((await loadBoundJudgmentItem(db(), row.id, 3)).item).toBeNull()
  })

  it('현재 단위가 없으면(원문이 바뀜) null', async () => {
    expect((await loadBoundJudgmentItem(db({ units: [] }), row.id, 2)).item).toBeNull()
  })

  it('강의가 있는 문항에는 도구를 붙이지 않는다', async () => {
    st.lecture = true
    expect(await loadBoundJudgmentItem(db(), row.id, 2)).toEqual({ item: null, reason: 'lecture_present' })
  })
})
