// apps/web/src/components/admin/__tests__/RetentionPanel.test.tsx
//
// 리텐션 패널의 **정직성 규칙** 회귀.
//
// 이 패널의 숫자는 분기 진단(`docs/PLATFORM_AUDIT.md`)에서 "계속할지" 를 정하는 근거가 된다.
// 그래서 여기서 가장 위험한 것은 틀린 수치가 아니라 **작은 표본을 그럴듯한 퍼센트로 인쇄하는 것**이다.
// 3명 중 1명이 "33%" 로 찍히면 그 숫자는 근거처럼 읽힌다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { RetentionReport } from '@/lib/admin/retention-math'

import { RetentionPanel } from '../RetentionPanel'

function report(over: Partial<RetentionReport> = {}): RetentionReport {
  return {
    signups: 3,
    activated: 2,
    medianDaysToFirstLearn: 55,
    returned: { d1: 0, d7: 1, d30: 1 },
    eligible: { d1: 3, d7: 3, d30: 3 },
    active: { d7: 1, d28: 2 },
    ...over,
  }
}

describe('작은 표본 — 비율을 그리지 않는다', () => {
  it('분모가 기준 미만이면 퍼센트를 인쇄하지 않는다', () => {
    const html = renderToString(<RetentionPanel report={report()} />)
    expect(html).not.toContain('67%') // 2/3
    expect(html).not.toContain('33%') // 1/3
    // 대신 원수를 보여준다
    expect(html).toContain('2 / 3')
  })

  it('분모가 충분하면 퍼센트를 보여준다', () => {
    const html = renderToString(
      <RetentionPanel
        report={report({
          signups: 100,
          activated: 40,
          eligible: { d1: 100, d7: 100, d30: 100 },
          returned: { d1: 25, d7: 30, d30: 35 },
        })}
      />,
    )
    expect(html).toContain('40%')
    expect(html).toContain('25%')
  })
})

describe('못 쟀을 때와 0 을 구별한다', () => {
  it('계산 실패는 "0" 이 아니라 "못 쟀음" 으로 말한다', () => {
    const html = renderToString(<RetentionPanel report={null} />)
    expect(html).toContain('계산하지 못했어요')
    expect(html).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(html).toContain('못 쟀음')
  })

  it('아직 창이 안 지난 경우를 분모 0 으로 설명한다', () => {
    const html = renderToString(
      <RetentionPanel report={report({ eligible: { d1: 3, d7: 0, d30: 0 } })} />,
    )
    expect(html).toContain('아직 이 창이 지난 가입자가 없다')
  })
})

describe('활성화를 리텐션과 분리해 보여준다', () => {
  it('가입 → 첫 학습 지연을 인쇄한다', () => {
    // 실측에서 3명 중 2명이 55·87일이었다 — 리텐션만 보면 이 구간이 안 보인다.
    const html = renderToString(<RetentionPanel report={report()} />)
    expect(html).toContain('중앙값 55일')
    expect(html).toContain('활성화 문제')
  })

  it('활성화한 사람이 없으면 지연을 0 이 아니라 — 로 둔다', () => {
    const html = renderToString(
      <RetentionPanel report={report({ activated: 0, medianDaysToFirstLearn: null })} />,
    )
    expect(html).not.toContain('중앙값 0일')
  })
})

describe('무엇을 재는지 화면이 밝힌다', () => {
  it('활동 리텐션이며 조회는 수집하지 않는다고 적는다', () => {
    const html = renderToString(<RetentionPanel report={report()} />)
    expect(html).toContain('활동 리텐션')
    expect(html).toContain('페이지 조회는')
  })
})
