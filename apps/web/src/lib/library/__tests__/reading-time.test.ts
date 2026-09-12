// apps/web/src/lib/library/__tests__/reading-time.test.ts
//
// **짧은 책이 "0 시간" 으로 보이던 것**을 못 박는다.
//
// 두 화면이 각자 `약 ${Math.round(m / 60)}시간` 을 적고 있었다. 그래서 60분 미만인 책이
// 전부 "약 0 시간" — 발행 13권 중 2권, 발행 대기 303권 중 21권(2026-08-26 실측).
// 하필 그 대상이 짧은 책이라, **처음 완주해 보기 좋은 콘텐츠가 가장 부실해 보였다.**
//
// 0 은 "짧다" 가 아니라 "내용이 없다" 로 읽힌다. 그게 이 결함의 값이다.

import { describe, expect, it } from 'vitest'

import { formatReadingTime } from '../reading-time'

describe('읽는 시간 표시', () => {
  it.each([
    [2, '약 2분'], // Ammachi's Amazing Machines — 실제 값
    [59, '약 59분'],
  ])('한 시간 미만은 분으로 말한다 (%i분)', (input, expected) => {
    expect(formatReadingTime(input)).toBe(expected)
  })

  it.each([
    [60, '약 1시간'],
    [148, '약 2시간'], // Winnie-the-Pooh
    [2452, '약 41시간'], // Introduction to Sociology
  ])('한 시간 이상은 시간으로 말한다 (%i분)', (input, expected) => {
    expect(formatReadingTime(input)).toBe(expected)
  })

  it('반올림해서 0 이 되는 값을 만들지 않는다', () => {
    // "약 0 시간" 을 고쳐 놓고 "약 0 분" 을 새로 만들면 아무것도 나아지지 않는다.
    expect(formatReadingTime(0.4)).toBe('약 1분')
  })

  it.each([
    ['0', 0],
    ['음수', -5],
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('%s 이면 문장을 만들지 않는다 — 화면이 그 줄을 숨긴다', (_label, input) => {
    expect(formatReadingTime(input as number | null | undefined)).toBeNull()
  })
})
