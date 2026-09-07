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

import {
  RIBBON_COUNT_CAP,
  computeTodayStatus,
  formatRibbonCount,
  ribbonCountAria,
} from '../today-status'

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

/**
 * **할 일이 있는 사람에게 없다고 말하는 것**을 막는다.
 *
 * 2026-08-27 실측: 학생이 선생님이 보낸 낱말 3개를 담은 **직후**에도 띠는
 * "아직 시작 전이에요 — 5분이면 오늘 할 일이 생겨요" 였다.
 * 낱말은 `vocabularies` 에 정확히 들어가 있었다(origin='assignment', 뜻·표제어 채움).
 *
 * 이유: 진단 전이면 `progress` 가 강제로 0/0 이고, `attention` 은 risk+shaky 만 본다.
 * 한 번도 복습하지 않은 낱말은 기억 4상태의 `new` 라 **어디에도 세어지지 않았다.**
 * 학습자가 스스로 담던 시절엔 맞는 판단이었지만(담은 사람은 이미 본 사람이다),
 * 교사가 보낸 낱말이 생기면서 그 전제가 깨졌다.
 */
describe('computeTodayStatus — 아직 안 배운 낱말', () => {
  const NONE = { progress: { done: 0, total: 0 }, streak: 0 }

  it('새 낱말이 있으면 비어 있지 않다 — 진단 전이어도 그렇다', () => {
    const s = computeTodayStatus({ ...NONE, memory: { risk: 0, shaky: 0, fresh: 3 } })
    expect(s.fresh).toBe(3)
    expect(s.isEmpty, '담은 낱말이 있는데 "아직 시작 전" 이라고 말하면 거짓말이다').toBe(false)
  })

  it('attention 에 합치지 않는다 — "복습이 급하다" 와 "아직 안 배웠다" 는 다른 일이다', () => {
    const s = computeTodayStatus({ ...NONE, memory: { risk: 2, shaky: 1, fresh: 5 } })
    expect(s.attention).toBe(3)
    expect(s.fresh).toBe(5)
  })

  it('fresh 가 없으면 예전대로 비어 있다 — 기존 판정을 넓히지 않는다', () => {
    expect(computeTodayStatus({ ...NONE, memory: { risk: 0, shaky: 0, fresh: 0 } }).isEmpty).toBe(true)
    // 값을 안 넘겨도 안전해야 한다(선택 필드).
    expect(computeTodayStatus({ ...NONE, memory: { risk: 0, shaky: 0 } }).isEmpty).toBe(true)
  })

  it('음수는 0으로 막는다', () => {
    expect(computeTodayStatus({ ...NONE, memory: { risk: 0, shaky: 0, fresh: -4 } }).fresh).toBe(0)
  })
})

// ── 표시 상한 ────────────────────────────────────────────────────────
//
// 2026-08-31 실측: 띠가 `새 단어 1858` 을 그리고 있었다. 이 띠의 규칙 ② 는
// "조치 가능한 것만" 인데, 1,858 은 오늘 할 수 있는 일이 아니라 못 한 일의 총량이다.
//
// 여기서 지키는 것은 둘이다:
//   ① 자르되 **거짓말하지 않는다** — `99+` 는 참인 문장이다
//   ② 자르는 것은 **표시뿐** — 계산(`isEmpty`)과 목적지는 실수를 그대로 쓴다.
//      상한이 계산에 스며들면 100번째 낱말부터 조용히 사라진다.

describe('띠 표시 상한 — 자릿수도 "조치 가능" 의 일부다', () => {
  it('상한 이하는 그대로 그린다', () => {
    expect(formatRibbonCount(0)).toBe('0')
    expect(formatRibbonCount(3)).toBe('3')
    expect(formatRibbonCount(98)).toBe('98')
  })

  it('경계 — 99 는 그대로, 100 부터 잘린다', () => {
    expect(formatRibbonCount(RIBBON_COUNT_CAP)).toBe('99')
    expect(formatRibbonCount(RIBBON_COUNT_CAP + 1)).toBe('99+')
  })

  it('실측값 1858 이 네 자리로 나가지 않는다', () => {
    expect(formatRibbonCount(1858)).toBe('99+')
  })

  it('스크린리더 표현이 보이는 값과 같은 뜻이다', () => {
    // 화면은 `99+` 인데 소리가 `1858개` 면 같은 링크가 두 사람에게 다른 약속을 한다.
    expect(ribbonCountAria(3)).toBe('3개')
    expect(ribbonCountAria(99)).toBe('99개')
    expect(ribbonCountAria(1858)).toBe('99개 이상')
  })

  it('음수·소수를 그대로 그리지 않는다 (계산 실패가 화면으로 새는 것 차단)', () => {
    expect(formatRibbonCount(-5)).toBe('0')
    expect(formatRibbonCount(3.7)).toBe('3')
  })

  it('⚠️ 상한은 계산에 스며들지 않는다 — isEmpty 와 실수는 그대로다', () => {
    const s = computeTodayStatus({
      progress: NO_PROGRESS,
      memory: { risk: 0, shaky: 0, fresh: 1858 },
      streak: 0,
    })
    // 표시는 잘려도 값은 실수여야 한다 — 목적지 목록이 이 수를 쓴다.
    expect(s.fresh).toBe(1858)
    expect(s.isEmpty).toBe(false)
  })
})
