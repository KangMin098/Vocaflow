// apps/web/src/lib/csat/session/__tests__/shared-device-race.test.ts
//
// T-0172 r1 P1-2 — 같은 탭에서 A 의 서버 GET 을 기다리는 사이 세션이 B 로 바뀌면(다른 탭 로그인은 이 탭을 reload 하지 않는다)
// A 의 서버 응답이 B 의 기기 키에 합쳐지고 owner=B 로 다시 올라가면 안 된다. 읽기 · 병합 · 쓰기 전체가 시작 때의 주인에 고정돼야 한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: null as string | null,
  idb: new Map<string, Map<string, unknown>>(),
  puts: [] as { owner?: string; record: { completed: { id: string }[] } }[],
  listeners: [] as ((event: string, session: { user: { id: string } } | null) => void)[],
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.user ? { user: { id: h.user } } : null }, error: null }),
      onAuthStateChange: (cb: (event: string, session: { user: { id: string } } | null) => void) => { h.listeners.push(cb); return { data: { subscription: { unsubscribe: () => {} } } } },
    },
  }),
}))

function fakeIndexedDB() {
  const later = (fn: () => void) => { void Promise.resolve().then(fn) }
  return {
    open: () => {
      const req: Record<string, unknown> & { result?: unknown } = {}
      later(() => {
        const db = {
          objectStoreNames: { contains: (n: string) => h.idb.has(n) },
          createObjectStore: (n: string) => { h.idb.set(n, new Map()) },
          close: () => {},
          transaction: (name: string) => {
            const tx: Record<string, unknown> = {}
            const store = h.idb.get(name) ?? new Map<string, unknown>()
            h.idb.set(name, store)
            const request = (value: () => unknown) => {
              const r: Record<string, unknown> = {}
              later(() => {
                r.result = value()
                later(() => (tx.oncomplete as (() => void) | undefined)?.())
              })
              return r
            }
            tx.objectStore = () => ({
              get: (k: string) => request(() => structuredClone(store.get(k))),
              put: (v: unknown, k: string) => request(() => { store.set(k, structuredClone(v)); return k }),
              getAllKeys: () => request(() => [...store.keys()]),
              clear: () => request(() => { store.clear() }),
            })
            return tx
          },
        }
        req.result = db
        if (!h.idb.has('record')) (req.onupgradeneeded as (() => void) | undefined)?.()
        ;(req.onsuccess as (() => void) | undefined)?.()
      })
      return req
    },
  }
}


const rec = (items: string[], seed = 1) => ({ version: 1 as const, seed, onboarded: true, predictions: [], formulas: [], queue: [], completed: items.map((id, i) => ({ id, at: 1000 + i })) })
const ids = (r: { completed: { id: string }[] }) => r.completed.map((c) => c.id)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T09:00:00Z'))
  h.idb = new Map([['record', new Map<string, unknown>([['dissection-v1:user-B', rec(['B-OWN'], 2)]])], ['papers', new Map()]])
  h.puts = []
  h.listeners = []
  vi.stubGlobal('window', { addEventListener: () => {} })
  vi.stubGlobal('indexedDB', fakeIndexedDB())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules() })

describe('공용 기기 — GET 대기 중 계정 전환(T-0172 r1 P1-2)', () => {
  it('A 의 GET 응답은 B 로 바뀐 뒤 버려진다 — B 기기 키 · B 전송에 A 서버 기록이 들어가지 않는다', async () => {
    h.user = 'user-A'
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PUT') { h.puts.push(JSON.parse(String(init?.body))); return new Response('{"ok":true}', { status: 200 }) }
      // 응답이 오기 전에 다른 탭에서 B 로 로그인했다
      h.user = 'user-B'
      for (const cb of h.listeners) cb('SIGNED_IN', { user: { id: 'user-B' } })
      return new Response(JSON.stringify({ ok: true, owner: 'user-A', record: rec(['A-SERVER'], 3) }), { status: 200 })
    }))
    const store = await import('../store')
    const { record } = await store.loadSyncedDissectionRecord()
    await vi.advanceTimersByTimeAsync(5000)
    const bLocal = h.idb.get('record')?.get('dissection-v1:user-B') as { completed: { id: string }[] }
    expect(ids(bLocal)).toEqual(['B-OWN'])
    expect(ids(record)).not.toContain('A-SERVER')
    expect(h.puts.flatMap((p) => ids(p.record))).not.toContain('A-SERVER')
  })
})
