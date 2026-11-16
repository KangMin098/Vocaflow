// apps/web/src/components/csat/listening/distractor/__tests__/DistractorSplitter.test.tsx
// 서버 렌더 정적 HTML 로 단계별 노출을 본다: 확정 전엔 분석이 없고, 확정 뒤에도 L4 전엔 근거·함정이 잠긴다.
// 선지는 테스트용 합성 선택지(공식 선지 아님).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { segmentsFromCuts, type DistractorJudgment } from '@/lib/csat/listening/distractor'
import { todoItem } from '@/lib/csat/listening/distractor/__tests__/fixture'

import { DistractorSplitter } from '../DistractorSplitter'

const item = todoItem()
const judged: DistractorJudgment = {
  choice: 2,
  segments: segmentsFromCuts(3, [0]).map((s, i) => (i === 0 ? { ...s, label: 'unheard' } : { ...s, label: 'heard', utteranceId: 'u11' })),
}
const OPEN = { submitted: true, reveal: 'open' as const }

describe('DistractorSplitter', () => {
  it('확정 전: 분석·근거가 없고 확정 버튼은 잠김', () => {
    const html = renderToStaticMarkup(<DistractorSplitter item={item} exposureLevel="L5" exposureContext={OPEN} choicesAreSynthetic />)
    expect(html).toContain('테스트용 합성 선택지')
    expect(html).not.toContain('data-testid="distractor-analysis"')
    expect(html).not.toContain('I’ll contact the band.')
    expect(html).toMatch(/data-testid="commit-judgment"[^>]*disabled|disabled[^>]*data-testid="commit-judgment"/)
    expect(html).toContain('aria-pressed')
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('focus-visible:outline')
  })

  it('표시가 끝난 판단은 확정 가능', () => {
    const html = renderToStaticMarkup(<DistractorSplitter item={item} exposureLevel="L3" initial={{ judgment: judged }} />)
    expect(html).not.toMatch(/data-testid="commit-judgment"[^>]*disabled/)
    expect(html).toContain('✓ 들은 부분')
  })

  it('확정 뒤 L3: 글자 겹침만, 근거·함정은 잠김', () => {
    const html = renderToStaticMarkup(<DistractorSplitter item={item} exposureLevel="L5" initial={{ judgment: judged, committed: true }} />)
    expect(html).toContain('data-testid="segment-compare"')
    expect(html).toContain('data-testid="rationale-locked"')
    expect(html).not.toContain('역할 뒤바꿈')
    expect(html).not.toContain('정답')
  })

  it('확정 뒤 L4 + 공개: 함정 유형·반박 근거, 정답 여부는 없음', () => {
    const html = renderToStaticMarkup(<DistractorSplitter item={item} exposureLevel="L4" exposureContext={OPEN} initial={{ judgment: judged, committed: true }} />)
    expect(html).toContain('역할 뒤바꿈')
    expect(html).toContain('I’ll contact the band.')
    expect(html).not.toContain('정답이 아닙니다')
  })

  it('L5 + 공개: 정답 여부까지', () => {
    const html = renderToStaticMarkup(<DistractorSplitter item={item} exposureLevel="L5" exposureContext={OPEN} initial={{ judgment: judged, committed: true }} />)
    expect(html).toContain('정답이 아닙니다')
  })

  it('보류(embargo) 중이면 L5 요청도 잠김', () => {
    const html = renderToStaticMarkup(
      <DistractorSplitter item={item} exposureLevel="L5" exposureContext={{ submitted: true, reveal: 'embargo' }} initial={{ judgment: judged, committed: true }} />,
    )
    expect(html).toContain('data-testid="rationale-locked"')
  })
})
