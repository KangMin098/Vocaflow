// apps/web/src/lib/csat/authored/__tests__/recordOpen.test.ts
// FI-010(#302) — 납품 자료를 열면 노출 원장(learning_sessions · stage open)에 그 세션을 남긴다. 제출은 같은 세션 id 를 이어 쓴다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { recordOpen, stableKey, type DeliveredView } from '../server'

const view = (role: DeliveredView['role']) => ({ ref: 'authored:x-1', role, deliveryId: 'd', taskId: 'r.central_meaning', format: 'central_meaning', sentences: [], stem: '', choices: [], teach: null, hints: null, extra: {}, probe: null, done: null, retry: false, annotationHash: null }) as DeliveredView

function fakeAdmin(error: unknown = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  return { db: { rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve({ data: [{ session_id: 's', outcome: 'applied' }], error }) } } as unknown as SupabaseClient, calls }
}

describe('recordOpen', () => {
  it('혼자 확인 자료: theater/practice 세션을 stage open 으로 · 같은 세션 id · 결정적 mutation', async () => {
    const f = fakeAdmin()
    expect(await recordOpen(f.db, { id: 'u1', email: 'u@x.y' }, view('independent_check'), 'authored-central-meaning', 'sess-1', '2026-10-18T10:00:00.000Z')).toBe(true)
    expect(f.calls[0]).toMatchObject({ fn: 'learning_session_apply', args: { p_user: 'u1', p_client_session_id: 'sess-1', p_stage: 'open', p_item_ref: 'authored:x-1', p_activity: 'theater', p_phase: 'practice', p_task_key: 'authored-central-meaning', p_help_level: null } })
    expect(f.calls[0].args.p_mutation).toBe(stableKey('authored-open', 'u1', 'sess-1'))
  })
  it('전이 자료는 transfer 단계 · 안내 연습은 practice 활동', async () => {
    const t = fakeAdmin()
    await recordOpen(t.db, { id: 'u1', email: null }, view('transfer'), 'k', 's', '2026-10-18T10:00:00.000Z')
    expect(t.calls[0].args).toMatchObject({ p_activity: 'theater', p_phase: 'transfer' })
    const g = fakeAdmin()
    await recordOpen(g.db, { id: 'u1', email: null }, view('guided_practice'), 'k', 's', '2026-10-18T10:00:00.000Z')
    expect(g.calls[0].args).toMatchObject({ p_activity: 'practice' })
  })
  it('기록 실패는 false — 화면은 이 세션 id 를 쓰지 않는다', async () => {
    const f = fakeAdmin({ message: 'x' })
    expect(await recordOpen(f.db, { id: 'u1', email: null }, view('independent_check'), 'k', 's', '2026-10-18T10:00:00.000Z')).toBe(false)
  })
})
