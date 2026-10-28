// apps/web/src/components/flashcard/__tests__/completion-next-reading.test.tsx
// @vitest-environment node
// R0 — Flashcard 복습 완료 화면: 기존 다시 학습 · 돌아가기 뒤에 「다른 글 살펴보기」(/library/scripts) 보조 선택 하나.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/scores/record-score', () => ({ useRecordGameScore: () => {} }))
vi.mock('@/components/recommend/NextActionCard', () => ({ NextActionCard: () => null }))

import { CompletionState } from '@/components/flashcard/CompletionState'
import { NEXT_READING_CHOICE } from '@/lib/learner/next-reading-choice'
import { ARTICLE_NEXT_CHOICE } from '@/components/practice/ArticlePracticeBridge'

const stats = {
  totalCards: 3,
  studiedCards: 3,
  startTime: new Date('2026-10-28T00:00:00Z'),
  durationSeconds: 120,
  ratingCounts: { again: 0, hard: 1, good: 1, easy: 1 },
  difficultWords: [],
  honestyScore: 0,
}

describe('CompletionState 다음 읽기 선택', () => {
  it('돌아가기 뒤 마지막 링크가 서가 「다른 글 살펴보기」다', () => {
    const html = renderToStaticMarkup(<CompletionState stats={stats} backHref="/workspace" onRestart={() => {}} />)
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs.at(-1)).toBe('/library/scripts')
    expect(hrefs).toContain('/workspace')
    expect(html).toContain('data-testid="flashcard-done-next-reading"')
    expect(html).toContain('다른 글 살펴보기')
    expect(html).toContain('min-h-[44px]')
  })

  it('기사 연습 완료와 같은 목적지 · 문구를 쓴다', () => {
    expect(ARTICLE_NEXT_CHOICE).toBe(NEXT_READING_CHOICE)
  })
})
