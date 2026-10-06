// apps/web/src/lib/csat/diagnosis/__tests__/reveal-sync.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gate = vi.hoisted(() => ({ held: false }))
const srv = vi.hoisted(() => ({ watermark: '2026-10-06T00:00:00Z' as string | null, sessions: 1, recompute: vi.fn() }))

vi.mock('../../embargo-gate', () => ({ userHasHeldSession: async () => gate.held }))
vi.mock('../server', () => ({
  loadSessionsWithWatermark: async () => ({ sessions: Array.from({ length: srv.sessions }, (_, i) => ({ id: String(i) })), watermark: srv.watermark }),
  recomputeSnapshot: srv.recompute,
}))

import { syncRevealedSnapshot } from '../reveal-sync'

function db(asOf: string | null): SupabaseClient {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: asOf ? { inputs_as_of: asOf } : null, error: null }) }
  return { from: () => q } as unknown as SupabaseClient
}
const NOW = new Date('2026-10-06T01:00:00Z')

describe('syncRevealedSnapshot — 공개 뒤 따라잡기', () => {
  beforeEach(() => { gate.held = false; srv.watermark = '2026-10-06T00:00:00Z'; srv.sessions = 1; srv.recompute.mockReset() })

  it('보류 중이면 아무것도 하지 않는다', async () => {
    gate.held = true
    expect(await syncRevealedSnapshot(db(null), 'u', NOW)).toBe('held')
    expect(srv.recompute).not.toHaveBeenCalled()
  })

  it('보류 동안 빠진 기록(워터마크 > 스냅샷 입력 시각)이면 다시 쌓는다', async () => {
    srv.recompute.mockResolvedValue({ id: 's' })
    expect(await syncRevealedSnapshot(db('2026-10-05T00:00:00Z'), 'u', NOW)).toBe('recomputed')
    expect(srv.recompute).toHaveBeenCalledTimes(1)
  })

  it('재실행 안전 — 이미 따라잡았으면 fresh', async () => {
    expect(await syncRevealedSnapshot(db('2026-10-06T00:00:00Z'), 'u', NOW)).toBe('fresh')
    expect(srv.recompute).not.toHaveBeenCalled()
  })

  it('재계산이 실패해도 던지지 않고 보류로 되돌리지 않는다(failed)', async () => {
    srv.recompute.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await syncRevealedSnapshot(db(null), 'u', NOW)).toBe('failed')
  })
})
