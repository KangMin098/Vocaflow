// apps/web/src/components/game/scriptquiz/__tests__/miss-review.test.tsx
// P-2 — 결과 화면 오답 복기: 근거 문장을 본문 맥락에서 강조하고, 다시 고르기 전에는 정답을 펴지 않는다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => '/scriptquiz/play' }))

import { MissReviewItem, buildEvidenceContext, repickMessage } from '../MissReview'
import { ResultScreen } from '../ScriptQuiz'

const PASSAGE = 'The boy walked to the old mill. He found a small key under the stone. Then he ran home to tell his sister.'
const SNIPPET = 'He found a small key under the stone.'
const Q = { id: 'q1', type: 'multiple' as const, question: 'What did he find?', options: [{ text: 'A coin' }, { text: 'A key' }, { text: 'A map' }] }
const A = (snippet: string) => ({ questionId: 'q1', selectedIndex: 0, correctIndex: 1, isCorrect: false, sourceSnippet: snippet, timeMs: 1000 })

describe('buildEvidenceContext', () => {
  it('근거 문장 앞뒤 한 문장씩 붙이고 근거만 표시한다', () => {
    const ctx = buildEvidenceContext(PASSAGE, SNIPPET)
    expect(ctx?.sentences.map((s) => s.isEvidence)).toEqual([false, true, false])
    expect(ctx?.sentences[1].text).toBe(SNIPPET)
  })
  it('본문이 없거나 본문에서 못 찾으면 등록 근거 하나만', () => {
    expect(buildEvidenceContext(undefined, SNIPPET)?.sentences).toEqual([{ text: SNIPPET, isEvidence: true }])
    expect(buildEvidenceContext('Nothing related appears in this text at all.', SNIPPET)?.sentences).toHaveLength(1)
  })
  it('근거가 비면 null', () => {
    expect(buildEvidenceContext(PASSAGE, '  ')).toBeNull()
  })
})

describe('MissReviewItem', () => {
  it('접힌 상태: 내 답만, 정답은 아직 펴지 않고 펼치기 버튼은 44px·aria-expanded', () => {
    const html = renderToString(<ul><MissReviewItem question={Q} answer={A(SNIPPET)} passage={PASSAGE} /></ul>)
    expect(html).toContain('A coin')
    expect(html).not.toContain('data-testid="miss-correct"')
    expect(html).toMatch(/aria-expanded="false"[^>]*class="[^"]*min-h-\[44px\]/)
    expect(html).not.toContain('data-testid="miss-panel"')
  })
  it('펼친 상태: 근거 강조 + 다시 고르기 선지(44px) · 정답 표지 없음', () => {
    const html = renderToString(<ul><MissReviewItem question={Q} answer={A(SNIPPET)} passage={PASSAGE} defaultOpen /></ul>)
    expect(html).toContain('data-testid="miss-evidence"')
    expect(html).toContain('He found a small key under the stone.')
    expect((html.match(/data-repick-option="/g) ?? []).length).toBe(3)
    expect(html).toContain('처음 고른 답')
    expect(html).not.toContain('data-testid="miss-correct"')
    expect(html).toContain('기록·점수에는 들어가지 않아요')
  })
  it('등록 근거가 없으면 다시 고르기를 막고 이유와 정답을 보인다', () => {
    const html = renderToString(<ul><MissReviewItem question={Q} answer={A('')} passage={PASSAGE} /></ul>)
    expect(html).toContain('data-testid="miss-no-evidence"')
    expect(html).toContain('data-testid="miss-correct"')
    expect(html).not.toContain('aria-expanded')
  })
})

describe('repickMessage', () => {
  it('정답·오답·건너뛰기를 구분한다', () => {
    expect(repickMessage(1, 1)).toContain('정답을 골랐어요')
    expect(repickMessage(2, 1)).toContain('이번에도 정답과 달라요')
    expect(repickMessage('reveal', 1)).toContain('표시된 선지가 정답')
  })
})

describe('ResultScreen 연결', () => {
  it('오답마다 복기 항목을 그린다', () => {
    const html = renderToString(
      <ResultScreen
        totalQ={1}
        stats={{ correct: 0, wrong: 1, accuracy: 0, avgTimeSec: 1 }}
        questions={[Q]}
        answers={[A(SNIPPET)]}
        onRetry={() => {}}
        passage={PASSAGE}
      />,
    )
    expect((html.match(/data-testid="miss-item"/g) ?? []).length).toBe(1)
    expect(html).toContain('근거와 대조해 다시 판단하기')
  })
})
