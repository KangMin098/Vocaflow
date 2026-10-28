// apps/web/src/components/practice/__tests__/article-practice-vocab-link.test.tsx
// @vitest-environment node
// 오답 원인 「단어를 몰랐어요」 → 복습하기 목적지 — 기본은 기존 ERROR_CAUSES(전체 Flashcard), 기사 연습 다리는 그 기사의 text: 단어 목록
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))

import type { StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { CauseTip } from '../DcpPlayer'

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

describe('CauseTip 목적지', () => {
  it('교체가 없으면 기존 기본(vocab → /flashcard/play) 그대로', () => {
    expect(hrefs(renderToString(<CauseTip cause="vocab" />))).toEqual(['/flashcard/play'])
  })
  it('기본 href 가 없는 원인은 교체도 없으면 링크 없음', () => {
    expect(hrefs(renderToString(<CauseTip cause="parsing" />))).toEqual([])
  })
  it('교체 href 를 쓴다', () => {
    expect(hrefs(renderToString(<CauseTip cause="vocab" href="/wordvault/browse?filter=text%3Ax" />))).toEqual([
      '/wordvault/browse?filter=text%3Ax',
    ])
  })
})

describe('ArticlePracticeBridge → DcpPlayer causeHref', () => {
  it('vocab 을 이 기사의 text: 범위 목록으로 넘긴다(다른 원인은 기본 유지)', async () => {
    vi.resetModules()
    vi.doMock('@/components/practice/DcpPlayer', () => ({
      DcpPlayer: (p: Record<string, unknown>) => {
        captured.props = p
        return null
      },
    }))
    const { ArticlePracticeBridge, articleVocabHref } = await import('../ArticlePracticeBridge')
    const { StoryAuthSourceContext: Ctx } = await import('@/components/library/story/use-story-auth-guard')
    const as: StoryAuthSource = { subscribe: () => () => {}, currentUserId: async () => 'user-a', testOnlyKnownUserId: () => 'user-a' }
    const item = { id: 'i1', type: 'title' as const, paragraphIdx: 0, payload: { passage: 'p', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: 's', underline: null, summarySentence: null } }
    renderToString(
      <Ctx.Provider value={as}>
        <ArticlePracticeBridge articleId="267ef969-2a3a-4dc9-b6b7-a85246df543f" textId="text-a" ownerId="user-a" items={[item]} />
      </Ctx.Provider>,
    )
    expect(articleVocabHref('text-a')).toBe('/wordvault/browse?filter=text%3Atext-a')
    expect(captured.props?.causeHref).toEqual({ vocab: '/wordvault/browse?filter=text%3Atext-a' })
    expect(captured.props?.backHref).toBe('/text/text-a')
    vi.doUnmock('@/components/practice/DcpPlayer')
  })
})

