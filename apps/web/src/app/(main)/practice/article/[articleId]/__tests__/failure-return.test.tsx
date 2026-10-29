// apps/web/src/app/(main)/practice/article/[articleId]/__tests__/failure-return.test.tsx
// @vitest-environment node
// T-0206 — 후보 조회 실패(관문 통과 뒤)에만 「읽던 글로 돌아가기」(서버 확인 textId), 관문 실패는 기존 글 목록만. 사유 문구는 그대로.
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ res: null as unknown }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ loadArticlePractice: async () => h.res }))
vi.mock('@/components/practice/ArticlePracticeBridge', () => ({ ArticlePracticeBridge: () => null }))
vi.mock('@/components/ui/ios', () => ({ Screen: ({ children }: { children: unknown }) => children }))

import ArticlePracticePage from '../page'
import { ARTICLE_PRACTICE_REASON } from '@/lib/learner/article-practice-copy'

const render = async (res: unknown) => {
  h.res = res
  return renderToStaticMarkup(await ArticlePracticePage({ params: { articleId: 'a' } }))
}
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])

beforeEach(() => {
  h.res = null
})

describe('연습 실패 뒤 읽던 글 복귀', () => {
  for (const reason of ['not_installed', 'query_failed', 'no_items'] as const) {
    it(`${reason}: 사유 문구 그대로 + 서버 확인 본인 글로 돌아가기`, async () => {
      const html = await render({ ok: false, reason, returnTextId: 'text-own-9' })
      expect(html).toContain(ARTICLE_PRACTICE_REASON[reason])
      expect(html).toContain(`data-reason="${reason}"`)
      expect(html).toMatch(/data-testid="article-practice-return"[^>]*>.*읽던 글로 돌아가기/)
      expect(hrefs(html)).toEqual(['/library/scripts', '/text/text-own-9'])
      expect(html).toContain('min-h-[44px]')
    })
  }
  for (const reason of ['bad_article', 'signed_out', 'blocked_account', 'not_opened', 'stale_copy', 'lookup_failed'] as const) {
    it(`${reason}: 복귀 링크 없음 · 기존 글 목록만`, async () => {
      const html = await render({ ok: false, reason })
      expect(html).toContain(ARTICLE_PRACTICE_REASON[reason])
      expect(html).not.toContain('article-practice-return')
      expect(hrefs(html)).toEqual(['/library/scripts'])
    })
  }
  it('성공: 기존 머리 링크(읽던 글로)만, 실패 복귀 링크 없음', async () => {
    const html = await render({ ok: true, textId: 't1', ownerId: 'u', items: [], vocab: { kind: 'text' } })
    expect(hrefs(html)).toEqual(['/text/t1'])
    expect(html).not.toContain('article-practice-return')
  })
})
