// apps/web/src/components/practice/__tests__/article-completion-vocab.test.tsx
// T-0212 — 기사 연습 완료 화면의 선택 「이 글의 단어 살펴보기」: set·text 는 같은 결정(articleVocabHref)·unknown 은 생략 · 완료 전 없음 · 비사용 호출자 불변 · 호출 0.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

const h = vi.hoisted(() => ({ done: false, actions: { gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }, submit: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => h.actions)
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: h.submit }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.done && init === 'answering' ? 'done' : init) }
})

import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { DcpPlayer } from '../DcpPlayer'
import { ARTICLE_VOCAB_DONE_LABEL, ArticlePracticeBridge, articleVocabDoneChoice, articleVocabHref } from '../ArticlePracticeBridge'

const SET = '404f4977-7d03-4955-8834-833a668f13af'
const ITEM: DcpItem = { id: 'b69f287f-7d20-4770-8b88-8dfe0050ad0f', type: 'title', paragraphIdx: 0, payload: { passage: 'Lincoln spent summers.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: '제목은?', underline: null, summarySentence: null } }
const as = (uid: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => uid, testOnlyKnownUserId: () => uid })
const bridge = (uid: string | null, vocab: Parameters<typeof articleVocabDoneChoice>[1]) =>
  renderToString(
    <StoryAuthSourceContext.Provider value={as(uid)}>
      <ArticlePracticeBridge articleId="267ef969-2a3a-4dc9-b6b7-a85246df543f" textId="text-a" ownerId="user-a" items={[ITEM]} vocab={vocab} />
    </StoryAuthSourceContext.Provider>,
  )
const choiceOf = (html: string) => /<a[^>]*data-testid="dcp-done-choice"[^>]*>([^<]*)<\/a>/.exec(html)

beforeEach(() => {
  h.done = false
  h.actions.gradeDcpItem.mockClear(); h.actions.recordDcpErrorCause.mockClear(); h.submit.mockClear()
})

describe('articleVocabDoneChoice', () => {
  it('set → 그 세트 · text → 본인 글 필터(같은 결정 · from=/text/<id>) · unknown → 없음', () => {
    const s = articleVocabDoneChoice('text-a', { kind: 'set', setId: SET })
    expect(s).toEqual({ href: articleVocabHref('text-a', { kind: 'set', setId: SET }), label: '이 글의 단어 살펴보기' })
    expect(s?.href).toContain(`filter=set%3A${SET}`)
    expect(s?.href).toContain('from=%2Ftext%2Ftext-a')
    const t = articleVocabDoneChoice('text-a', { kind: 'text' })
    expect(t?.href).toContain('filter=text%3Atext-a')
    expect(articleVocabDoneChoice('text-a', { kind: 'unknown' })).toBeUndefined()
    expect(ARTICLE_VOCAB_DONE_LABEL).not.toMatch(/모르는|복습 예정|마스터|외운/)
  })
})

describe('DcpPlayer doneChoice', () => {
  const player = (done: boolean, doneChoice?: { href: string; label: string }) => {
    h.done = done
    return renderToString(<DcpPlayer items={[ITEM]} backHref="/text/t1" backCta="읽던 글로" nextChoice={{ href: '/library/scripts', label: '다른 글 살펴보기' }} doneChoice={doneChoice} />)
  }
  it('완료 전에는 없다', () => {
    expect(player(false, { href: '/x', label: '이 글의 단어 살펴보기' })).not.toContain('dcp-done-choice')
  })
  it('완료 후: 읽던 글로 → 이 글의 단어 → 다른 글 순서 · 44px · focus-visible', () => {
    const html = player(true, { href: '/wordvault/browse?filter=text%3At1', label: '이 글의 단어 살펴보기' })
    const m = choiceOf(html)
    expect(m?.[1]).toBe('이 글의 단어 살펴보기')
    expect(m?.[0]).toContain('min-h-[44px]')
    expect(m?.[0]).toContain('focus-visible:ring-2')
    expect(html.indexOf('읽던 글로')).toBeLessThan(html.indexOf('이 글의 단어 살펴보기'))
    expect(html.indexOf('이 글의 단어 살펴보기')).toBeLessThan(html.indexOf('다른 글 살펴보기'))
  })
  it('prop 없는 호출자는 출력이 예전과 같다(선택 없음)', () => {
    const a = player(true)
    expect(a).not.toContain('dcp-done-choice')
    expect(a).toContain('다른 글 살펴보기')
  })
  it('렌더만으로 채점 · 원인 기록 호출 0', () => {
    player(true, { href: '/x', label: 'y' })
    expect(h.actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(h.actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
})

describe('ArticlePracticeBridge 완료', () => {
  it('같은 계정 · set/text 완료 → 선택 있음 · unknown → 없음', () => {
    h.done = true
    expect(choiceOf(bridge('user-a', { kind: 'set', setId: SET }))?.[0]).toContain(`set%3A${SET}`)
    h.done = true
    expect(choiceOf(bridge('user-a', { kind: 'text' }))?.[0]).toContain('text%3Atext-a')
    h.done = true
    expect(bridge('user-a', { kind: 'unknown' })).not.toContain('dcp-done-choice')
  })
  it('계정 다름 · 로그아웃이면 완료 선택을 그리지 않는다', () => {
    for (const uid of ['user-b', null]) {
      h.done = true
      const html = bridge(uid, { kind: 'text' })
      expect(html).toContain('article-practice-identity')
      expect(html).not.toContain('dcp-done-choice')
    }
  })
  it('제출 · 기록 호출 0', () => {
    h.done = true
    bridge('user-a', { kind: 'text' })
    expect(h.submit).not.toHaveBeenCalled()
    expect(h.actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(h.actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
})

describe('opt-in 경계', () => {
  it('다른 DcpPlayer 호출부는 doneChoice 를 넘기지 않는다', () => {
    const src = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8')
    // dcp-next-choice.test 와 같은 호출부 목록(교재 · DCP 세션 · 공장 · /fit 체험 · dev) + 교재 다리
    for (const p of ['../TextbookPracticeBridge.tsx', '../../../app/(main)/practice/dcp/session/page.tsx', '../../../app/(main)/library/textbooks/[series]/[step]/practice/page.tsx', '../../csat/factory/FactoryDcpRunner.tsx', '../../textfit/ReadingTrial.tsx', '../../../app/dev/insert-feedback/dev.tsx', '../../../app/dev/meaning-evidence/dev.tsx', '../../../app/dev/vocab-practice/VocabPracticeDev.tsx']) {
      expect(src(p)).not.toContain('doneChoice')
    }
    expect(src('../ArticlePracticeBridge.tsx')).toContain('doneChoice={articleVocabDoneChoice(textId, vocab)}')
  })
})
