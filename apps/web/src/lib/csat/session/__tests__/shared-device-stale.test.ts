// apps/web/src/lib/csat/session/__tests__/shared-device-stale.test.ts
//
// T-0172 r2 리뷰 P1 — (1) 화면이 쥐고 있던 A 기록을 B 로그인 뒤 저장하면 B 키 · owner=B PUT 으로 들어갔다.
//   기록은 읽힌 순간의 주인 · 인증 세대에 결속되고, 저장 때 지금 주인 · 세대와 다르면 저장 · 전송을 거부해야 한다(A 키는 그대로).
// (2) getSession 을 기다리는 사이 도착한 B 인증 이벤트를 늦게 온 A 응답이 덮으면 안 된다(SRS 와 같은 규칙).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { memoryIndexedDB } from './memory-idb'

type Session = { user: { id: string } } | null
const h = vi.hoisted(() => ({
  user: null as string | null,
  idb: new Map<string, Map<string, unknown>>(),
  puts: [] as { owner?: string; record: { completed: { id: string }[] } }[],
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

const rec = (items: string[], seed = 1) => ({ version: 1 as const, seed, onboarded: true, predictions: [], formulas: [], queue: [], completed: items.map((id, i) => ({ id, at: 1000 + i })) })
const ids = (r: unknown) => ((r as { completed?: { id: string }[] } | undefined)?.completed ?? []).map((c) => c.id)
const switchTo = (id: string) => { h.user = id; for (const cb of h.listeners) cb('SIGNED_IN', { user: { id } }) }
/** 지연된 getSession 이 실제로 대기에 들어갈 때까지 */
const untilWaiting = () => vi.waitFor(() => { if (h.waiting < 1) throw new Error("not yet") })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T09:00:00Z'))
  h.idb = new Map([['record', new Map<string, unknown>([
    ['dissection-v1:user-A', rec(['A-OWN'], 1)],
    ['dissection-v1:user-B', rec(['B-OWN'], 2)],
  ])], ['papers', new Map()]])
  h.puts = []; h.listeners = []; h.gate = null; h.waiting = 0
  vi.stubGlobal('window', { addEventListener: () => {} })
  vi.stubGlobal('indexedDB', memoryIndexedDB(() => h.idb))
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'PUT') h.puts.push(JSON.parse(String(init?.body)))
    return new Response('{"ok":true}', { status: 200 })
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('공용 기기 — 쥐고 있던 기록의 재결속 금지(T-0172 r2 P1-1)', () => {
  it('A 기록을 B 로그인 뒤 저장하면 거부된다 — B 키 · PUT 에 A 기록이 없고 A 키는 그대로', async () => {
    h.user = 'user-A'
    const store = await import('../store')
    const a = await store.loadDissectionRecord()
    switchTo('user-B')
    const ok = await store.saveDissectionRecord({ ...a, completed: [...a.completed, { id: 'A-SECRET', at: 2000 }] })
    await vi.advanceTimersByTimeAsync(5000)
    expect(ok).toBe(false)
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-B'))).toEqual(['B-OWN'])
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-A'))).toEqual(['A-OWN'])
    expect(h.puts.flatMap((p) => ids(p.record))).not.toContain('A-SECRET')
  })

  it('전환 뒤 B 가 새로 읽은 기록은 정상 저장된다', async () => {
    h.user = 'user-A'
    const store = await import('../store')
    await store.loadDissectionRecord()
    switchTo('user-B')
    const b = await store.loadDissectionRecord()
    const ok = await store.saveDissectionRecord({ ...b, completed: [...b.completed, { id: 'B-NEW', at: 3000 }] })
    await vi.advanceTimersByTimeAsync(5000)
    expect(ok).toBe(true)
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-B'))).toEqual(['B-OWN', 'B-NEW'])
    expect(h.puts.at(-1)?.owner).toBe('user-B')
  })
})

describe('같은 계정 재로그인 — 화면 기록 저장 복구(T-0172 r3 P1)', () => {
  const signOut = () => { h.user = null; for (const cb of h.listeners) cb('SIGNED_OUT', null) }

  it('A 가 다른 탭에서 로그아웃 → A 로 재로그인하면 기존 화면 기록 저장이 다시 된다', async () => {
    h.user = 'user-A'
    const store = await import('../store')
    const a = await store.loadDissectionRecord()
    signOut()
    switchTo('user-A')
    const ok = await store.saveDissectionRecord({ ...a, completed: [...a.completed, { id: 'A-NEW', at: 2000 }] })
    await vi.advanceTimersByTimeAsync(5000)
    expect(ok).toBe(true)
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-A'))).toEqual(['A-OWN', 'A-NEW'])
    expect(h.puts.at(-1)?.owner).toBe('user-A')
  })

  it('A→B→A: B 동안은 거부되고, A 로 돌아오면 A 화면 기록이 A 키에만 저장된다(B 키 불변)', async () => {
    h.user = 'user-A'
    const store = await import('../store')
    const a = await store.loadDissectionRecord()
    switchTo('user-B')
    expect(await store.saveDissectionRecord({ ...a, completed: [...a.completed, { id: 'A-MID', at: 1500 }] })).toBe(false)
    switchTo('user-A')
    const ok = await store.saveDissectionRecord({ ...a, completed: [...a.completed, { id: 'A-MID', at: 1500 }, { id: 'A-NEW', at: 2000 }] })
    await vi.advanceTimersByTimeAsync(5000)
    expect(ok).toBe(true)
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-A'))).toEqual(['A-OWN', 'A-MID', 'A-NEW'])
    expect(ids(h.idb.get('record')?.get('dissection-v1:user-B'))).toEqual(['B-OWN'])
    expect(h.puts.every((p) => p.owner === 'user-A')).toBe(true)
  })
})

describe('공용 기기 — 지연된 getSession 응답(T-0172 r2 P1-2 · CSAT 같은 규칙)', () => {
  it('조회 대기 중 B 이벤트가 오면 늦게 온 A 응답을 쓰지 않는다', async () => {
    h.user = 'user-B'
    const store = await import('../store')
    await store.loadDissectionRecord() // 구독 시작(B)
    h.user = 'user-A'
    let open: () => void = () => {}
    h.gate = new Promise<void>((r) => { open = r })
    const pending = store.loadDissectionRecord() // A 로 조회 시작(응답 지연)
    await untilWaiting()
    switchTo('user-B') // 대기 중 B 로 전환(이벤트)
    h.gate = null
    open()
    const r = await pending
    expect(ids(r)).toEqual(['B-OWN'])
  })
})
