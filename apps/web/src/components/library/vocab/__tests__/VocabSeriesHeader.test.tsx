// apps/web/src/components/library/vocab/__tests__/VocabSeriesHeader.test.tsx
//
// 서가 머리가 **사다리를 정직하게 그리는가**.
//
// 이 스펙이 지키는 것은 두 가지다:
//   · 빈 계단을 숨기지 않는다 — 숨기면 학습자가 "이 브랜드는 이상하다" 로 읽는다
//   · 계단에 못 앉힌 권을 센다 — 분모가 안 맞으면 사다리를 믿을 수 없다
// 둘 다 데이터가 아니라 **렌더 결과**로만 잡히는 성질이라 여기서 단언한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'

import { measureLadderFill } from '@/lib/library/vocab/rung'
import { VocabSeriesHeader } from '../VocabSeriesHeader'

type SetLike = Parameters<typeof measureLadderFill>[0][number]
const set = (category: string, cefrLevel: string | null, wordCount = 100): SetLike =>
  ({ category, cefrLevel, wordCount }) as SetLike

function render(sets: SetLike[], learnerStep: number | null = null) {
  const fill = measureLadderFill(sets)
  return renderToString(
    <VocabSeriesHeader
      fill={fill}
      learnerStep={learnerStep}
      totalVolumes={sets.length}
      totalWords={sets.reduce((s, x) => s + x.wordCount, 0)}
    />,
  )
}

describe('단어장 서가 머리', () => {
  it('시리즈 이름을 상수에서 읽어 적는다 — 문자열을 화면에 또 적지 않는다', () => {
    expect(render([set('csat', null)])).toContain(VOCAB_SERIES_BRAND)
  })

  it('계단 일곱을 모두 그린다 — 재고가 없어도 칸이 사라지지 않는다', () => {
    const html = render([])
    for (const step of [1, 2, 3, 4, 5, 6, 7]) {
      expect(html).toContain(`>${step}</span>`)
    }
  })

  it('빈 계단을 숨기지 않고 근간 예정으로 적는다', () => {
    expect(render([set('csat', null)])).toContain('근간 예정')
  })

  it("재고가 있는 계단은 권 수와 하루치를 적는다", () => {
    const html = render([set('elementary', null), set('elementary', null)])
    expect(html).toContain('2권')
    expect(html).toContain('하루 10') // 1단 wordsPerDay
  })

  it('학령 밖 권을 숨기지 않고 센다', () => {
    // C2 = 성인 수준이라 학교 사다리 밖이다. 그 사실 자체가 정보다.
    const html = render([set('themed', 'C2'), set('csat', null)])
    expect(html).toContain('학령 밖')
    expect(html).toContain('1권')
  })

  it('학령 밖이 없으면 그 칸을 아예 그리지 않는다 — 0 을 보여줄 이유가 없다', () => {
    expect(render([set('csat', null)])).not.toContain('학령 밖')
  })

  it('학습자 계단을 aria-current 로도 말한다 — 색 하나로만 가르지 않는다', () => {
    const html = render([set('csat', null)], 7)
    expect(html).toContain('aria-current="step"')
    expect(html).toContain('지금')
  })

  it('미진단이면 어느 칸도 지금으로 서지 않는다 — 짐작으로 세우지 않는다', () => {
    const html = render([set('csat', null)], null)
    expect(html).not.toContain('aria-current="step"')
  })

  it('h1 이 있다 — 스크린리더로 여기가 어디인지 물을 수 있어야 한다', () => {
    expect(render([])).toContain('<h1')
  })
})
