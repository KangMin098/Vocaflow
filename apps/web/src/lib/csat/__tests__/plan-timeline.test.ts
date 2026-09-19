// apps/web/src/lib/csat/__tests__/plan-timeline.test.ts
//
// **시간 띠의 산술을 잠근다.**
//
// 이 띠가 하는 말은 「45번에서 시간이 끝납니다」 한 줄이고, 그 한 줄이 틀리면 학습자는
// 엉뚱한 유형의 절차를 줄인다. 그런데 틀려도 **화면은 멀쩡히 뜬다** — 띠는 여전히 그려지고
// 선도 어딘가에 서 있다. 그래서 산술을 눈이 아니라 검사로 지킨다.

import { describe, expect, it } from 'vitest'

import { SPEED_MAX, SPEED_MIN, buildTimeline, clampSpeed, mmss, type TimelineRow } from '../plan-timeline'

const row = (no: number, sec: number | null, ready = sec !== null): TimelineRow => ({
  no,
  type_id: `T${no}`,
  type_name: `유형${no}`,
  points: 2,
  time_budget_sec: sec,
  ready,
})

/** 18~45번 28문항 · 문항당 100초 = 2,800초. 쓸 수 있는 시간 2,700초라 **넘는다**. */
const ROWS = Array.from({ length: 28 }, (_, i) => row(18 + i, 100))
const AVAIL = 2700

describe('buildTimeline — 시간을 번호 순서로 쌓는다', () => {
  it('번호 순서를 스스로 맞춘다 — 들어온 순서를 믿지 않는다', () => {
    const shuffled = [row(30, 60), row(18, 60), row(45, 60)]
    const t = buildTimeline(shuffled, AVAIL)
    expect(t.segs.map((s) => s.no)).toEqual([18, 30, 45])
    expect(t.segs.map((s) => s.start)).toEqual([0, 60, 120])
  })

  it('누적이 이어진다 — 앞 칸의 끝이 뒤 칸의 시작이다', () => {
    const t = buildTimeline(ROWS, AVAIL)
    for (let i = 1; i < t.segs.length; i++) expect(t.segs[i]!.start).toBe(t.segs[i - 1]!.end)
    expect(t.total).toBe(2800)
  })

  it('넘는 첫 문항을 짚는다', () => {
    const t = buildTimeline(ROWS, AVAIL)
    // 2,700초는 27문항째(번호 44)에서 정확히 채워지고 45번이 넘긴다.
    expect(t.breaksAt).toBe(45)
    expect(t.overflow).toBe(100)
    expect(t.slack).toBe(0)
  })

  it('안 넘으면 breaksAt 이 null 이고 남는 시간을 준다', () => {
    const t = buildTimeline(ROWS.map((r) => ({ ...r, time_budget_sec: 90 })), AVAIL)
    expect(t.total).toBe(2520)
    expect(t.breaksAt).toBeNull()
    expect(t.overflow).toBe(0)
    expect(t.slack).toBe(180)
    expect(t.segs.every((s) => !s.over)).toBe(true)
  })

  it('절차가 없는 문항은 0초로 들어가고 그 수를 따로 센다', () => {
    // **이 사실을 숨기면 합계가 낙관적인 거짓말이 된다** — 화면이 그 수를 말해야 한다.
    const rows = [...ROWS.slice(0, 26), row(44, null, false), row(45, null, false)]
    const t = buildTimeline(rows, AVAIL)
    expect(t.unknown).toBe(2)
    expect(t.total).toBe(2600)
    expect(t.slack).toBe(100)
    expect(t.perUnknown).toBe(50)
  })

  it('남는 시간이 없으면 준비 중 문항에 줄 몫도 0 이다', () => {
    const rows = [...ROWS, row(46, null, false)]
    const t = buildTimeline(rows, AVAIL)
    expect(t.unknown).toBe(1)
    expect(t.perUnknown).toBe(0)
  })

  it('빈 계획에서도 죽지 않는다', () => {
    const t = buildTimeline([], AVAIL)
    expect(t.total).toBe(0)
    expect(t.breaksAt).toBeNull()
    expect(t.slack).toBe(AVAIL)
    expect(t.perUnknown).toBe(0)
  })
})

describe('속도 배율 — 빠르게 읽으면 시간이 준다', () => {
  it('배율을 시간에 그대로 곱하지 않는다', () => {
    // ⚠️ 한 번 뒤집어 썼던 자리다. `speed` 는 **읽는 속도**라 걸리는 시간은 1/speed 다.
    //    곱해 버리면 「빠르게」를 골랐는데 시간이 늘어난다.
    const base = buildTimeline(ROWS, AVAIL, 1).total
    expect(buildTimeline(ROWS, AVAIL, 1.25).total).toBeLessThan(base)
    expect(buildTimeline(ROWS, AVAIL, 0.8).total).toBeGreaterThan(base)
  })

  it('빠르게 읽으면 끊기는 자리가 뒤로 가거나 사라진다', () => {
    const slow = buildTimeline(ROWS, AVAIL, 0.8)
    const fast = buildTimeline(ROWS, AVAIL, 1.25)
    expect(slow.breaksAt).not.toBeNull()
    // 100초 × 28 ÷ 1.25 = 2,240초 < 2,700 → 안 끊긴다
    expect(fast.breaksAt).toBeNull()
    expect(fast.slack).toBeGreaterThan(0)
  })

  it('배율은 허용 범위 밖으로 안 나간다', () => {
    expect(clampSpeed(0.1)).toBe(SPEED_MIN)
    expect(clampSpeed(9)).toBe(SPEED_MAX)
    expect(clampSpeed(Number.NaN)).toBe(1)
    // 범위 밖 값을 넘겨도 계산이 조여진 값으로 돈다
    expect(buildTimeline(ROWS, AVAIL, 99).total).toBe(buildTimeline(ROWS, AVAIL, SPEED_MAX).total)
  })
})

describe('mmss', () => {
  it('0 은 「—」다 — 0초라고 적으면 「시간이 안 든다」로 읽힌다', () => {
    expect(mmss(0)).toBe('—')
  })
  it('분과 초를 사람 말로 적는다', () => {
    expect(mmss(45)).toBe('45초')
    expect(mmss(60)).toBe('1분')
    expect(mmss(93)).toBe('1분 33초')
    expect(mmss(2700)).toBe('45분')
  })
})
