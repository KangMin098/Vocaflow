// apps/web/src/lib/srs/__tests__/shared-device.test.ts
//
// T-0172 — 한 브라우저를 두 계정이 차례로 쓸 때(공용 기기) SRS 평가 큐가 다른 계정 카드에 적용되는가.
// ① 클라이언트: A 가 평가를 큐에 남기고 로그아웃(hard reload = 모듈만 새로, localStorage 는 그대로) → B 가 학습 화면에 들어오면
//    flush 가 A 의 평가를 B 의 계정으로 보내는가 · B 에 단어가 없어 skip 돼도 큐 전체를 지워 A 의 미전송 기록이 사라지는가.
// ② 서버 액션: 다른 계정 소유로 표시된 항목이 들어와도 B 의 같은 단어 카드에 적용하지 않는가.
// 원 소유자 A 가 다시 로그인하면 보류된 A 의 평가는 A 로 전송되고 그때 비워져야 한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: null as string | null,
  actionCalls: [] as { items: { word: string; owner?: string }[] }[],
  beacons: [] as string[],
  // 서버 액션 시험용 DB 대역
  vocab: [] as { id: string; user_id: string; word: string; difficulty: number; stability: number; last_review_at: string | null; next_review_at: string | null; module_history: string[]; review_count: number; created_at: string }[],
  updates: [] as { id: string }[],
  inserts: [] as unknown[],
}))

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: h.user ? { user: { id: h.user } } : null }, error: null }) },
  }),
}))

const g = globalThis as unknown as Record<string, unknown>
let local: MemoryStorage

beforeEach(() => {
  h.actionCalls = []
  h.beacons = []
  local = new MemoryStorage()
  g.window = {}
  g.localStorage = local
  g.sessionStorage = new MemoryStorage()
  g.Blob = class { parts: unknown[]; constructor(p: unknown[]) { this.parts = p } }
  Object.defineProperty(globalThis, 'navigator', {
    value: { sendBeacon: (_u: string, b: { parts: unknown[] }) => { h.beacons.push(String(b.parts[0])); return true } },
    configurable: true,
    writable: true,
  })
})
afterEach(() => {
  delete g.window; delete g.localStorage; delete g.sessionStorage; delete g.Blob
  delete (globalThis as unknown as Record<string, unknown>).navigator
  vi.doUnmock('../flush-actions')
  vi.resetModules()
})

const item = (word: string, at: string) => ({ cardId: `card-${word}`, word, cardUpdate: {}, rating: 4, reviewedAt: at, module: 'flashcard' })

/** 같은 탭 새로고침(로그아웃 hard reload) — 모듈은 새로, 저장소는 그대로 */
async function reload(user: string | null) {
  h.user = user
  vi.resetModules()
  vi.doMock('../flush-actions', () => ({
    // B 에게 같은 단어가 없으면 서버는 skip 하고 ok 를 돌려준다(flush-actions.ts:126)
    flushPendingSrsResults: async (items: { word: string; owner?: string }[]) => { h.actionCalls.push({ items }); return { ok: true, persisted: 0, skipped: items.length, duplicated: 0 } },
  }))
  const storage = await import('../session-storage')
  const flush = await import('../flush-session')
  return { storage, flush }
}

describe('공용 기기 — SRS 평가 큐 계정 분리(T-0172) · 클라이언트', () => {
  it('B 진입 flush 는 A 의 평가를 보내지 않고, A 의 미전송 평가는 지우지 않는다', async () => {
    const a = await reload('user-A')
    await a.flush.flushPendingSession() // A 화면 진입(빈 큐)
    a.storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    // A 의 이탈 전송이 막혔다고 친다 — 큐가 남은 채 로그아웃
    const b = await reload('user-B')
    await b.flush.flushPendingSession()
    expect(h.actionCalls.flatMap((c) => c.items.map((i) => i.word))).not.toContain('apple')
    expect(local.getItem('srs_pending') ?? '').toContain('apple')
  })

  it('B 의 이탈 전송(beacon)도 A 의 평가를 싣지 않는다', async () => {
    const a = await reload('user-A')
    await a.flush.flushPendingSession()
    a.storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    const b = await reload('user-B')
    await b.flush.flushPendingSession()
    b.storage.pushPendingResult(item('banana', '2026-10-25T02:00:00.000Z'))
    b.flush.flushOnLeave()
    const sent = h.beacons.flatMap((x) => (JSON.parse(x) as { items: { word: string }[] }).items.map((i) => i.word))
    expect(sent).toEqual(['banana'])
    expect(local.getItem('srs_pending') ?? '').toContain('apple')
    expect(local.getItem('srs_pending') ?? '').not.toContain('banana')
  })

  it('A 가 다시 로그인하면 보류된 A 의 평가가 A 로 전송되고 그때 비워진다', async () => {
    const a = await reload('user-A')
    await a.flush.flushPendingSession()
    a.storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    const b = await reload('user-B')
    await b.flush.flushPendingSession()
    h.actionCalls = []
    const a2 = await reload('user-A')
    await a2.flush.flushPendingSession()
    expect(h.actionCalls).toHaveLength(1)
    expect(h.actionCalls[0].items.map((i) => [i.word, i.owner])).toEqual([['apple', 'user-A']])
    expect(local.getItem('srs_pending') ?? '[]').not.toContain('apple')
  })
})

describe('공용 기기 — SRS 서버 액션 소유자 검증(T-0172)', () => {
  it('다른 계정 소유로 표시된 평가는 B 카드에 적용 · ACK 하지 않고, 본인 항목만 적용 · ACK 한다', async () => {
    vi.resetModules()
    h.vocab = [
      { id: 'vocab-A-apple', user_id: 'user-A', word: 'apple', difficulty: 5, stability: 1, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, created_at: '2026-10-01T00:00:00.000Z' },
      { id: 'vocab-B-apple', user_id: 'user-B', word: 'apple', difficulty: 5, stability: 1, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, created_at: '2026-10-01T00:00:00.000Z' },
    ]
    h.updates = []
    h.inserts = []
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => {
        const table = (name: string) => {
          const filters: [string, unknown][] = []
          const q: Record<string, unknown> = {}
          const rows = () => (name === 'vocabularies' ? h.vocab : []).filter((r) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes((r as Record<string, unknown>)[k]) : (r as Record<string, unknown>)[k] === v)))
          Object.assign(q, {
            select: () => q,
            eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
            in: (k: string, v: unknown[]) => { filters.push([k, v]); return q },
            gte: () => q,
            lte: () => q,
            then: (res: (v: unknown) => void) => res({ data: rows(), error: null }),
            update: () => ({ eq: async (_k: string, id: string) => { h.updates.push({ id }); return { error: null } } }),
            insert: async (r: unknown) => { h.inserts.push(r); return { error: null } },
          })
          return q
        }
        return { auth: { getUser: async () => ({ data: { user: { id: 'user-B' } } }) }, from: table, rpc: async () => ({ error: null }) }
      },
    }))
    const { flushPendingSrsResults } = await import('../flush-actions')
    const res = await flushPendingSrsResults([
      { word: 'apple', rating: 4, reviewedAt: '2026-10-25T01:00:00.000Z', module: 'flashcard', owner: 'user-A' },
      { word: 'apple', rating: 3, reviewedAt: '2026-10-25T03:00:00.000Z', module: 'flashcard', owner: 'user-B' },
      { word: 'zebra', rating: 3, reviewedAt: '2026-10-25T04:00:00.000Z', module: 'flashcard', owner: 'user-B' },
    ] as never)
    vi.doUnmock('@/lib/supabase/server')
    expect(res.ok).toBe(true)
    // A 소유 평가는 적용하지 않고 ACK 하지도 않는다 — 클라이언트가 A 를 위해 남긴다(r1 P1-4)
    expect(h.updates).toEqual([{ id: 'vocab-B-apple' }])
    expect((h.inserts[0] as { attempted_at: string }[]).map((r) => r.attempted_at)).toEqual(['2026-10-25T03:00:00.000Z'])
    // 본인 항목은 적용(apple) · 단어 없음(zebra) 모두 확인한 것으로 돌려준다
    expect((res as { acked?: string[] }).acked?.sort()).toEqual(['apple@2026-10-25T03:00:00.000Z@flashcard', 'zebra@2026-10-25T04:00:00.000Z@flashcard'])
  })
})
