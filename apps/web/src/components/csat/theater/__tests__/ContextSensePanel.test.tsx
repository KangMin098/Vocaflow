// apps/web/src/components/csat/theater/__tests__/ContextSensePanel.test.tsx
//
// LM-G1.5a — V2 과제 칸 첫 화면: 정답 · 배제 이유가 마크업에 없고, 실력 · 효과를 약속하지 않는다(정적 렌더).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ContextSensePanel, savedGrade } from '../ContextSensePanel'

const html = renderToStaticMarkup(
  <ContextSensePanel slug="t-30" principle="이 문맥에 맞는 낱말의 뜻" why="같은 낱말도 문장마다 뜻이 달라져요." sentenceCount={8} targets={[1, 2, 3, 5, 6]} markers={['(a)', '(b)', '(c)', '(d)', '(e)']} cueGraded={false} />,
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

describe('ContextSensePanel · 저장 응답 검사(F1 · 허위 완료 없음)', () => {
  const ok = { outcome: 'inserted', grade: { misfitOk: true, cueOk: null, isCorrect: true, followUp: { senseOptions: ['a', 'b'], senseCorrect: 1 } } }
  it('B 맞힘 + 뜻 연습 · B 틀림 + 연습 없음만 받는다', () => {
    expect(savedGrade(ok)?.followUp?.senseOptions).toEqual(['a', 'b'])
    expect(savedGrade({ outcome: 'duplicate', grade: { misfitOk: false, cueOk: false, isCorrect: false, followUp: null } })).toMatchObject({ isCorrect: false, followUp: null })
  })
  it('B 를 틀렸는데 뜻 선택지가 오면 버린다(정답 단서) · 저장 결과가 없거나 정오가 어긋나면 완료가 아니다', () => {
    expect(savedGrade({ outcome: 'inserted', grade: { misfitOk: false, cueOk: null, isCorrect: false, followUp: { senseOptions: ['a', 'b'], senseCorrect: 0 } } })).toBeNull()
    for (const b of [null, {}, { outcome: 'conflict', grade: ok.grade }, { outcome: 'inserted' }, { outcome: 'inserted', grade: { ...ok.grade, isCorrect: false } }, { outcome: 'inserted', grade: { ...ok.grade, followUp: { senseOptions: ['a'], senseCorrect: 0 } } }, { outcome: 'inserted', grade: { ...ok.grade, followUp: { senseOptions: ['a', 'b'], senseCorrect: 2 } } }]) expect(savedGrade(b)).toBeNull()
  })
})
