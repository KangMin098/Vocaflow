// apps/web/src/lib/csat/__tests__/embargo-gate.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  assertRevealAllowed, canRevealExam, canRevealItem, canRevealSession, embargoedItemIds, isItemHeld, isRevealHeld, isTypeHeld,
  loadRevealScope, revealHeldResponse,
} from '../embargo-gate'

type Rpc = (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null }

/** rpc 와 from(...).select().order().limit()/in()/gt() 체인만 흉내낸다 */
function fakeDb(rpc: Rpc, tables: Record<string, Record<string, unknown>[]> = {}): SupabaseClient {
  const from = (t: string) => {
    let rows = tables[t] ?? []
    const q = {
      select: () => q, order: () => q, not: () => q, eq: () => q,
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return q },
      gt: () => { rows = []; return q },
      limit: () => Promise.resolve({ data: rows, error: null }),
    }
    return q
  }
  return { rpc: async (fn: string, args: Record<string, unknown>) => rpc(fn, args), from } as unknown as SupabaseClient
}

const HELD_EXAM = 'M2099'
const rpcOk: Rpc = (fn, args) => {
  if (fn === 'csat_ec_embargoed_exams') return { data: (args.p_exams as string[]).filter((e) => e === HELD_EXAM), error: null }
  if (fn === 'csat_ec_embargoed_items') return { data: (args.p_items as string[]).filter((i) => i.startsWith(HELD_EXAM)), error: null }
  if (fn === 'csat_ec_reveal_state') return { data: { exam_embargoed: args.p_session === 's-held' }, error: null }
  return { data: null, error: { message: 'unknown' } }
}
const rpcFail: Rpc = () => ({ data: null, error: { message: 'boom' } })

describe('embargo-gate — 판정', () => {
  it('보류 시험 · 문항 · 세션을 가른다', async () => {
    const db = fakeDb(rpcOk)
    expect(await canRevealExam(HELD_EXAM, { db })).toBe(false)
    expect(await canRevealExam('M2509', { db })).toBe(true)
    expect(await canRevealItem(`${HELD_EXAM}#18`, { db })).toBe(false)
    expect(await canRevealItem('M2509#18', { db })).toBe(true)
    expect(await canRevealSession('s-held', { db })).toBe(false)
    expect(await canRevealSession('s-open', { db })).toBe(true)
  })

  it('fail-closed — RPC 오류면 전부 보류', async () => {
    const db = fakeDb(rpcFail, { csat_exams: [{ id: 'M2509' }] })
    expect(await canRevealExam('M2509', { db })).toBe(false)
    expect(await canRevealSession('s-open', { db })).toBe(false)
    expect([...(await embargoedItemIds(['M2509#1', 'M2509#2'], { db }))]).toEqual(['M2509#1', 'M2509#2'])
    const scope = await loadRevealScope({ db })
    expect(scope.failed).toBe(true)
    expect(isItemHeld(scope, 'anything#1')).toBe(true)
    expect(isTypeHeld(scope, 'R-BLANK')).toBe(true)
  })

  it('범위 — 보류 시험의 문항 · 유형', async () => {
    const db = fakeDb(rpcOk, {
      csat_exams: [{ id: 'M2509' }, { id: HELD_EXAM }],
      csat_items: [{ id: `${HELD_EXAM}#18`, exam_id: HELD_EXAM, type_id: 'T1' }, { id: 'M2509#18', exam_id: 'M2509', type_id: 'T2' }],
    })
    const scope = await loadRevealScope({ db })
    expect(scope.failed).toBe(false)
    expect(isItemHeld(scope, `${HELD_EXAM}#18`)).toBe(true)
    expect(isItemHeld(scope, 'M2509#18')).toBe(false)
    expect(isTypeHeld(scope, 'T1')).toBe(true)
    expect(isTypeHeld(scope, 'T2')).toBe(false)
  })

  it('assertRevealAllowed 는 보류면 RevealHeldError, 응답 계약은 423 · held · no-store', async () => {
    const db = fakeDb(rpcOk)
    await expect(assertRevealAllowed({ itemId: `${HELD_EXAM}#18` }, { db })).rejects.toSatisfy(isRevealHeld)
    await expect(assertRevealAllowed({ itemId: 'M2509#18' }, { db })).resolves.toBeUndefined()
    const res = revealHeldResponse()
    expect(res.status).toBe(423)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ held: 'exam_embargo' })
  })
})
