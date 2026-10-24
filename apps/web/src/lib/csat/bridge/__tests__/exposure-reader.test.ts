// apps/web/src/lib/csat/bridge/__tests__/exposure-reader.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { readExposures, readIndependence, readPassageKeys } from '../exposure-reader'

type Res = { data: unknown; error: unknown; count?: number | null }
function db(byTable: Record<string, Res>, rpc: (args: { p_attempt_id: number }) => Res = () => ({ data: null, error: null }), user: string | null = 'u') {
  const chain = (r: Res) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in']) c[m] = () => c
    c.limit = () => Promise.resolve(r)
    return c
  }
  return { auth: { getUser: () => Promise.resolve(user === null ? { data: { user: null }, error: null } : { data: { user: { id: user } }, error: null }) }, from: (t: string) => chain(byTable[t]), rpc: (_: string, a: { p_attempt_id: number }) => Promise.resolve(rpc(a)) } as unknown as SupabaseClient
}

const row = { item_ref: '2024#21', kind: 'answer_direct', source: 'reveal_api', received_at: '2026-10-24T00:00:00Z', clock_suspect: false, analysis_version: 2 }
const tracking = { data: [{ started_at: '2026-10-23T19:41:23Z' }], error: null }

describe('P6 reader(읽기 전용)', () => {
  it('본인 행을 읽어 변환한다', async () => {
    const r = await readExposures(db({ learning_exposures: { data: [row], error: null, count: 1 }, learning_exposure_tracking: tracking }))
    expect(r).toEqual({ status: 'ok', trackingStartedAt: '2026-10-23T19:41:23Z', rows: [{ itemRef: '2024#21', kind: 'answer_direct', source: 'reveal_api', receivedAt: row.received_at, clockSuspect: false, analysisVersion: 2 }] })
  })
  it('표가 없으면 not_installed, 잘리거나 형식이 틀리면 error(0건으로 삼키지 않는다)', async () => {
    expect(await readExposures(db({ learning_exposures: { data: null, error: { code: '42P01' } }, learning_exposure_tracking: tracking }))).toEqual({ status: 'not_installed' })
    expect(await readExposures(db({ learning_exposures: { data: [row], error: null, count: 5 }, learning_exposure_tracking: tracking }))).toEqual({ status: 'error' })
    expect(await readExposures(db({ learning_exposures: { data: [{ ...row, kind: 'seen' }], error: null, count: 1 }, learning_exposure_tracking: tracking }))).toEqual({ status: 'error' })
    expect(await readExposures(db({ learning_exposures: { data: [], error: null, count: null }, learning_exposure_tracking: tracking }))).toEqual({ status: 'error' })
  })
  it('로그인 없음은 unauthenticated — 빈 원장으로 보지 않는다', async () => {
    expect(await readExposures(db({ learning_exposures: { data: [], error: null, count: 0 }, learning_exposure_tracking: tracking }, undefined, null))).toEqual({ status: 'unauthenticated' })
  })
  it('독립 판정 RPC — 실패한 시도만 null, 함수 없으면 not_installed', async () => {
    const ok = await readIndependence(db({}, (a) => (a.p_attempt_id === 2 ? { data: null, error: { code: '500' } } : { data: 'independent_candidate', error: null })), ['1', '2', '1'])
    expect(ok).toEqual({ status: 'ok', byAttempt: { 1: 'independent_candidate', 2: null } })
    expect(await readIndependence(db({}, () => ({ data: null, error: { code: 'PGRST202' } })), ['1'])).toEqual({ status: 'not_installed' })
  })
})

describe('지문 키(K6-a)', () => {
  it('공백 · 대소문자만 다른 지문은 같은 키, 빈 지문은 키 없음, 조회 실패는 null', async () => {
    const items = { data: [{ exam_id: '2024', no: 21, passage: 'A  b\nC' }, { exam_id: '2024', no: 23, passage: 'a b c' }, { exam_id: '2024', no: 24, passage: '' }], error: null }
    const chain: Record<string, () => unknown> = { select: () => chain, in: () => Promise.resolve(items) }
    const k = await readPassageKeys({ from: () => chain } as unknown as SupabaseClient, ['2024#21', '2024#23'])
    expect(k!['2024#21']).toBe(k!['2024#23'])
    expect(k!['2024#24']).toBeUndefined()
    const bad: Record<string, () => unknown> = { select: () => bad, in: () => Promise.resolve({ data: null, error: { code: '500' } }) }
    expect(await readPassageKeys({ from: () => bad } as unknown as SupabaseClient, ['2024#21'])).toBeNull()
  })
})
