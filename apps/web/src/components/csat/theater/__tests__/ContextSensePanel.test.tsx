// apps/web/src/components/csat/theater/__tests__/ContextSensePanel.test.tsx
//
// LM-G1.5a — V2 과제 칸 첫 화면: 정답 · 배제 이유가 마크업에 없고, 실력 · 효과를 약속하지 않는다(정적 렌더).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ContextSensePanel } from '../ContextSensePanel'

const html = renderToStaticMarkup(
  <ContextSensePanel slug="t-30" principle="이 문맥에 맞는 낱말의 뜻" why="같은 낱말도 문장마다 뜻이 달라져요." sentenceCount={8} targets={[1, 2, 3, 5, 6]} senseOptions={['줄어든', '늘어난', '그대로인']} cueGraded={false} />,
)

describe('ContextSensePanel', () => {
  it('첫 화면은 「직접 확인하기」 하나 — 선택지 · 정답 표시 없음', () => {
    expect(html).toContain('직접 확인하기')
    expect(html).not.toMatch(/data-misfit|data-sense|정답|misfit|correct/)
    expect(html).toContain('data-task="contextual-sense"')
  })
  it('숙달 · 효과 문구 없음', () => {
    expect(html).not.toMatch(/숙달|실력이|점수가 오른/)
  })
})
