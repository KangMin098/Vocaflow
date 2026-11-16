// apps/web/src/lib/csat/judgment/__tests__/provider.test.ts
// 제품 RevealProvider — 라우트 계약(본문 · 상태 코드 → 실패 이유 · 멱등 키)을 본다. 실제 서버 공개 제어는 여기서 검증되지 않는다.
import { describe, expect, it, vi } from 'vitest'
import { itemsOf, revealOf } from '../fixtures'
import { judgmentRouteProvider, uuidV4 } from '../provider'
import { RevealError } from '../types'

const item = itemsOf('R-IRRELEVANT')[0]
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('judgmentRouteProvider', () => {
  it('학습자 요청 때 판단 라우트에 판본 · 멱등 키 · 출처를 보내고 judgment 를 돌려준다', async () => {
    const reveal = await revealOf('R-IRRELEVANT', item.id)
    const fetch = vi.fn(async () => json(200, { ok: true, exposureId: 'e1', reveal: {}, judgment: reveal }))
    const p = judgmentRouteProvider('H2609G2-35', { fetch, newId: () => '11111111-1111-4111-8111-111111111111' })
    expect(fetch).not.toHaveBeenCalled()
    await expect(p(item)).resolves.toEqual(reveal)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/csat/item/H2609G2-35/judgment')
    expect(init.method).toBe('POST')
    expect(init.cache).toBe('no-store')
    expect(JSON.parse(String(init.body))).toEqual({ analysisVersion: item.version.analysisVersion, clientExposureId: '11111111-1111-4111-8111-111111111111', source: 'judgment_scene' })
  })

  it('같은 문항 재시도는 같은 노출 id 를 다시 보낸다(원장 중복 없음)', async () => {
    let n = 0
    const fetch = vi.fn(async () => json(503, { ok: false }))
    const p = judgmentRouteProvider('s', { fetch, newId: () => `id-${++n}` })
    await expect(p(item)).rejects.toBeInstanceOf(RevealError)
    await expect(p(item)).rejects.toBeInstanceOf(RevealError)
    const ids = fetch.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)).clientExposureId)
    expect(ids).toEqual(['id-1', 'id-1'])
  })

  it.each([
    [401, 'auth'], [409, 'version'], [423, 'held'], [503, 'fetch'], [404, 'fetch'],
  ] as const)('상태 %i → %s', async (status, reason) => {
    const p = judgmentRouteProvider('s', { fetch: async () => json(status, { ok: false }), newId: () => 'x' })
    await expect(p(item)).rejects.toMatchObject({ reason })
  })

  it('uuidV4 는 randomUUID 가 없는 비보안 컨텍스트에서도 라우트가 받는 uuid 형식을 만든다', () => {
    const orig = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const ids = new Set(Array.from({ length: 50 }, () => uuidV4()))
      expect(ids.size).toBe(50)
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: orig, configurable: true })
    }
  })

  it('네트워크 실패는 fetch, judgment 없는 200 은 shape — 정답 없는 응답을 성공으로 만들지 않는다', async () => {
    await expect(judgmentRouteProvider('s', { fetch: async () => { throw new TypeError('net') }, newId: () => 'x' })(item)).rejects.toMatchObject({ reason: 'fetch' })
    await expect(judgmentRouteProvider('s', { fetch: async () => json(200, { ok: true, reveal: {} }), newId: () => 'x' })(item)).rejects.toMatchObject({ reason: 'shape' })
    await expect(judgmentRouteProvider('s', { fetch: async () => new Response('<html>', { status: 200 }), newId: () => 'x' })(item)).rejects.toMatchObject({ reason: 'shape' })
  })
})
