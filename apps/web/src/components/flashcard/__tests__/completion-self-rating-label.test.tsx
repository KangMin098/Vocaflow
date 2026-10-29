// apps/web/src/components/flashcard/__tests__/completion-self-rating-label.test.tsx
// @vitest-environment node
// T-0260 — Flashcard 완료의 숫자는 「이번에 몰라요·어려워요로 평가한 카드」다. 확정되지 않은 복습 일정(내일 오전)을 약속하지 않는다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/lib/scores/record-score', () => ({ useRecordGameScore: (p: unknown) => { recorded.calls.push(p) } }))
vi.mock('@/components/recommend/NextActionCard', () => ({ NextActionCard: () => null }))

import { CompletionState } from '@/components/flashcard/CompletionState'

const statsOf = (again: number, hard: number) => ({
  totalCards: 4,
  studiedCards: 4,
  startTime: new Date('2026-10-28T00:00:00Z'),
  durationSeconds: 120,
  ratingCounts: { again, hard, good: 4 - again - hard, easy: 0 },
  difficultWords: [],
  honestyScore: 0,
})
const html = (again: number, hard: number) => renderToStaticMarkup(<CompletionState stats={statsOf(again, hard)} backHref="/workspace" onRestart={() => {}} />).replace(/<!-- -->/g, '')

describe('CompletionState 자기평가 문구', () => {
  it('0건 — 평가한 카드가 없다고 사실대로 · 일정 약속 없음', () => {
    const h = html(0, 0)
    expect(h).toContain('이번에는 「몰라요」·「어려워요」로 평가한 카드가 없어요.')
    expect(h).toContain('몰라요·어려워요')
  })
  it('1건 · 복수 건 — 이번 자기평가 건수로', () => {
    expect(html(1, 0)).toContain('이번에 <strong class="font-display font-[700] not-italic text-[var(--p)]">1개</strong>를 「몰라요」·「어려워요」로 평가했어요.')
    expect(html(1, 2)).toContain('>3개</strong>를 「몰라요」·「어려워요」로 평가했어요.')
  })
  it('확정되지 않은 일정 문구 0 — 「내일」 · 「오전」 · 「다음 만남」 · 「내일 다시」 없음', () => {
    for (const h of [html(0, 0), html(1, 0), html(2, 1)]) for (const w of ['내일', '오전', '다음 만남']) expect(h).not.toContain(w)
  })
  it('점수 payload 는 그대로(ratingCounts · correctCount · accuracy)', () => {
    recorded.calls.length = 0
    html(1, 2)
    expect(recorded.calls[0]).toMatchObject({ module: 'flashcard', score: 1, correctCount: 1, totalQuestions: 4, accuracy: 25, metadata: { ratingCounts: { again: 1, hard: 2, good: 1, easy: 0 } } })
  })
  it('긴 한글 문단은 keep-all 로 줄바꿈(낱말 쪼개짐 방지)', () => {
    expect(html(2, 1)).toMatch(/\[word-break:keep-all\][^>]*>이번에/)
  })
})
