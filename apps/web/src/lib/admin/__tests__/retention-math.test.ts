// apps/web/src/lib/admin/__tests__/retention-math.test.ts
//
// 활성화·리텐션 계산 규칙.
//
// 이 계산이 틀리면 **플랫폼 판정 자체가 틀린다**(docs/PLATFORM_AUDIT.md 는 분기마다 이 수치로
// "계속할지" 를 정한다). 화면 결함과 달리 눈으로는 절대 안 보이므로 규칙을 전부 잠근다.

import { describe, expect, it } from 'vitest'

import {
  MIN_DENOMINATOR_FOR_RATE,
  computeRetention,
  rateOrNull,
  type LearnerActivity,
} from '../retention-math'

const TODAY = '2026-08-16'

function learner(signupDay: string, activeDays: string[] = []): LearnerActivity {
  return { userId: `u-${signupDay}-${activeDays.length}`, signupDay, activeDays }
}

describe('활성화 — 리텐션보다 먼저 보는 것', () => {
  it('한 번도 학습하지 않은 가입자는 activated 에 들지 않는다', () => {
    const r = computeRetention([learner('2026-01-01'), learner('2026-01-01', ['2026-01-02'])], TODAY)
    expect(r.signups).toBe(2)
    expect(r.activated).toBe(1)
  })

  it('가입 → 첫 학습 지연의 중앙값을 낸다', () => {
    // 실측(2026-08-16)에서 3명 중 2명이 55일·87일이었다. 이 구간은 리텐션만 보면 안 보인다.
    const r = computeRetention(
      [
        learner('2026-01-01', ['2026-01-01']), // 0일
        learner('2026-01-01', ['2026-01-11']), // 10일
        learner('2026-01-01', ['2026-03-01']), // 59일
      ],
      TODAY,
    )
    expect(r.medianDaysToFirstLearn).toBe(10)
  })

  it('가입 전 활동(시드 데이터)이 음수 지연으로 새지 않는다', () => {
    const r = computeRetention([learner('2026-02-01', ['2026-01-01'])], TODAY)
    expect(r.medianDaysToFirstLearn).toBe(0)
  })

  it('아무도 활성화하지 않으면 중앙값은 null (0 이 아니다)', () => {
    expect(computeRetention([learner('2026-01-01')], TODAY).medianDaysToFirstLearn).toBeNull()
  })
})

describe('리텐션 창 — 분모를 정직하게 센다', () => {
  it('아직 그 시간이 안 지난 가입자는 분모에서 뺀다', () => {
    // 어제 가입한 사람을 D30 분모에 넣으면 리텐션이 구조적으로 낮게 나온다.
    const r = computeRetention([learner('2026-08-15', ['2026-08-16'])], TODAY)
    expect(r.eligible.d1).toBe(1)
    expect(r.eligible.d7).toBe(0)
    expect(r.eligible.d30).toBe(0)
  })

  it('가입 당일 학습은 복귀가 아니다', () => {
    const r = computeRetention([learner('2026-01-01', ['2026-01-01'])], TODAY)
    expect(r.returned.d1).toBe(0)
    expect(r.returned.d7).toBe(0)
  })

  it('가입 다음 날 학습하면 D1·D7·D30 모두 복귀로 센다', () => {
    const r = computeRetention([learner('2026-01-01', ['2026-01-02'])], TODAY)
    expect(r.returned).toEqual({ d1: 1, d7: 1, d30: 1 })
  })

  it('창 경계를 포함한다 (가입+7일은 D7 안)', () => {
    const r = computeRetention([learner('2026-01-01', ['2026-01-08'])], TODAY)
    expect(r.returned.d7).toBe(1)
    expect(r.returned.d1).toBe(0)
  })

  it('창을 넘긴 복귀는 그 창에 넣지 않는다', () => {
    const r = computeRetention([learner('2026-01-01', ['2026-01-09'])], TODAY)
    expect(r.returned.d7).toBe(0)
    expect(r.returned.d30).toBe(1)
  })
})

describe('활성 학습자 — 최근 창', () => {
  it('최근 7일/28일에 학습한 사람을 센다', () => {
    const r = computeRetention(
      [
        learner('2026-01-01', ['2026-08-15']), // 1일 전
        learner('2026-01-01', ['2026-07-25']), // 22일 전
        learner('2026-01-01', ['2026-05-01']), // 오래됨
      ],
      TODAY,
    )
    expect(r.active.d7).toBe(1)
    expect(r.active.d28).toBe(2)
  })
})

describe('작은 표본에서 비율을 그리지 않는다', () => {
  it('분모가 기준 미만이면 null 을 준다', () => {
    // 3명 중 1명을 "33%" 로 인쇄하면 그 숫자가 근거처럼 읽힌다.
    expect(rateOrNull(1, 3)).toBeNull()
    expect(rateOrNull(5, MIN_DENOMINATOR_FOR_RATE - 1)).toBeNull()
  })

  it('분모가 충분하면 비율을 준다', () => {
    expect(rateOrNull(5, MIN_DENOMINATOR_FOR_RATE)).toBeCloseTo(5 / MIN_DENOMINATOR_FOR_RATE)
  })

  it('분모 0 에서 죽지 않는다', () => {
    expect(rateOrNull(0, 0)).toBeNull()
  })
})

describe('빈 입력', () => {
  it('가입자가 없어도 죽지 않는다', () => {
    const r = computeRetention([], TODAY)
    expect(r.signups).toBe(0)
    expect(r.activated).toBe(0)
    expect(r.medianDaysToFirstLearn).toBeNull()
    expect(r.eligible).toEqual({ d1: 0, d7: 0, d30: 0 })
  })
})
