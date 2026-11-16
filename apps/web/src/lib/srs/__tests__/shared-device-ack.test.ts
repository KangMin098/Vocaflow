// apps/web/src/lib/srs/__tests__/shared-device-ack.test.ts
//
// T-0172 r1 리뷰 P1-3 · P1-4 · (서버 ACK).
// P1-3 평가의 주인은 **평가하는 순간의 인증 주체**다 — 마지막 flush 때 정한 값을 들고 있으면 다른 탭의 A→B 전환 뒤 B 평가가 A 것이 된다.
//      세션을 못 읽으면 이전 주인을 쓰지 않고 보류(주인 없음)한다.
// P1-4 큐는 **서버가 확인한(ACK) 항목만** 지운다. beacon true · 응답 안 기다린 fetch · ok=true 인 남의 항목 skip 은 확인이 아니다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Session = { user: { id: string } } | null
const h = vi.hoisted(() => ({
  user: null as string | null,
  sessionFails: false,
  listeners: [] as ((event: string, session: { user: { id: string } } | null) => void)[],
  actionCalls: [] as { word: string; owner?: string; reviewedAt: string; module: string }[][],
  ack: 'none' as 'none' | 'all',
  beacons: [] as string[],
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => {
        if (h.sessionFails) throw new Error('storage blocked')
        return { data: { session: h.user ? { user: { id: h.user } } : null }, error: null }
      },
      onAuthStateChange: (cb: (event: string, session: Session) => void) => { h.listeners.push(cb); return { data: { subscription: { unsubscribe: () => {} } } } },
    },
  }),
}))
vi.mock('../flush-actions', () => ({
  flushPendingSrsResults: async (items: { word: string; owner?: string; reviewedAt: string; module: string }[]) => {
    h.actionCalls.push(items)
    const acked = h.ack === 'all' ? items.map((i) => `${i.word}@${i.reviewedAt}@${i.module}`) : []
    return { ok: true, persisted: 0, skipped: items.length, duplicated: 0, acked }
  },
}))

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
}
const g = globalThis as unknown as Record<string, unknown>
let local: MemoryStorage
const queue = () => JSON.parse(local.getItem('srs_pending') ?? '[]') as { word: string; owner?: string }[]
const item = (word: string, at: string) => ({ cardId: `card-${word}`, word, cardUpdate: {}, rating: 3, reviewedAt: at, module: 'flashcard' })
const switchTo = (id: string | null) => { h.user = id; for (const cb of h.listeners) cb(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null) }

beforeEach(() => {
  vi.resetModules()
  h.user = null; h.sessionFails = false; h.listeners = []; h.actionCalls = []; h.ack = 'none'; h.beacons = []
  local = new MemoryStorage()
  g.window = {}
  g.localStorage = local
  g.sessionStorage = new MemoryStorage()
  g.Blob = class { parts: unknown[]; constructor(p: unknown[]) { this.parts = p } }
  Object.defineProperty(globalThis, 'navigator', {
    value: { sendBeacon: (_u: string, b: { parts: unknown[] }) => { h.beacons.push(String(b.parts[0])); return true } },
    configurable: true, writable: true,
  })
})
afterEach(() => {
  delete g.window; delete g.localStorage; delete g.sessionStorage; delete g.Blob
  delete (globalThis as unknown as Record<string, unknown>).navigator
})

async function load() {
  return { storage: await import('../session-storage'), flush: await import('../flush-session') }
}

describe('P1-3 — 평가 주인은 평가하는 순간의 인증 주체', () => {
  it('다른 탭에서 A→B 로 바뀐 뒤의 평가는 B 소유다', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    switchTo('user-B')
    storage.pushPendingResult(item('banana', '2026-10-25T02:00:00.000Z'))
    expect(queue().map((p) => [p.word, p.owner])).toEqual([['banana', 'user-B']])
  })

  it('로그아웃 이벤트 뒤의 평가는 주인 없이 보류된다', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    switchTo(null)
    storage.pushPendingResult(item('cherry', '2026-10-25T02:00:00.000Z'))
    expect(queue()[0].owner).toBeUndefined()
  })

  it('세션 읽기가 실패하면 이전 주인을 쓰지 않는다(보류)', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    h.sessionFails = true
    await flush.flushPendingSession()
    storage.pushPendingResult(item('date', '2026-10-25T02:00:00.000Z'))
    expect(queue()[0].owner).toBeUndefined()
  })
})

describe('P1-4 — 서버가 확인한 항목만 지운다', () => {
  it('이탈 전송(beacon true)은 큐를 지우지 않는다 — 확인이 아니다', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    flush.flushOnLeave()
    expect(h.beacons).toHaveLength(1)
    expect(queue().map((p) => p.word)).toEqual(['apple'])
  })

  it('ok=true 라도 ACK 에 없는 항목(서버가 남의 것으로 skip)은 남긴다', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    h.ack = 'none'
    await flush.flushPendingSession()
    expect(h.actionCalls.at(-1)?.map((i) => i.word)).toEqual(['apple'])
    expect(queue().map((p) => p.word)).toEqual(['apple'])
  })

  it('ACK 된 항목은 다음 확인 전송에서 지워진다(이탈 전송 뒤 재전송은 서버 멱등으로 정리)', async () => {
    h.user = 'user-A'
    const { storage, flush } = await load()
    await flush.flushPendingSession()
    storage.pushPendingResult(item('apple', '2026-10-25T01:00:00.000Z'))
    flush.flushOnLeave()
    h.ack = 'all'
    await flush.flushPendingSession()
    expect(queue()).toEqual([])
  })
})
