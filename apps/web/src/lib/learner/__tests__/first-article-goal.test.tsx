// apps/web/src/lib/learner/__tests__/first-article-goal.test.tsx
// @vitest-environment node
// R0-C2-01 — 임시 목표 「짧은 글 한 편」: 발행 목록 ∩ 양수 문항 id, 상태 구분, 기존 카드 재사용, 진단·적합 문구 없음.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }))
// next/link 대역 — prefetch 속성을 마크업에 남겨 패널/일반 카드를 비교한다.
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return { default: ({ href, prefetch, children, ...r }: { href: string; prefetch?: boolean; children?: unknown }) => createElement('a', { href, 'data-prefetch': prefetch === undefined ? 'default' : String(prefetch), ...r }, children as never) }
})
vi.mock('@/lib/articles/start-learning', () => ({ startArticleLearning: async () => ({ ok: false }) }))

import { classifyPracticeAvailability, practiceReadyArticles } from '@/lib/learner/article-practice-availability'
import { FIRST_ARTICLE_GOAL_LABEL, FirstArticleGoal } from '@/components/library/browse/FirstArticleGoal'

const A = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const B = '11111111-1111-4111-8111-111111111111'
const OUTSIDE = '22222222-2222-4222-8222-222222222222'
const art = (id: string, title = `T-${id.slice(0, 4)}`) =>
  ({ id, title, author: null, source: 'voa', source_url: null, cefr_level: 'B1', word_count: 300, reading_minutes: 2, category_tags: [], published_at: null, article_v_level: 5, register: null, audio_url: null, adapted_from_id: null }) as never

describe('practiceReadyArticles — 교집합', () => {
  it('공개 목록 밖 id 는 버리고 목록 순서를 지킨다', () => {
    const r = practiceReadyArticles([art(B), art(A)], { state: 'ok', counts: { [A]: 2, [B]: 1, [OUTSIDE]: 9 } })
    expect(r).toEqual({ state: 'ok', items: [{ article: art(B), count: 1 }, { article: art(A), count: 2 }] })
  })
  it('결과 0 · 1 · 대소문자 · 중복 카드', () => {
    expect(practiceReadyArticles([art(A)], { state: 'ok', counts: {} })).toEqual({ state: 'ok', items: [] })
    expect(practiceReadyArticles([art(A.toUpperCase()), art(A)], { state: 'ok', counts: { [A]: 3 } })).toMatchObject({ state: 'ok', items: [{ count: 3 }] })
  })
  it('signed_out · failed · null 은 「없음」 과 구분된다', () => {
    expect(practiceReadyArticles([art(A)], { state: 'signed_out' })).toEqual({ state: 'signed_out' })
    expect(practiceReadyArticles([art(A)], { state: 'failed' })).toEqual({ state: 'failed' })
    expect(practiceReadyArticles([art(A)], null)).toEqual({ state: 'failed' })
  })
  it('잘못된 RPC 행은 기존 loader 계약대로 failed → 목록도 failed', () => {
    const av = classifyPracticeAvailability({ data: [{ article_id: A, item_count: 2 }, { article_id: 'x', item_count: 1 }], error: null })
    expect(practiceReadyArticles([art(A)], av)).toEqual({ state: 'failed' })
  })
})

describe('FirstArticleGoal — 화면', () => {
  const html = (p: Parameters<typeof FirstArticleGoal>[0]) => renderToStaticMarkup(<FirstArticleGoal {...p} />).replace(/<!-- -->/g, '')
  it('처음에는 닫힌 선택 단추만 — 카드 0', () => {
    const h = html({ articles: [art(A)], practice: { state: 'ok', counts: { [A]: 2 } }, userVLevel: 5 })
    expect(h).toContain('first-article-goal-open')
    expect(h).toContain(FIRST_ARTICLE_GOAL_LABEL)
    expect(h).not.toContain('/library/scripts/' + A)
  })
  it('열면 교집합 글만 기존 카드(글 주소 그대로)로 · 닫기 단추', () => {
    const h = html({ articles: [art(A), art(B)], practice: { state: 'ok', counts: { [A]: 2, [OUTSIDE]: 1 } }, userVLevel: 5, initialOpen: true })
    expect(h).toContain(`href="/library/scripts/${A}"`)
    expect(h).not.toContain(`/library/scripts/${B}`)
    expect(h).not.toContain(OUTSIDE)
    expect(h).toContain('연습 있음 · 2문항')
    expect(h).toContain('연습이 준비된 글 1편')
    expect(h).toContain('전체 탐색으로 돌아가기')
  })
  it('여러 편', () => {
    const h = html({ articles: [art(A), art(B)], practice: { state: 'ok', counts: { [A]: 2, [B]: 1 } }, userVLevel: 5, initialOpen: true })
    expect(h).toContain('연습이 준비된 글 2편')
  })
  it('빈 결과 · 로그아웃 · 실패는 서로 다른 문구', () => {
    const empty = html({ articles: [art(A)], practice: { state: 'ok', counts: {} }, userVLevel: 5, initialOpen: true })
    const out = html({ articles: [art(A)], practice: { state: 'signed_out' }, userVLevel: 5, initialOpen: true })
    const fail = html({ articles: [art(A)], practice: { state: 'failed' }, userVLevel: 5, initialOpen: true })
    expect(empty).toContain('first-article-goal-empty')
    expect(out).toContain('first-article-goal-signed-out')
    expect(out).toContain('href="/login?next=%2Flibrary%2Fscripts"')
    expect(fail).toContain('first-article-goal-failed')
    for (const h of [empty, out, fail]) expect(h).not.toContain('first-article-goal-list')
  })
  it('패널 카드에는 적합 표지 0 · 일반 카드는 그대로', async () => {
    const { ArticleCard } = await import('@/components/library/browse/ArticleCard')
    const h = html({ articles: [art(A), art(B)], practice: { state: 'ok', counts: { [A]: 2, [B]: 1 } }, userVLevel: 5, initialOpen: true })
    expect(h).not.toContain('data-testid="article-fit"')
    expect(renderToStaticMarkup(<ArticleCard article={art(A)} userVLevel={5} />)).toContain('data-testid="article-fit"')
  })
  it('패널 카드 · 로그인 링크는 prefetch false · 일반 카드는 기본 그대로', async () => {
    const { ArticleCard } = await import('@/components/library/browse/ArticleCard')
    const list = html({ articles: [art(A), art(B)], practice: { state: 'ok', counts: { [A]: 2, [B]: 1 } }, userVLevel: 5, initialOpen: true })
    const links = list.match(/<a [^>]*>/g) ?? []
    expect(links.length).toBe(2)
    for (const l of links) expect(l).toContain('data-prefetch="false"')
    const login = (html({ articles: [art(A)], practice: { state: 'signed_out' }, userVLevel: 5, initialOpen: true }).match(/<a [^>]*>/g) ?? []).filter((l) => l.includes('href="/login'))
    expect(login).toHaveLength(1)
    expect(login[0]).toContain('data-prefetch="false"')
    expect(renderToStaticMarkup(<ArticleCard article={art(A)} userVLevel={5} />)).toContain('data-prefetch="default"')
    expect(renderToStaticMarkup(<ArticleCard article={art(A)} userVLevel={5} featured />)).toContain('data-prefetch="default"')
  })
  it('진단 · 수준 적합 · 성취 보장 문구 없음', () => {
    const h = html({ articles: [art(A)], practice: { state: 'ok', counts: { [A]: 2 } }, userVLevel: 5, initialOpen: true })
    const goal = h.slice(0, h.indexOf('first-article-goal-list'))
    for (const w of ['진단', '수준에 맞', '추천', '보장', '달성']) expect(goal).not.toContain(w)
  })
})
