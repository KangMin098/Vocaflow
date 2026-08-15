// apps/web/src/components/dashboard/__tests__/manage-report-age.test.ts
//
// Growth 의 Report 카드가 **낡은 리포트를 현재 것처럼 내걸지 않는지** 잠근다.
//
// 실측 2026-08-16: `weekly_reports` 에는 전체 통틀어 한 행(week_start 2026-06-29 ·
// total_words 0)뿐이었는데, 카드는 그걸 "6월 29일 주 · 단어 0" 이라고만 적었다.
// 6주 전 산출물이 학습자의 현재 리포트처럼 읽혔다 — 화면은 멀쩡했고 에러도 없었다.
// 리포트 생성이 멈춘 것은 파이프라인 문제지만, **멈춘 걸 감추는 것은 화면의 문제**다.

import { describe, expect, it, vi, afterEach } from 'vitest'

import { weeksAgo } from '../ManageSection'

function atFixedNow<T>(iso: string, fn: () => T): T {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  try {
    return fn()
  } finally {
    vi.useRealTimers()
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('weeksAgo — 리포트 나이', () => {
  it('이번 주는 0 (배지를 붙이지 않는다)', () => {
    expect(atFixedNow('2026-08-16T09:00:00Z', () => weeksAgo('2026-08-10'))).toBe(0)
  })

  it('지난주는 1 — 정상 주기이므로 아직 낡은 것이 아니다', () => {
    expect(atFixedNow('2026-08-16T09:00:00Z', () => weeksAgo('2026-08-09'))).toBe(1)
  })

  it('실측 사례: 6/29 리포트를 8/16 에 보면 6주 전 (48일 → floor 6)', () => {
    expect(atFixedNow('2026-08-16T09:00:00Z', () => weeksAgo('2026-06-29'))).toBe(6)
  })

  it('미래 날짜여도 음수를 만들지 않는다 (시계 어긋남 방어)', () => {
    expect(atFixedNow('2026-08-16T09:00:00Z', () => weeksAgo('2026-09-01'))).toBe(0)
  })

  it('깨진 날짜는 0 — 화면이 NaN 을 그리지 않는다', () => {
    expect(atFixedNow('2026-08-16T09:00:00Z', () => weeksAgo('not-a-date'))).toBe(0)
  })
})
