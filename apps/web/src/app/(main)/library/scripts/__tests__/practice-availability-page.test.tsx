// apps/web/src/app/(main)/library/scripts/__tests__/practice-availability-page.test.tsx
// @vitest-environment node
// T-0215 — 서가 페이지는 요청당 연습 조회 RPC 를 한 번만 부르고 결과를 그대로 목록에 넘긴다. 카드 표시는 「연습 있음 · N문항」, 없으면 없다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ calls: [] as string[], captured: null as unknown, user: 'u1' as string | null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user ? { id: h.user } : null } }) },
    rpc: async (fn: string) => {
      h.calls.push(fn)
      return { data: [{ article_id: '267ef969-2a3a-4dc9-b6b7-a85246df543f', item_count: 2 }], error: null }
    },
    from: () => ({}),
  }),
}))
vi.mock('@/lib/supabase/paged-select', () => ({
  pagedSelect: async () => [
    { id: '267ef969-2a3a-4dc9-b6b7-a85246df543f', title: 'A' },
    { id: '11111111-1111-4111-8111-111111111111', title: 'B' },
  ],
}))
vi.mock('@/lib/library/publish-gate', () => ({ applyArticleCatalogGate: (q: unknown) => q }))
vi.mock('@/components/library/browse/ScriptsBrowser', () => ({ ScriptsBrowser: (p: unknown) => ((h.captured = p), null) }))
vi.mock('@/components/library/LibraryBrowseFrame', () => ({ LibraryBrowseFrame: ({ children }: { children: unknown }) => children }))
vi.mock('@/components/layout/AreaHero', () => ({ AreaHero: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('@/lib/articles/start-learning', () => ({ startArticleLearning: async () => ({ ok: false }) }))

import LibraryScriptsPage from '../page'
import { ArticleCard } from '@/components/library/browse/ArticleCard'

describe('서가 「연습 있음」 — 페이지 1회 조회', () => {
  it('로그인: RPC 는 article_practice_availability 한 번, 목록에 결과를 넘긴다', async () => {
    h.calls = []; h.user = 'u1'
    renderToStaticMarkup(await LibraryScriptsPage({ searchParams: {} }))
    expect(h.calls).toEqual(['article_practice_availability'])
    expect((h.captured as { practice: unknown }).practice).toEqual({ state: 'ok', counts: { '267ef969-2a3a-4dc9-b6b7-a85246df543f': 2 } })
  })
  it('로그아웃: RPC 0회 · signed_out', async () => {
    h.calls = []; h.user = null
    renderToStaticMarkup(await LibraryScriptsPage({ searchParams: {} }))
    expect(h.calls).toEqual([])
    expect((h.captured as { practice: unknown }).practice).toEqual({ state: 'signed_out' })
  })
})

describe('ArticleCard 「연습 있음」', () => {
  const article = { id: 'a1', title: 'T', author: null, source: 'voa', source_url: null, cefr_level: 'B1', word_count: 300, reading_minutes: 2, category_tags: [], published_at: null, article_v_level: 5, register: null, audio_url: null, adapted_from_id: null } as never
  it('문항 수가 있으면 「연습 있음 · N문항」', () => {
    const html = renderToStaticMarkup(<ArticleCard article={article} userVLevel={5} practiceCount={2} />)
    expect(html).toContain('data-testid="article-practice-available"')
    expect(html.replace(/<!-- -->/g, "")).toContain("연습 있음 · 2문항")
  })
  it('없으면(null · 0) 표시 없음 — featured 도 같다', () => {
    expect(renderToStaticMarkup(<ArticleCard article={article} userVLevel={5} />)).not.toContain('article-practice-available')
    expect(renderToStaticMarkup(<ArticleCard article={article} userVLevel={5} practiceCount={0} />)).not.toContain('article-practice-available')
    expect(renderToStaticMarkup(<ArticleCard article={article} userVLevel={5} featured practiceCount={2} />)).toContain('article-practice-available')
  })
})
