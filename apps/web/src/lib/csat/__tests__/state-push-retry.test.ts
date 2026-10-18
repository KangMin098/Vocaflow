// apps/web/src/lib/csat/__tests__/state-push-retry.test.ts
// FI-015(#308) 클라이언트 계약 — 서버가 비교 갱신에서 밀려 409(또는 5xx · 네트워크 오류)를 주면 같은 기기 기록을 간격을 늘려 다시 보낸다.
//   성공하면 멈추고, 상한(PUSH_RETRY_MAX)에 닿으면 멈춰 「이 기기에만」으로 남긴다(성공으로 표시하지 않는다). 새 저장은 재전송 횟수를 되돌린다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
let responses: (number | 'net')[] = []

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
  calls.length = 0
  // 브라우저 흉내: window(재전송 타이머 조건) · indexedDB 없음(기기 저장은 이 시험 범위 밖)
  vi.stubGlobal('window', { addEventListener: () => {} })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(String(init?.method ?? 'GET'))
    const r = responses.shift() ?? 200
    if (r === 'net') throw new TypeError('network')
    return new Response('{}', { status: r })
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const record = (n: number) => ({ version: 1, seed: n, onboarded: true, predictions: [], formulas: [], queue: [], completed: [] }) as never

describe('state 재전송(FI-015)', () => {
  it('409 → 재전송 → 200 이면 멈추고 동기화 성공', async () => {
    responses = [409, 200]
    const store = await import('../session/store')
    await store.saveDissectionRecord(record(1))
    await vi.advanceTimersByTimeAsync(1500) // 첫 전송 → 409
    expect(calls).toEqual(['PUT'])
    await vi.advanceTimersByTimeAsync(store.pushDelay(1)) // 재전송 → 200
    expect(calls).toEqual(['PUT', 'PUT'])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(2)
    expect(store.syncStatus().okAt).not.toBeNull()
  })

  it('계속 409 면 상한까지만 다시 보내고 멈춘다 — 마지막 상태는 실패(「이 기기에만」)', async () => {
    responses = Array(20).fill(409)
    const store = await import('../session/store')
    await store.saveDissectionRecord(record(2))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(calls).toHaveLength(1 + store.PUSH_RETRY_MAX)
    const s = store.syncStatus()
    expect(s.failAt).not.toBeNull()
    expect(s.okAt).toBeNull()
  })

  it('네트워크 오류 · 5xx 도 재전송한다', async () => {
    responses = ['net', 503, 200]
    const store = await import('../session/store')
    await store.saveDissectionRecord(record(3))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(calls).toEqual(['PUT', 'PUT', 'PUT'])
    expect(store.syncStatus().okAt).not.toBeNull()
  })

  it('400(잘못된 기록)은 다시 보내지 않는다', async () => {
    responses = [400]
    const store = await import('../session/store')
    await store.saveDissectionRecord(record(4))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(calls).toEqual(['PUT'])
  })

  it('상한에 닿은 뒤 새 저장이 오면 횟수가 되돌아가 다시 동기화한다', async () => {
    responses = [...Array(6).fill(409), 200]
    const store = await import('../session/store')
    await store.saveDissectionRecord(record(5))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(calls).toHaveLength(6)
    await store.saveDissectionRecord(record(6))
    await vi.advanceTimersByTimeAsync(1500)
    expect(calls).toHaveLength(7)
    expect(store.syncStatus().okAt).not.toBeNull()
  })
})
