// scripts/comic/pd/__tests__/fetch-retry.test.mjs
//
// 취득 재시도 회귀 — **조용한 페이지 결손을 막는 층**.
//
// 왜 이 테스트가 있나 (실측 2026-08-17):
//   IA 는 `/download/<id>/page/nN_w1600.jpg` 에서 jp2→JPEG 를 요청 시점에 만들어 준다.
//   부하가 걸리면 502 를 주는데 같은 URL 을 잠시 뒤 다시 치면 200 이 온다.
//   재시도가 없던 동안 31쪽짜리 호가 19쪽으로 취득됐고, **취득 단계는 exit 0 으로 끝났다.**
//   페이지가 빠진 만화가 복원·분할을 통과해 발행 대기열까지 갔다 — 에러 하나 없이.
//
//   그래서 두 가지를 고정한다: ① 일시 실패는 재시도한다 ② 영구 실패(4xx)는 재시도하지 않는다.
//   ②가 없으면 없는 파일을 5번씩 두드리며 969건 적재가 몇 배로 느려진다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRetry, isTransient } from '../sources/types.mjs'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

/** status 를 순서대로 돌려주는 가짜 fetch. */
function mockFetchSequence(statuses) {
  const calls = { n: 0 }
  globalThis.fetch = vi.fn(async () => {
    const s = statuses[Math.min(calls.n, statuses.length - 1)]
    calls.n += 1
    if (s === 'throw') throw new Error('ECONNRESET')
    return { ok: s >= 200 && s < 300, status: s }
  })
  return calls
}

describe('isTransient — 무엇을 다시 시도할 것인가', () => {
  it('5xx · 429 · 408 은 일시적', () => {
    for (const s of [500, 502, 503, 504, 429, 408]) expect(isTransient(s)).toBe(true)
  })

  it('4xx 는 영구적 — 없는 파일을 반복해서 두드리지 않는다', () => {
    for (const s of [400, 401, 403, 404, 410]) expect(isTransient(s)).toBe(false)
  })
})

describe('fetchRetry', () => {
  it('502 뒤 200 이면 성공을 돌려준다 (실측 시나리오)', async () => {
    const calls = mockFetchSequence([502, 502, 200])
    const res = await fetchRetry('https://x/page.jpg', { baseMs: 1 })
    expect(res.ok).toBe(true)
    expect(calls.n).toBe(3)
  })

  it('404 는 즉시 돌려준다 — 재시도하지 않는다', async () => {
    const calls = mockFetchSequence([404])
    const res = await fetchRetry('https://x/none.jpg', { baseMs: 1 })
    expect(res.status).toBe(404)
    expect(calls.n).toBe(1)
  })

  it('네트워크 예외도 재시도한다', async () => {
    const calls = mockFetchSequence(['throw', 200])
    const res = await fetchRetry('https://x/page.jpg', { baseMs: 1 })
    expect(res.ok).toBe(true)
    expect(calls.n).toBe(2)
  })

  it('재시도를 소진하면 마지막 응답을 돌려준다 (호출자가 판단하게)', async () => {
    const calls = mockFetchSequence([503])
    const res = await fetchRetry('https://x/page.jpg', { attempts: 3, baseMs: 1 })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(503)
    expect(calls.n).toBe(3)
  })

  it('끝까지 예외만 나면 던진다 — 조용히 null 로 만들지 않는다', async () => {
    mockFetchSequence(['throw'])
    await expect(fetchRetry('https://x/p.jpg', { attempts: 2, baseMs: 1 })).rejects.toThrow(/재시도/)
  })

  it('재시도할 때마다 사유를 알린다 (진단 가능해야 한다)', async () => {
    mockFetchSequence([502, 200])
    const seen = []
    await fetchRetry('https://x/p.jpg', { baseMs: 1, onRetry: (n, why) => seen.push(`${n}:${why}`) })
    expect(seen).toEqual(['1:HTTP 502'])
  })
})
