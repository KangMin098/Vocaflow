// apps/web/src/components/practice/__tests__/revisit-reading.test.tsx
// R0-REVISIT-READ-01 — 완료 뒤 다시 보기의 「읽은 글 참고」(opt-in): 넣은 호출자만 · 접힌 채 시작 · 결속 키가 자료/계정/본문 변경을 가른다.
// 여닫기 · 초점 · 요약 복귀 흐름은 PC 하네스(pc-t231)가 실제 컴포넌트로 잰다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpGradeOk, DcpItem } from '@/lib/learner/dcp'

const actions = vi.hoisted(() => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => actions)
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))

import { DcpRevisitView, type SeenFeedback } from '../DcpPlayer'
import { ArticleReadingReference } from '../ArticleReadingReference'
import { articlePlayerKey, nextReadingGeneration } from '../ArticlePracticeBridge'

const PASSAGE = 'The bakery opens early. People line up because the owner bakes by hand.'
const A: DcpItem = { id: 'a', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['Handmade Bread', 'Cold Mornings', 'City Traffic', 'Online Shops', 'Old Corners'], stemKo: '제목은?', underline: null, summarySentence: null } }
const wrong: DcpGradeOk = { ok: true, correct: false, attemptId: 'att-1', answerKey: { answer: 1, explanation_ko: '손으로 굽는 빵 이야기가 글 전체에 이어진다.' } }
const entry: SeenFeedback = { item: A, result: wrong, submitted: { choice: 3 } }

describe('DcpRevisitView extra', () => {
  it('넣으면 다시 보기 안에 「읽은 글 참고」 — 접힌 채 · 본문 패널 없음', () => {
    const html = renderToString(<DcpRevisitView entry={entry} items={[A]} onBack={() => {}} extra={<ArticleReadingReference text="Full article text here." />} />)
    expect(html).toContain('data-testid="reading-reference-toggle"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('reading-reference-panel')
    expect(html).toContain('요약으로')
  })
  it('넣지 않으면 예전 다시 보기 그대로(다른 호출자 불변)', () => {
    const html = renderToString(<DcpRevisitView entry={entry} items={[A]} onBack={() => {}} />)
    expect(html).not.toContain('reading-reference')
    expect(html).toContain('이미 본 해설 다시 보기')
  })
})

describe('articlePlayerKey · nextReadingGeneration — 자료 · 계정 · 본문 결속', () => {
  const base = articlePlayerKey('art', 'txt', 'own', 0)
  it('같은 입력은 같은 키 · 기사/본인 글/계정/본문 세대 하나만 바뀌어도 다른 키', () => {
    expect(articlePlayerKey('art', 'txt', 'own', 0)).toBe(base)
    for (const k of [articlePlayerKey('art2', 'txt', 'own', 0), articlePlayerKey('art', 'txt2', 'own', 0), articlePlayerKey('art', 'txt', 'own2', 0), articlePlayerKey('art', 'txt', 'own', 1)]) expect(k).not.toBe(base)
  })
  it('본문은 문자열 그대로 비교 — 32비트 해시 · 길이가 같은 충돌 쌍도 다른 세대(T-0231 리뷰 반례)', () => {
    const a = 'The code Aa identifies this sample.', b = 'The code BB identifies this sample.'
    expect(a.length).toBe(b.length)
    const g0 = { text: a, gen: 0 }
    const g1 = nextReadingGeneration(g0, b)
    expect(g1).toEqual({ text: b, gen: 1 })
    expect(nextReadingGeneration(g1, b)).toBe(g1) // 같은 본문이면 그대로(불필요한 재시작 없음)
    expect(nextReadingGeneration(g1, null).gen).toBe(2)
    expect(nextReadingGeneration(g1, a).gen).toBe(2)
  })
})
