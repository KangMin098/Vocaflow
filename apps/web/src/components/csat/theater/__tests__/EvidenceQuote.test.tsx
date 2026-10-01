// apps/web/src/components/csat/theater/__tests__/EvidenceQuote.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { capQuoteWords } from '@/lib/csat/learner'
import { EvidenceQuote } from '../EvidenceQuote'

const render = (passage: string | null, quote: string | null, truncated = false) =>
  renderToStaticMarkup(<EvidenceQuote passage={passage} quote={quote} truncated={truncated} />)

describe('학습자 인용 블록 — 현재 지문 대조', () => {
  it('지문 첫 글자부터 일치하는 인용도 표시한다', () => {
    expect(render('The cat sat. Then it slept.', 'The cat sat.')).toBe('<blockquote lang="en">The cat sat.</blockquote>')
  })

  it('따옴표·대시·줄바꿈 차이는 공용 매칭기로 허용한다', () => {
    const html = render('She said “read”—then\n\nreview.', 'She said "read"-then review.')
    expect(html).toContain('<blockquote')
    expect(html).toContain('review.')
  })

  it.each([
    'Iran ______ 51,000 ______ China ______ 351,000 …',
    'Judging Criteria 󰠂 Use of theme ______ …',
    'A statement from a different passage.',
  ])('매칭되지 않는 인용을 DOM에 넣지 않는다: %s', (quote) => {
    expect(render('The current passage has a different table and criteria.', quote)).toBe('')
  })

  it.each([null, ''])('지문이 없으면 검증할 수 없어 숨긴다: %s', (passage) => {
    expect(render(passage, 'The cat sat.')).toBe('')
  })

  it.each([null, '', '   \n '])('빈 인용 블록을 만들지 않는다: %s', (quote) => {
    expect(render('The cat sat.', quote)).toBe('')
  })

  it('표시 상한으로 붙인 말줄임표만 대조에서 빼고 화면에는 유지한다', () => {
    const passage = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ')
    const quote = capQuoteWords(passage)
    const html = render(passage, quote, true)
    expect(html).toContain('word39 …</blockquote>')
    expect(html).not.toContain('word40')
    expect(render('An unrelated passage.', quote, true)).toBe('')
  })

  it('원래 인용의 말줄임은 임의로 지우지 않는다', () => {
    expect(render('The cat sat.', 'The cat …')).toBe('')
    expect(render('The cat … paused.', 'The cat …')).toContain('<blockquote')
  })
})
