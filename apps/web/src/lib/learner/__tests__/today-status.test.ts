// apps/web/src/lib/learner/__tests__/today-status.test.ts
//
// 상태 띠 순수 계산 검증 (ADR 0006 D2).
//
// 여기서 지키는 것 중 화면만 보면 안 보이는 판정 셋:
//   ① 0-문장 규칙의 경계 — 셋이 **전부** 0일 때만 isEmpty
//   ② 진행은 받아 쓴다 — 이 파일은 더 이상 자기 모듈 매핑표를 갖지 않는다
//   ③ `stable`·`new` 는 attention 에 절대 들어가지 않는다 (조치 불가 수치)
//
// ②가 바뀐 이유: 이 파일이 자체 4갈래 모델로 N/M 을 내고, /hub 무대는 5블록 모델로 따로
// 냈다. 그래서 같은 화면에 `오늘 2/3`(띠)와 `0/5`(흐름)가 동시에 떴다(2026-08-15 실측).
// 진행 계산은 `today-blocks.blockProgress()` 하나로 합쳤고, 모듈 매핑도 거기 하나뿐이다.
// 매핑 규칙 검증은 `today-blocks.test.ts` 로 옮겼다.

import { describe, expect, it } from 'vitest'

import { computeTodayStatus } from '../today-status'

const NO_PROGRESS = { done: 0, total: 0 }

describe('computeTodayStatus — 0-문장 규칙', () => {
  it('진행 0 · 흔들림 0 · streak 0 이면 isEmpty', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.isEmpty).toBe(true)
    expect(s.total).toBe(0)
    expect(s.attention).toBe(0)
  })

  it('streak 만 있어도 isEmpty 가 아니다 — 셋 중 하나라도 있으면 숫자를 그린다', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: 0, shaky: 0 },
      streak: 3,
    })
    expect(s.isEmpty).toBe(false)
    expect(s.streak).toBe(3)
  })

  it('흔들림만 있어도 isEmpty 가 아니다', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: 2, shaky: 1 },
      streak: 0,
    })
    expect(s.isEmpty).toBe(false)
    expect(s.attention).toBe(3)
  })
})

describe('computeTodayStatus — 오늘 N/M 은 받아 쓴다', () => {
  it('blockProgress 결과를 그대로 싣는다', () => {
    const s = computeTodayStatus({
      progress: { done: 2, total: 4 },
      memory: { risk: 0, shaky: 0 },
      streak: 1,
    })
    expect(s.done).toBe(2)
    expect(s.total).toBe(4)
  })

  it('done 이 total 을 넘지 않는다 — 링 비율이 1을 넘을 수 없다', () => {
    const s = computeTodayStatus({
      progress: { done: 9, total: 3 },
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.done).toBe(3)
    expect(s.total).toBe(3)
  })

  it('음수 진행은 0으로 막는다', () => {
    const s = computeTodayStatus({
      progress: { done: -2, total: -5 },
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.done).toBe(0)
    expect(s.total).toBe(0)
  })
})

describe('attention — stable·new 는 절대 포함하지 않는다', () => {
  it('risk + shaky 만 더한다', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: 4, shaky: 8 },
      streak: 0,
    })
    expect(s.attention).toBe(12)
  })

  it('음수는 0으로 막는다 (계산 실패가 음수로 새는 것 차단)', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: -5, shaky: 2 },
      streak: -1,
    })
    expect(s.attention).toBe(2)
    expect(s.streak).toBe(0)
  })
})
