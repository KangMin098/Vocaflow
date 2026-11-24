// apps/web/src/components/practice/__tests__/article-practice-bridge.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))

import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import type { StoryAuthStatus } from '@/components/library/story/use-story-auth-guard'
import { ArticlePracticeBridge, articlePracticeDoneCopy, makeArticleGrade } from '../ArticlePracticeBridge'

const ART = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const CTX = { articleId: ART, textId: 'text-a', ownerId: 'user-a' }
const item = { id: 'b69f287f-7d20-4770-8b88-8dfe0050ad0f', type: 'title' as const, paragraphIdx: 0, payload: { passage: 'Lincoln spent summers at a quiet cottage.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: '다음 글의 제목으로 가장 적절한 것은?', underline: null, summarySentence: null } }

const guardOf = (...seq: StoryAuthStatus[]) => {
  let i = 0
  return { getStatus: () => seq[Math.min(i++, seq.length - 1)] }
}

describe('makeArticleGrade — 문맥 · 신원', () => {
  it('신원이 같으면 loader 문맥 그대로 · 선택값만 넘긴다(다른 키는 버린다)', async () => {
    const submit = vi.fn(async () => ({ ok: true as const, correct: true, attemptId: 'x', answerKey: null }))
    const r = await makeArticleGrade(CTX, guardOf('same'), submit)(item.id, { choice: 2, extra: 'ignored' })
    expect(submit).toHaveBeenCalledWith(CTX, item.id, { choice: 2 })
    expect(r.ok).toBe(true)
  })
  it('그려 둔 콜백을 신원이 바뀐 뒤 부르면 서버로 보내지 않는다', async () => {
    const submit = vi.fn()
    for (const st of ['changed', 'checking'] as const) {
      expect((await makeArticleGrade(CTX, guardOf(st), submit)(item.id, { choice: 1 })).ok).toBe(false)
    }
    expect(submit).not.toHaveBeenCalled()
  })
  it('응답이 오기 전에 신원이 바뀌면 결과를 버린다(늦은 A 결과)', async () => {
    const submit = vi.fn(async () => ({ ok: true as const, correct: true, attemptId: 'x', answerKey: { explanation_ko: 'A 의 해설' } }))
    const r = await makeArticleGrade(CTX, guardOf('same', 'changed'), submit)(item.id, { choice: 1 })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: false, error: '로그인 상태가 바뀌었어요. 글을 다시 열어 주세요.' })
  })
})

describe('ArticlePracticeBridge', () => {
  const as = (uid: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => uid, testOnlyKnownUserId: () => uid })
  const render = (uid: string | null) =>
    renderToString(
      <StoryAuthSourceContext.Provider value={as(uid)}>
        <ArticlePracticeBridge articleId={ART} textId="text-a" ownerId="user-a" items={[item]} vocab={{ kind: 'text' }} />
      </StoryAuthSourceContext.Provider>,
    )
  it('같은 계정: 첫 문항을 기존 플레이어로(정답 없음) · 소유자 uid 는 마크업에 없다', () => {
    const html = render('user-a')
    expect(html).toContain('Lincoln spent summers at a quiet cottage.')
    expect(html).toContain('다음 글의 제목으로 가장 적절한 것은?')
    expect(html).not.toContain('user-a')
  })
  it('다른 계정 · 로그아웃: 문항을 그리지 않는다', () => {
    for (const uid of ['user-b', null]) {
      const html = render(uid)
      expect(html).toContain('data-testid="article-practice-identity"')
      expect(html).not.toContain('Lincoln spent summers')
    }
  })
  it('완료 문구는 관측 결과만 — 향상 · 이해를 말하지 않고 발췌 연습이라고 한다', () => {
    const c = articlePracticeDoneCopy({ total: 2, correct: 1 })
    expect(c.title).toBe('2문제 중 1문제를 맞혔어요')
    expect(c.body).toContain('발췌문')
    expect(`${c.title} ${c.body}`).not.toMatch(/실력|향상|단단|이해하셨/)
  })
})
