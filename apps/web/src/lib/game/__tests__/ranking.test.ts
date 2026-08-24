// apps/web/src/lib/game/__tests__/ranking.test.ts
//
// 랭킹 표시 규칙 회귀.
//
// 이 파일이 지키는 계약은 하나로 요약된다 — **작은 표본에서 거짓 성취를 만들지 않는다.**
// 이 DB 의 게임 참가자는 2명이다(2026-08-25 실측). 그 상태에서:
//   · 참가자 1명인 게임의 백분위를 100 으로 적으면 "전체 1위" 라는 거짓말이 된다
//   · 2명 중 2위(백분위 0)를 "상위 100%" 로 옮기면 **꼴찌가 최고 성적처럼 읽힌다**
// 두 번째는 실제로 만들었다가 런타임 확인에서 잡았다. 그래서 테스트로 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  overallRank,
  rankLine,
  sampleNote,
  PERCENTILE_MIN_PLAYERS,
  type RankSummaryRow,
} from '@/lib/game/ranking'

const row = (o: Partial<RankSummaryRow>): RankSummaryRow => ({
  module: 'cascade',
  bestScore: 100,
  plays: 1,
  myRank: 1,
  playerCount: 1,
  percentile: null,
  ...o,
})

describe('rankLine — 참가자 수에 따라 말이 달라진다', () => {
  it('혼자면 순위를 말하지 않는다 — "1위" 는 거짓이다', () => {
    const line = rankLine({ myRank: 1, playerCount: 1, bestScore: 300 })
    expect(line).not.toMatch(/\d+위/)
    expect(line).toMatch(/내 최고/)
    expect(line).toMatch(/300/)
  })

  it('여럿이면 분모를 함께 말한다 — "2위" 만으로는 판단할 수 없다', () => {
    expect(rankLine({ myRank: 2, playerCount: 2, bestScore: 300 })).toMatch(/2명 중 2위/)
    expect(rankLine({ myRank: 1, playerCount: 7, bestScore: 900 })).toMatch(/7명 중 1위/)
  })

  it('참가자 0 도 순위를 말하지 않는다 (방어)', () => {
    expect(rankLine({ myRank: 1, playerCount: 0, bestScore: 10 })).not.toMatch(/\d+위/)
  })
})

describe('overallRank — 백분위는 표본이 있을 때만', () => {
  it('참가자 1명뿐인 게임은 평균에서 빠지고 soloBests 로 센다', () => {
    const r = overallRank([row({}), row({ module: 'connections' })])
    expect(r.rankedGames).toBe(0)
    expect(r.meanPercentile).toBeNull()
    expect(r.soloBests).toBe(2)
    expect(r.playedGames).toBe(2)
  })

  it('표본이 작으면 percentileMeaningful=false — "상위 N%" 를 쓰면 안 된다', () => {
    // 2명 중 2위 = 백분위 0. 이것을 "상위 100%" 로 옮기면 꼴찌가 1등처럼 읽힌다.
    const r = overallRank([row({ myRank: 2, playerCount: 2, percentile: 0 })])
    expect(r.rankedGames).toBe(1)
    expect(r.meanPercentile).toBe(0)
    expect(r.percentileMeaningful).toBe(false)
    // 대신 말할 수 있는 참인 사실
    expect(r.topFinishes).toBe(0)
  })

  it(`참가자 ${PERCENTILE_MIN_PLAYERS}명 이상이면 백분위를 말해도 된다`, () => {
    const r = overallRank([
      row({ myRank: 2, playerCount: PERCENTILE_MIN_PLAYERS, percentile: 75 }),
    ])
    expect(r.percentileMeaningful).toBe(true)
    expect(r.meanPercentile).toBe(75)
  })

  it('경계 바로 아래는 여전히 false — 임계값을 우연히 넘기지 않는다', () => {
    const r = overallRank([
      row({ myRank: 2, playerCount: PERCENTILE_MIN_PLAYERS - 1, percentile: 50 }),
    ])
    expect(r.percentileMeaningful).toBe(false)
  })

  it('1위인 게임을 센다 — 표본이 작아도 오해되지 않는 사실', () => {
    const r = overallRank([
      row({ module: 'cascade', myRank: 1, playerCount: 3, percentile: 100 }),
      row({ module: 'connections', myRank: 3, playerCount: 3, percentile: 0 }),
      row({ module: 'wordblitz', myRank: 1, playerCount: 1, percentile: null }),
    ])
    // 혼자인 게임의 "1위" 는 세지 않는다 — 겨룬 적이 없다.
    expect(r.topFinishes).toBe(1)
    expect(r.rankedGames).toBe(2)
    expect(r.soloBests).toBe(1)
  })

  it('빈 입력에서 무너지지 않는다', () => {
    const r = overallRank([])
    expect(r).toEqual({
      rankedGames: 0,
      playedGames: 0,
      meanPercentile: null,
      percentileMeaningful: false,
      topFinishes: 0,
      soloBests: 0,
    })
  })

  it('평균은 백분위가 있는 게임만으로 낸다', () => {
    const r = overallRank([
      row({ myRank: 1, playerCount: 5, percentile: 100 }),
      row({ module: 'connections', myRank: 3, playerCount: 5, percentile: 50 }),
      row({ module: 'wordblitz', playerCount: 1, percentile: null }),
    ])
    expect(r.meanPercentile).toBe(75) // (100+50)/2 — null 은 분모에 안 든다
  })
})

describe('sampleNote — 표본 크기를 먼저 말한다', () => {
  it('0명이면 순위가 아니라 첫 기록을 권한다', () => {
    expect(sampleNote(0, 'week')).toMatch(/아직 없어요/)
  })
  it('1명이면 순위 대신 개인 최고를 권한다', () => {
    expect(sampleNote(1, 'all')).toMatch(/1명/)
    expect(sampleNote(1, 'all')).toMatch(/내 최고/)
  })
  it('적으면 표본이 작다고 밝힌다', () => {
    expect(sampleNote(3, 'week')).toMatch(/표본이 작아요/)
  })
  it('충분하면 인원만 적는다 — 불필요한 단서를 붙이지 않는다', () => {
    const note = sampleNote(40, 'month')
    expect(note).toMatch(/40명/)
    expect(note).not.toMatch(/표본이 작아요/)
  })
  it('기간 이름이 들어간다 — 어느 창의 순위인지 모르면 비교가 무의미하다', () => {
    expect(sampleNote(10, 'week')).toMatch(/이번 주/)
    expect(sampleNote(10, 'month')).toMatch(/이번 달/)
    expect(sampleNote(10, 'all')).toMatch(/전체/)
  })
})
