// apps/web/src/lib/csat/__tests__/next-item.test.ts
//
// 「다음 기출」은 **앞길**이다. 여기서 틀리면 학습자가 눌러서 도착한 곳이
// 「아직 쓰는 중이에요」이거나 방금 익힌 조작이 없는 산문 화면이다 — 둘 다 조용한 실패다.

import { describe, expect, it } from 'vitest'

import { examRank, pickNextItem, type NextCandidate } from '../next-item'

const item = (id: string, explained = true): NextCandidate => ({
  id,
  slug: id.replace('#', '-'),
  exam_label: id.split('#')[0],
  no: Number(id.split('#')[1]),
  explained,
})

const ALL = [item('2024#31'), item('2026#31'), item('M2309#31'), item('2025#31')]
const hasAll = () => true
const hasNone = () => false

describe('examRank — 최신이 크다', () => {
  it('연도가 큰 수능이 크다', () => {
    expect(examRank('2026#31')).toBeGreaterThan(examRank('2024#31'))
  })

  it('수능은 같은 해 모평보다 뒤다 — 11월 시행이다', () => {
    expect(examRank('2023#31')).toBeGreaterThan(examRank('M2309#31'))
    expect(examRank('M2309#31')).toBeGreaterThan(examRank('M2306#31'))
  })

  it('label 이 아니라 id 를 읽는다 — label 은 사람이 읽는 문자열이라 바뀐다', () => {
    // 같은 id 면 label 이 무엇이든 같은 값이어야 한다.
    expect(examRank('M2309#42')).toBe(examRank('M2309#31'))
  })

  it('이상한 id 에 터지지 않는다', () => {
    expect(examRank('')).toBe(0)
    expect(examRank('nope')).toBe(0)
    expect(examRank('#31')).toBe(0)
  })
})

describe('pickNextItem', () => {
  it('지금 보는 문항을 다시 주지 않는다', () => {
    const got = pickNextItem(ALL, '2026#31', hasAll)
    expect(got?.item.id).not.toBe('2026#31')
  })

  it('최신 회차를 먼저 준다', () => {
    expect(pickNextItem(ALL, '2024#31', hasAll)?.item.id).toBe('2026#31')
  })

  it('해설이 없는 문항은 고르지 않는다 — 눌러서 「아직 쓰는 중」이 뜨면 앞길이 아니다', () => {
    const pool = [item('2026#31', false), item('2024#31', true)]
    expect(pickNextItem(pool, 'X#1', hasAll)?.item.id).toBe('2024#31')
  })

  it('지도가 있는 것을 먼저 준다 — 없으면 방금 익힌 조작이 사라진다', () => {
    // 최신은 2026 이지만 지도가 없다 → 지도가 있는 2025 를 준다.
    const hasMap = (id: string) => id !== '2026#31'
    const got = pickNextItem(ALL, '2024#31', hasMap)
    expect(got?.item.id).toBe('2025#31')
    expect(got?.hasMap).toBe(true)
  })

  it('지도가 하나도 없으면 해설만 있는 것이라도 준다 — 앞길이 아예 없는 것보다 낫다', () => {
    const got = pickNextItem(ALL, '2024#31', hasNone)
    expect(got).not.toBeNull()
    expect(got?.hasMap).toBe(false)
    expect(got?.item.id).toBe('2026#31')
  })

  it('고를 것이 없으면 null — 없는 길을 있는 척하지 않는다', () => {
    expect(pickNextItem([item('2026#31')], '2026#31', hasAll)).toBeNull()
    expect(pickNextItem([], 'X#1', hasAll)).toBeNull()
    expect(pickNextItem([item('2026#31', false)], 'X#1', hasAll)).toBeNull()
  })

  it('남은 수는 지금 문항을 뺀 «고를 수 있는» 수다', () => {
    // 해설 없는 것은 셈에 넣지 않는다 — 셈에 넣으면 화면이 없는 앞길을 세어 말한다.
    const pool = [...ALL, item('2022#31', false)]
    expect(pickNextItem(pool, '2026#31', hasAll)?.remaining).toBe(3)
  })

  it('같은 회차 안에서는 번호 순이다', () => {
    const pool = [item('2026#34'), item('2026#31'), item('2026#33')]
    expect(pickNextItem(pool, 'X#1', hasAll)?.item.id).toBe('2026#31')
  })
})
