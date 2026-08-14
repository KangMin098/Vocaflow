// apps/web/src/lib/learner/__tests__/today-status.test.ts
//
// 상태 띠 순수 계산 검증 (ADR 0006 D2).
//
// 여기서 지키는 것 중 화면만 보면 안 보이는 판정 셋:
//   ① 0-문장 규칙의 경계 — 셋이 **전부** 0일 때만 isEmpty
//   ② practice 블록이 목록을 갖지 않는다 — 새 아케이드 게임이 자동으로 잡힌다
//   ③ `stable`·`new` 는 attention 에 절대 들어가지 않는다 (조치 불가 수치)

import { describe, expect, it } from 'vitest'

import { blockHasActivity, computeTodayStatus } from '../today-status'

describe('computeTodayStatus — 0-문장 규칙', () => {
  it('블록 0 · 흔들림 0 · streak 0 이면 isEmpty', () => {
    const s = computeTodayStatus({
      available: [],
      byModule: {},
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.isEmpty).toBe(true)
    expect(s.total).toBe(0)
    expect(s.attention).toBe(0)
  })

  it('streak 만 있어도 isEmpty 가 아니다 — 셋 중 하나라도 있으면 숫자를 그린다', () => {
    const s = computeTodayStatus({
      available: [],
      byModule: {},
      memory: { risk: 0, shaky: 0 },
      streak: 3,
    })
    expect(s.isEmpty).toBe(false)
    expect(s.streak).toBe(3)
  })

  it('흔들림만 있어도 isEmpty 가 아니다', () => {
    const s = computeTodayStatus({
      available: [],
      byModule: {},
      memory: { risk: 2, shaky: 1 },
      streak: 0,
    })
    expect(s.isEmpty).toBe(false)
    expect(s.attention).toBe(3)
  })
})

describe('computeTodayStatus — 오늘 N/M', () => {
  it('처방이 낸 블록만 M 에 든다', () => {
    const s = computeTodayStatus({
      available: ['review', 'read'],
      byModule: {},
      memory: { risk: 0, shaky: 0 },
      streak: 1,
    })
    expect(s.total).toBe(2)
    expect(s.done).toBe(0)
    expect(s.blocks.map((b) => b.id)).toEqual(['review', 'read'])
  })

  it('오늘 활동이 있는 블록만 N 에 든다', () => {
    const s = computeTodayStatus({
      available: ['review', 'read', 'listen'],
      byModule: { flashcard: 12, dictation: 3 },
      memory: { risk: 0, shaky: 0 },
      streak: 1,
    })
    expect(s.total).toBe(3)
    expect(s.done).toBe(2) // review(flashcard) + listen(dictation)
    expect(s.blocks.find((b) => b.id === 'read')?.done).toBe(false)
  })

  it('블록 순서는 항상 복습 → 읽기 → 듣기 → 연습', () => {
    const s = computeTodayStatus({
      available: ['practice', 'listen', 'review'],
      byModule: {},
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.blocks.map((b) => b.id)).toEqual(['review', 'listen', 'practice'])
  })

  it('done 이 total 을 넘지 않는다 — 링 비율이 1을 넘을 수 없다', () => {
    const s = computeTodayStatus({
      available: ['review'],
      byModule: { flashcard: 5, wordblitz: 5, pairflip: 5 },
      memory: { risk: 0, shaky: 0 },
      streak: 0,
    })
    expect(s.done).toBe(1)
    expect(s.total).toBe(1)
  })
})

describe('blockHasActivity — 모듈 매핑', () => {
  it('0회 기록된 모듈은 활동으로 치지 않는다', () => {
    expect(blockHasActivity('review', { flashcard: 0 })).toBe(false)
  })

  it('listen 은 echo 와 dictation 둘 다 인정한다', () => {
    expect(blockHasActivity('listen', { echo: 1 })).toBe(true)
    expect(blockHasActivity('listen', { dictation: 1 })).toBe(true)
  })

  it('practice 는 목록을 갖지 않는다 — 처음 보는 아케이드 게임도 잡힌다', () => {
    // 실측 모듈 id (2026-08-14 daily_activity.by_module)
    expect(blockHasActivity('practice', { 'ghost-race': 6 })).toBe(true)
    expect(blockHasActivity('practice', { 'wordfall-cadence': 2 })).toBe(true)
    // 아직 존재하지 않는 게임이 추가돼도 매핑을 고칠 필요가 없다
    expect(blockHasActivity('practice', { 'some-future-game': 1 })).toBe(true)
  })

  it('practice 는 다른 블록의 모듈을 훔치지 않는다', () => {
    expect(blockHasActivity('practice', { flashcard: 9 })).toBe(false)
    expect(blockHasActivity('practice', { dictation: 9 })).toBe(false)
    expect(blockHasActivity('practice', { scriptquiz: 9 })).toBe(false)
  })
})

describe('attention — stable·new 는 절대 포함하지 않는다', () => {
  it('risk + shaky 만 더한다', () => {
    const s = computeTodayStatus({
      available: [],
      byModule: {},
      memory: { risk: 4, shaky: 8 },
      streak: 0,
    })
    expect(s.attention).toBe(12)
  })

  it('음수는 0으로 막는다 (계산 실패가 음수로 새는 것 차단)', () => {
    const s = computeTodayStatus({
      available: [],
      byModule: {},
      memory: { risk: -5, shaky: 2 },
      streak: -1,
    })
    expect(s.attention).toBe(2)
    expect(s.streak).toBe(0)
  })
})
