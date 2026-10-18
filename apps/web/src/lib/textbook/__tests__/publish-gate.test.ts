// apps/web/src/lib/textbook/__tests__/publish-gate.test.ts
// 교재 발행 게이트 — 발행된 권만 · 읽기 실패는 막는다(fail-closed) · 쓰기 없음
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('서버 키 없음') } }))

import { canShow, loadPublishGate, stateOf } from '../publish-gate'

const fakeDb = (rows: { band: number | string; status: string }[] | null, error: string | null = null) => {
  const calls: string[] = []
  const q = {
    select: (s: string) => { calls.push(`select:${s}`); return q },
    eq: (k: string, v: string) => { calls.push(`eq:${k}=${v}`); return q },
    then: (res: (v: unknown) => void) => res({ data: rows, error: error ? { message: error } : null }),
  }
  return { db: { from: (t: string) => { calls.push(`from:${t}`); return q } } as never, calls }
}

describe('발행 게이트', () => {
  it('발행된 단계만 보인다', async () => {
    const { db, calls } = fakeDb([{ band: 2, status: 'published' }, { band: '3', status: 'published' }])
    const g = await loadPublishGate('vocab', db)
    expect([stateOf(g, 2), stateOf(g, 3), stateOf(g, 4)]).toEqual(['published', 'published', 'unpublished'])
    expect(canShow(stateOf(g, 4))).toBe(false)
    // 읽기만 — 발행 상태 조건으로 조회
    expect(calls).toEqual(['from:textbook_volume_renders', 'select:band, status', 'eq:series=vocab', 'eq:status=published'])
  })
  it('읽기 오류 · 서버 키 없음이면 전부 막는다(fail-closed)', async () => {
    const { db } = fakeDb(null, 'permission denied')
    const g = await loadPublishGate('reading', db)
    expect(stateOf(g, 2)).toBe('unknown')
    expect(canShow(stateOf(g, 2))).toBe(false)
    const noKey = await loadPublishGate('reading')
    expect(noKey.failed).toBe(true)
  })
})
