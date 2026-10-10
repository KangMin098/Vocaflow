// apps/web/src/components/csat/theater/__tests__/SelfExplain.test.tsx
//
// 자기 설명(M4) — 선택 참여 · 점수 없음 · 분석 설명은 학습자가 펼칠 때만(쓰기 전 답을 베끼지 않게) · 유형에 맞는 질문.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SelfExplanation } from '@/lib/csat/dissect'
import type { TheaterBlock } from '@/lib/csat/theater'
import { SelfExplain } from '../SelfExplain'

const reject = (n: number): TheaterBlock => ({ key: `analysis:reject:${n}`, kind: 'reject', title: `${n}`, chips: [], body: [`분석 설명 ${n}`], quote: null })
const noop = () => {}
const render = (over: Partial<Parameters<typeof SelfExplain>[0]> = {}) =>
  renderToStaticMarkup(<SelfExplain itemId="2026#31" rejects={[reject(1), reject(4)]} choiceTruth={false} saved={[]} onSave={noop} onCompare={noop} {...over} />)

describe('자기 설명 카드', () => {
  it('선택 참여다 — 건너뛰기가 있고 점수를 말하지 않는다', () => {
    const html = render()
    expect(html).toContain('건너뛰기')
    expect(html).toContain('점수는 매기지 않아요')
    expect(html).not.toMatch(/정답입니다|틀렸어요|맞았어요/)
  })

  it('검수된 오답 설명이 있는 선지만 고르게 한다', () => {
    const html = render()
    expect(html).toContain('①')
    expect(html).toContain('④')
    expect(html).not.toContain('②')
  })

  it('쓰기 전에는 분석 설명 본문을 보이지 않는다', () => {
    expect(render()).not.toContain('분석 설명 1')
  })

  it('어법 · 어휘 · 불일치는 「왜 맞는 말인가」를 묻는다', () => {
    expect(render({ choiceTruth: true })).toContain('왜 맞는 말인가요')
    expect(render({ choiceTruth: false })).toContain('왜 그럴듯한가요')
  })

  it('오답 설명이 하나도 없으면 그리지 않는다', () => {
    expect(render({ rejects: [] })).toBe('')
  })

  it('이미 쓴 설명이 있으면 다시 볼 길을 준다', () => {
    const x: SelfExplanation = { id: 'x1', item: '2026#31', kind: 'lure', choice: 1, tempting: 'a', reject: 'b', at: 1, afterExplanation: true, compared: false }
    expect(render({ saved: [x] })).toContain('마지막 설명 보기')
  })
})
