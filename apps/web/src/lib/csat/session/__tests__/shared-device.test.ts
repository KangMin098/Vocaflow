// apps/web/src/lib/csat/session/__tests__/shared-device.test.ts
//
// T-0172 — 한 브라우저를 두 계정이 차례로 쓸 때(공용 기기) CSAT 해부 기록이 섞이는가.
// A 가 기기(IndexedDB)에 기록을 남기고 로그아웃(= hard reload: 모듈만 새로, 저장소는 그대로) → B 로그인 →
// B 가 `loadSyncedDissectionRecord` 를 부르면 A 의 기록이 B 화면에 나오거나 B 의 서버 행으로 PUT 되면 결함이다.
// 원 소유자 A 가 다시 로그인하면 A 의 기기 기록은 그대로 돌아와 A 로 전송돼야 한다(삭제 금지).
//
// IndexedDB 는 의존성(fake-indexeddb)이 없어 이 파일의 최소 메모리 대역을 쓴다 — store.ts 가 쓰는 open/get/put 만 흉내 낸다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: null as string | null,
  idb: new Map<string, Map<string, unknown>>(),
  puts: [] as { owner?: string; record: { completed: { id: string }[] } }[],
  serverRecord: null as unknown,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.user ? { user: { id: h.user } } : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
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

const A_ITEM = 'A-SECRET-2026#31'
const B_ITEM = 'B-OWN-2026#20'
const rec = (items: string[], seed = 1) => ({ version: 1 as const, seed, onboarded: true, predictions: [], formulas: [], queue: [], completed: items.map((id, i) => ({ id, at: 1000 + i })) })
const ids = (r: { completed: { id: string }[] }) => r.completed.map((c) => c.id)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T09:00:00Z'))
  h.idb = new Map()
  h.puts = []
  h.serverRecord = null
  vi.stubGlobal('window', { addEventListener: () => {} })
  vi.stubGlobal('indexedDB', fakeIndexedDB())
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'PUT') {
      h.puts.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    // 서버는 응답에 주인(로그인 계정)을 싣는다(route.ts GET · T-0172 r1)
    return new Response(JSON.stringify({ ok: true, owner: h.user, record: h.serverRecord }), { status: 200 })
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

/** A 가 기록을 남기고 로그아웃(hard reload) — 저장소(h.idb)는 남고 모듈만 새로 읽힌다 */
async function aStudiesThenSignsOut() {
  h.user = 'user-A'
  vi.resetModules()
  const storeA = await import('../store')
  await storeA.saveDissectionRecord(rec([A_ITEM]) as never)
  // A 의 전송이 실패해 서버에 못 갔다고 친다(미전송 기록) — 예약 PUT 을 버린다
  vi.clearAllTimers()
  h.puts = []
  h.user = 'user-B'
  vi.resetModules()
  return import('../store')
}

describe('공용 기기 — CSAT 해부 기록 계정 분리(T-0172)', () => {
  it('B 의 서버 기록이 없을 때: A 기록이 B 화면에 나오지 않고 B 로 PUT 되지 않는다', async () => {
    const storeB = await aStudiesThenSignsOut()
    h.serverRecord = null
    const { record } = await storeB.loadSyncedDissectionRecord()
    await vi.advanceTimersByTimeAsync(5000)
    expect(ids(record)).not.toContain(A_ITEM)
    expect(h.puts.flatMap((p) => ids(p.record))).not.toContain(A_ITEM)
  })

  it('B 의 서버 기록이 있을 때: 병합 결과 · PUT 에 A 기록이 섞이지 않는다', async () => {
    const storeB = await aStudiesThenSignsOut()
    h.serverRecord = rec([B_ITEM], 2)
    const { record } = await storeB.loadSyncedDissectionRecord()
    await vi.advanceTimersByTimeAsync(5000)
    expect(ids(record)).toContain(B_ITEM)
    expect(ids(record)).not.toContain(A_ITEM)
    expect(h.puts.flatMap((p) => ids(p.record))).not.toContain(A_ITEM)
  })

  it('A 가 다시 로그인하면 A 의 기기 기록은 지워지지 않고 돌아와 A 로 전송된다', async () => {
    const storeB = await aStudiesThenSignsOut()
    h.serverRecord = null
    await storeB.loadSyncedDissectionRecord()
    await storeB.saveDissectionRecord(rec([B_ITEM], 2) as never)
    await vi.advanceTimersByTimeAsync(5000)
    h.puts = []
    // A 재로그인
    h.user = 'user-A'
    vi.resetModules()
    const storeA = await import('../store')
    h.serverRecord = null
    const { record } = await storeA.loadSyncedDissectionRecord()
    await vi.advanceTimersByTimeAsync(5000)
    expect(ids(record)).toEqual([A_ITEM])
    const sent = h.puts.flatMap((p) => ids(p.record))
    expect(sent).toContain(A_ITEM)
    expect(sent).not.toContain(B_ITEM)
    expect(h.puts.every((p) => p.owner === 'user-A')).toBe(true)
  })
})
