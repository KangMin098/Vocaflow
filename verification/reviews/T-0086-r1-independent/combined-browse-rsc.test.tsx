// apps/web/src/app/(main)/wordvault/__tests__/map-preparation.test.tsx
// T-0086 — /wordvault/browse RSC: 지도에서 온 경우만 복귀 막대 + 같은 문맥의 복습 링크 · 조회 실패 ≠ 0 · 일반 진입 · 도서 문맥 보존. DB 없음
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let failVocab = false
let rows: Array<Record<string, unknown>> = []
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') }, useRouter: () => ({ push: () => {}, replace: () => {} }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }) }))
vi.mock('@/lib/wordvault/browse-queries', async (orig) => ({
  ...(await orig<typeof import('@/lib/wordvault/browse-queries')>()),
  fetchUserVocabularies: async () => { if (failVocab) throw new Error('read failed'); return rows },
  fetchUserTextChips: async () => [],
  fetchUserSetChips: async () => [],
}))

import BrowsePage from 'D:/workspace/Vocaflow-main-serving/apps/web/src/app/(main)/wordvault/browse/page'

const sp = { from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: '11111111-2222-4333-8444-555555555555', map_plan: '3', map_goal: '7' }
const html = async (searchParams: Record<string, string>) => renderToStaticMarkup(await BrowsePage({ searchParams }))
const review = (h: string) => [...h.matchAll(/href="([^"]*\/wordvault\/review[^"]*)"/g)].map((m) => m[1].replaceAll('&amp;', '&'))

beforeEach(() => {
  failVocab = false
  rows = []
})

describe('/wordvault/browse 지도 준비(T-0086)', () => {
  it('지도에서 온 목록 = 복귀 막대 + 같은 문맥의 복습 링크(수행 ID 버림)', async () => {
    const h = await html({ ...sp, map_item: 'authored:x', map_attempt: '42' })
    expect(h).toContain('data-testid="vocab-map-return"')
    const [r] = review(h)
    const u = new URL(r, 'http://x')
    expect(u.searchParams.get('map_task')).toBe('v.core_meaning')
    expect(u.searchParams.get('map_ws')).toBe(sp.map_ws)
    expect(r).not.toMatch(/map_item|map_attempt/)
    const back = h.match(/data-testid="vocab-map-return"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-testid="vocab-map-return"/)!
    expect((back[1] ?? back[2]).replaceAll('&amp;', '&')).toContain('/csat/diagnosis?tab=map&view=full&map_task=v.core_meaning')
  })
  it('필터 · 도서 파라미터와 함께 와도 막대 유지(기존 파라미터 처리 보존)', async () => {
    expect(await html({ ...sp, filter: 'state:new', q: 'run', level: 'B1' })).toContain('vocab-map-return')
  })
  it('일반 진입 = 지도 안내 없음', async () => {
    const h = await html({ filter: 'all' })
    expect(h).not.toContain('vocab-map-bar')
    expect(h).not.toContain('학습 지도')
  })
  it('지도에서 온 조회 실패 = 실패 안내 + 돌아갈 길(빈 목록 아님) · 일반 진입 실패는 기존대로 throw', async () => {
    failVocab = true
    const h = await html(sp)
    expect(h).toContain('vocab-browse-load-failed')
    expect(h).toContain('vocab-map-return')
    expect(h).not.toContain('empty-vault')
    await expect(html({})).rejects.toThrow('read failed')
  })
})
