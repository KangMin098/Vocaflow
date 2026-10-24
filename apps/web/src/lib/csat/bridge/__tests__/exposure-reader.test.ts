// apps/web/src/lib/csat/bridge/__tests__/exposure-reader.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { readExposures, readIndependence } from '../exposure-reader'

type Res = { data: unknown; error: unknown; count?: number | null }
function db(byTable: Record<string, Res>, rpc: (args: { p_attempt_id: number }) => Res = () => ({ data: null, error: null })) {
  const chain = (r: Res) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in']) c[m] = () => c
    c.limit = () => Promise.resolve(r)
    return c
  }
  return { from: (t: string) => chain(byTable[t]), rpc: (_: string, a: { p_attempt_id: number }) => Promise.resolve(rpc(a)) } as unknown as SupabaseClient
}

const row = { item_ref: '2024#21', kind: 'answer_direct', source: 'reveal_api', received_at: '2026-10-24T00:00:00Z', clock_suspect: false, analysis_version: 2 }
const tracking = { data: [{ started_at: '2026-10-23T19:41:23Z' }], error: null }

describe('P6 reader(읽기 전용)', () => {
  it('본인 행을 읽어 변환한다', async () => {
    const r = await readExposures(db({ learning_exposures: { data: [row], error: null, count: 1 }, learning_exposure_tracking: tracking }), 'u', ['2024#21'])
    expect(r).toEqual({ status: 'ok', trackingStartedAt: '2026-10-23T19:41:23Z', rows: [{ itemRef: '2024#21', kind: 'answer_direct', source: 'reveal_api', receivedAt: row.received_at, clockSuspect: false, analysisVersion: 2 }] })
  })
  it('표가 없으면 not_installed, 잘리거나 형식이 틀리면 error(0건으로 삼키지 않는다)', async () => {
    expect(await readExposures(db({ learning_exposures: { data: null, error: { code: '42P01' } }, learning_exposure_tracking: tracking }), 'u', ['x'])).toEqual({ status: 'not_installed' })
    expect(await readExposures(db({ learning_exposures: { data: [row], error: null, count: 5 }, learning_exposure_tracking: tracking }), 'u', ['x'])).toEqual({ status: 'error' })
    expect(await readExposures(db({ learning_exposures: { data: [{ ...row, kind: 'seen' }], error: null, count: 1 }, learning_exposure_tracking: tracking }), 'u', ['x'])).toEqual({ status: 'error' })
    expect(await readExposures(db({ learning_exposures: { data: [], error: null, count: null }, learning_exposure_tracking: tracking }), 'u', ['x'])).toEqual({ status: 'error' })
  })
  it('독립 판정 RPC — 실패한 시도만 null, 함수 없으면 not_installed', async () => {
    const ok = await readIndependence(db({}, (a) => (a.p_attempt_id === 2 ? { data: null, error: { code: '500' } } : { data: 'independent_candidate', error: null })), ['1', '2', '1'])
    expect(ok).toEqual({ status: 'ok', byAttempt: { 1: 'independent_candidate', 2: null } })
    expect(await readIndependence(db({}, () => ({ data: null, error: { code: 'PGRST202' } })), ['1'])).toEqual({ status: 'not_installed' })
  })
})
