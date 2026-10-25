// apps/web/src/lib/srs/__tests__/shared-device-stale.test.ts
//
// T-0172 r2 리뷰 P1-2 — getSession 을 기다리는 사이 B 로그인 이벤트가 먼저 오고 A 응답이 늦게 오면,
// 늦은 A 응답이 큐 주인을 A 로 되돌려 B 의 평가가 owner=A 로 저장됐다. 오래된 응답은 버려야 한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Session = { user: { id: string } } | null
const h = vi.hoisted(() => ({
  user: null as string | null,
  listeners: [] as ((event: string, session: { user: { id: string } } | null) => void)[],
  gate: null as Promise<void> | null,
  waiting: 0,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => {
        const who = h.user
        if (h.gate) { h.waiting += 1; await h.gate }
        return { data: { session: who ? { user: { id: who } } : null }, error: null }
      },
      onAuthStateChange: (cb: (event: string, session: Session) => void) => { h.listeners.push(cb); return { data: { subscription: { unsubscribe: () => {} } } } },
    },
  }),
}))
vi.mock('../flush-actions', () => ({ flushPendingSrsResults: async () => ({ ok: true, persisted: 0, skipped: 0, duplicated: 0, acked: [] }) }))

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
}
const g = globalThis as unknown as Record<string, unknown>
let local: MemoryStorage
/** 지연된 getSession 이 실제로 대기에 들어갈 때까지 */
const untilWaiting = () => vi.waitFor(() => { if (h.waiting < 1) throw new Error("not yet") })

beforeEach(() => {
  vi.resetModules()
  h.user = null; h.listeners = []; h.gate = null; h.waiting = 0
  local = new MemoryStorage()
  g.window = {}; g.localStorage = local; g.sessionStorage = new MemoryStorage()
})
afterEach(() => { delete g.window; delete g.localStorage; delete g.sessionStorage })

describe('지연된 getSession 응답은 최신 인증 이벤트를 덮지 않는다(T-0172 r2 P1-2)', () => {
  it('B 이벤트 → 늦은 A 응답 → 실제 pushPendingResult 평가 = owner B', async () => {
    const storage = await import('../session-storage')
    const flush = await import('../flush-session')
    h.user = 'user-A'
    let open: () => void = () => {}
    h.gate = new Promise<void>((r) => { open = r })
    const resolving = flush.resolveSrsQueueOwner() // A 로 조회 시작(응답 지연)
    await untilWaiting()
    h.user = 'user-B'
    for (const cb of h.listeners) cb('SIGNED_IN', { user: { id: 'user-B' } })
    open()
    await resolving
    storage.pushPendingResult({ cardId: 'c', word: 'banana', cardUpdate: {}, rating: 3, reviewedAt: '2026-10-25T02:00:00.000Z', module: 'flashcard' })
    const q = JSON.parse(local.getItem('srs_pending') ?? '[]') as { owner?: string }[]
    expect(q.map((p) => p.owner)).toEqual(['user-B'])
  })
})

describe('같은 계정 재로그인 — SRS 평가가 보류 · 유실되지 않는다(T-0172 r3 확인)', () => {
  it('A 로그아웃 → A 재로그인 뒤 평가는 owner A, 이전 A 평가와 함께 A 확인 전송에 실린다', async () => {
    const storage = await import('../session-storage')
    const flush = await import('../flush-session')
    h.user = 'user-A'
    await flush.resolveSrsQueueOwner()
    storage.pushPendingResult({ cardId: 'c1', word: 'apple', cardUpdate: {}, rating: 3, reviewedAt: '2026-10-25T01:00:00.000Z', module: 'flashcard' })
    h.user = null
    for (const cb of h.listeners) cb('SIGNED_OUT', null)
    h.user = 'user-A'
    for (const cb of h.listeners) cb('SIGNED_IN', { user: { id: 'user-A' } })
    storage.pushPendingResult({ cardId: 'c2', word: 'banana', cardUpdate: {}, rating: 3, reviewedAt: '2026-10-25T02:00:00.000Z', module: 'flashcard' })
    expect(storage.getPendingResults().map((p) => [p.word, p.owner])).toEqual([['apple', 'user-A'], ['banana', 'user-A']])
  })
})
