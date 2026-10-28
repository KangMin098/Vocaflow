// apps/web/src/components/practice/__tests__/article-practice-vocab-link.test.tsx
// @vitest-environment node
// 오답 원인 「단어를 몰랐어요」 → 복습하기 목적지 — 기본은 기존 ERROR_CAUSES(전체 Flashcard), 기사 연습 다리는 서버가 정한 그 기사 단어 출처(set · text · unknown)
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))

import type { StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { CauseTip } from '../DcpPlayer'
import { sanitizeInternalPath } from '@/lib/layout/session-return'
import { applySourceFilter } from '@/lib/wordvault/source-filter'
import { articleVocabHref } from '../ArticlePracticeBridge'

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

describe('ArticlePracticeBridge → DcpPlayer causeHref — 서버가 정한 단어 출처', () => {
  const SET = '5e7a0000-0000-4000-8000-000000000001'
  const OTHER = '5e7a0000-0000-4000-8000-000000000002'
  // 구독 기사 단어는 shared_set_id 만 있고 text_id 가 비어 있다 — 본인 글에서 직접 담은 낱말은 text_id 를 갖는다
  const mine = [
    { id: 1, word: 'bud', setId: SET, textId: null },
    { id: 2, word: 'shoot', setId: SET, textId: null },
    { id: 3, word: 'other', setId: OTHER, textId: null },
    { id: 4, word: 'own', setId: null, textId: 'text-a' },
  ]
  const ids = (href: string) => {
    const f = new URL(href, 'http://x').searchParams.get('filter') ?? ''
    return applySourceFilter(mine, f).map((w) => w.id)
  }

  it('(a) 발행 기사 세트 → set: 범위 · 그 세트 본인 행만(다른 세트 · 전체 노출 없음)', () => {
    const h = articleVocabHref('text-a', { kind: 'set', setId: SET })
    const u = new URL(h, 'http://x')
    expect(u.pathname).toBe('/wordvault/browse')
    expect(u.searchParams.get('filter')).toBe(`set:${SET}`)
    expect(ids(h)).toEqual([1, 2])
    // 같은 기사를 예전처럼 text: 로 보냈다면 구독 단어 0(결함 재현)
    expect(ids(articleVocabHref('text-a', { kind: 'text' }))).toEqual([4])
  })
  it('(b) 실제로 세트 없음 → 본인 글 text: 범위', () => {
    const h = articleVocabHref('text-a', { kind: 'text' })
    expect(new URL(h, 'http://x').searchParams.get('filter')).toBe('text:text-a')
  })
  it('(c) 조회 실패 → 단어 목록을 짐작하지 않고 읽던 글로(전체 단어장 · 다른 세트 아님)', () => {
    const h = articleVocabHref('text-a', { kind: 'unknown' })
    expect(h).toBe('/text/text-a')
    expect(h).not.toContain('/wordvault')
  })
  it('(d) 복귀 경로 from=/text/<본인 글> 은 set · text 모두 유지, SessionFrame 이 받아들이는 내부 경로', () => {
    for (const v of [{ kind: 'set', setId: SET }, { kind: 'text' }] as const) {
      const from = new URL(articleVocabHref('text-a', v), 'http://x').searchParams.get('from')
      expect(from).toBe('/text/text-a')
      expect(sanitizeInternalPath(from)).toBe('/text/text-a')
    }
  })
  it('다리는 loader 의 vocab 그대로 vocab 원인만 교체하고, 복귀 · 다른 원인은 기본 유지', async () => {
    vi.resetModules()
    vi.doMock('@/components/practice/DcpPlayer', () => ({
      DcpPlayer: (p: Record<string, unknown>) => {
        captured.props = p
        return null
      },
    }))
    const { ArticlePracticeBridge, articleVocabHref: hrefOf } = await import('../ArticlePracticeBridge')
    const { StoryAuthSourceContext: Ctx } = await import('@/components/library/story/use-story-auth-guard')
    const as: StoryAuthSource = { subscribe: () => () => {}, currentUserId: async () => 'user-a', testOnlyKnownUserId: () => 'user-a' }
    const item = { id: 'i1', type: 'title' as const, paragraphIdx: 0, payload: { passage: 'p', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: 's', underline: null, summarySentence: null } }
    for (const vocab of [{ kind: 'set', setId: SET }, { kind: 'text' }, { kind: 'unknown' }] as const) {
      captured.props = null
      renderToString(
        <Ctx.Provider value={as}>
          <ArticlePracticeBridge articleId="267ef969-2a3a-4dc9-b6b7-a85246df543f" textId="text-a" ownerId="user-a" items={[item]} vocab={vocab} />
        </Ctx.Provider>,
      )
      const props = captured.props as Record<string, unknown> | null
      expect(props?.causeHref).toEqual({ vocab: hrefOf('text-a', vocab) })
      expect(props?.backHref).toBe('/text/text-a')
    }
    vi.doUnmock('@/components/practice/DcpPlayer')
  })
})
