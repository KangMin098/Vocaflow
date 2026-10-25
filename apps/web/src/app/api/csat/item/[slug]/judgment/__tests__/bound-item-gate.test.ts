// apps/web/src/app/api/csat/item/[slug]/judgment/__tests__/bound-item-gate.test.ts
//
// Reveal Gate(T-0179) — 문항 페이지와 판단 라우트가 함께 쓰는 loadBoundJudgmentItem 이 파일 안에서 embargo-gate 를 거친다.
// 보류 문항 · 보류 시험 · 판정 실패(fail-closed)면 도구 문항을 내지 않고 문항 · 분석 표를 읽지도 않는다.
// 보류가 아니면 결속 결과는 관문 이전과 같다(T-0161 비보류 결속 경로 동일성).
import { beforeEach, describe, expect, it, vi } from 'vitest'

import fx from '@/lib/csat/binding/__tests__/fixtures/real-items.json'
import type { BindInput } from '@/lib/csat/binding/adapter'
import { leakedAnswerKeys } from '@/lib/csat/judgment/evidence'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => null }))

import { loadBoundJudgmentItem } from '../bound-item'

const src = (fx as unknown as { rows: BindInput[] }).rows.find((r) => r.item.id === 'H1811G1#27')!
const row = { ...src.item, type_id: 'R-IRRELEVANT' }

type Gate = { held?: readonly string[]; fail?: boolean }
function db(gate: Gate = {}) {
  const tables: string[] = []
  const rpcs: string[] = []
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'limit']) chain[k] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
    return chain
  }
  const client = {
    from: (t: string) => { tables.push(t); return q(t === 'csat_items' ? [row] : src.analyses) },
    rpc: async (fn: string, args: { p_items?: string[]; p_exams?: string[] }) => {
      rpcs.push(fn)
      if (fn === 'csat_ec_embargoed_items' || fn === 'csat_ec_embargoed_exams') {
        if (gate.fail) return { data: null, error: { message: 'gate boom' } }
        const ids = args.p_items ?? args.p_exams ?? []
        return { data: ids.filter((x) => (gate.held ?? []).includes(x)), error: null }
      }
      if (fn === 'csat_current_units_many') return { data: [{ ...src.units, item_id: row.id }], error: null }
      return { data: src.inputHash, error: null }
    },
  }
  return { client: client as never, tables, rpcs }
}

describe('loadBoundJudgmentItem — Reveal Gate', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('보류가 아니면 관문을 거친 뒤 같은 결속 문항(정답 별칭 없음)', async () => {
    const d = db()
    const out = await loadBoundJudgmentItem(d.client, row.id, 2)
    expect(out.item).not.toBeNull()
    expect(leakedAnswerKeys(JSON.parse(JSON.stringify(out.item)))).toEqual([])
    expect(out.item?.version).toEqual({ unitsVersion: 1, unitsHash: src.units!.units_hash, analysisVersion: 2 })
    expect(d.rpcs).toEqual(expect.arrayContaining(['csat_ec_embargoed_items', 'csat_ec_embargoed_exams']))
  })

  it.each([
    ['보류 문항', { held: [row.id] }],
    ['보류 시험', { held: [row.exam_id] }],
    ['판정 실패(fail-closed)', { fail: true }],
  ] as const)('%s → 도구 문항 없음 · 문항 · 분석 표를 읽지 않는다', async (_n, gate) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const d = db(gate)
    expect(await loadBoundJudgmentItem(d.client, row.id, 2)).toEqual({ item: null, reason: 'held' })
    expect(d.tables).toEqual([])
  })

  it('판정 클라이언트를 따로 넘기면 그쪽으로 판정한다', async () => {
    const data = db()
    const gate = db({ held: [row.id] })
    expect((await loadBoundJudgmentItem(data.client, row.id, 2, { db: gate.client })).item).toBeNull()
    expect(data.rpcs).toEqual([])
  })
})
