// scripts/comic/pd/__tests__/renewal.test.mjs
//
// 갱신 위험 회귀 — **"1964년 이전 발행"은 PD 를 뜻하지 않는다.**
//
// 이 표가 없던 동안 969호를 "1940~63년이니 대체로 PD" 로 다루려 했다. 조사해 보니
// Fawcett 은 갱신된 구간이 실재하고 그 구간은 지금 DC 소유다 — 실측 99호가 걸렸다.
// 블랭킷 발행했으면 99건이 침해였다.
//
// 여기서 고정하는 것은 **조사 결과**다. 규칙이 조용히 느슨해지면 그만큼이 다시 위험해진다.

import { describe, expect, it } from 'vitest'

import { assessRenewal, PUBLISHER_DEFAULT, SERIES_RENEWAL } from '../renewal.mjs'

describe('갱신된 것으로 알려진 구간 — 발행 차단', () => {
  it.each([
    ['master-comics', 61, 1945, 'MASTER COMICS #61 이상'],
    ['master-comics', 100, 1949, 'MASTER COMICS 상위 호'],
    ['wow-comics', 36, 1945, 'WOW COMICS #36'],
    ['wow-comics', 69, 1948, 'WOW COMICS #69'],
    ['whiz-comics', 3, 1940, 'WHIZ COMICS #3'],
    ['whiz-comics', 6, 1940, 'WHIZ COMICS #6'],
    ['marvel-family', 60, 1951, 'Marvel Family 1951+'],
    ['captain-marvel-jr', 90, 1952, 'CM Jr 1951+'],
  ])('%s #%s (%s) → 차단 (%s)', (seriesKey, issueNo, publishedYear) => {
    const v = assessRenewal({ seriesKey, issueNo, publishedYear, publisher: 'Fawcett' })
    expect(v.level).toBe('renewed')
    expect(v.blocking).toBe(true)
  })
})

describe('갱신 구간 밖 — 차단하지 않지만 "확인됨"도 아니다', () => {
  it('MASTER COMICS #60 이하는 차단 안 함', () => {
    const v = assessRenewal({ seriesKey: 'master-comics', issueNo: 60, publishedYear: 1945, publisher: 'Fawcett' })
    expect(v.blocking).toBe(false)
  })

  it('WHIZ COMICS #2 는 미갱신 (Captain Marvel 첫 등장)', () => {
    const v = assessRenewal({ seriesKey: 'whiz-comics', issueNo: 2, publishedYear: 1940, publisher: 'Fawcett' })
    expect(v.blocking).toBe(false)
  })

  it('WOW COMICS #35 이하는 차단 안 함', () => {
    expect(assessRenewal({ seriesKey: 'wow-comics', issueNo: 35, publishedYear: 1944, publisher: 'Fawcett' }).blocking).toBe(false)
  })

  it('차단하지 않아도 level 이 likely-pd 가 되지는 않는다 — 확인은 여전히 필요', () => {
    const v = assessRenewal({ seriesKey: 'master-comics', issueNo: 60, publishedYear: 1945, publisher: 'Fawcett' })
    expect(v.level).toBe('unknown')
    expect(v.note).toContain('확인')
  })
})

describe('발행사 기본값', () => {
  it('Ace 는 조사상 전 타이틀 미갱신 → likely-pd', () => {
    const v = assessRenewal({ seriesKey: 'atomic-war', issueNo: 1, publishedYear: 1952, publisher: 'Ace' })
    expect(v.level).toBe('likely-pd')
    expect(v.blocking).toBe(false)
  })

  it('Fawcett 은 갱신 구간이 실재 → unknown (블랭킷 금지)', () => {
    const v = assessRenewal({ seriesKey: 'soldier-comics', issueNo: 2, publishedYear: 1952, publisher: 'Fawcett' })
    expect(v.level).toBe('unknown')
  })

  it('모르는 발행사는 likely-pd 로 낙관하지 않는다 — 기본값은 unknown', () => {
    const v = assessRenewal({ seriesKey: 'x', issueNo: 1, publishedYear: 1950, publisher: 'Unknown Press' })
    expect(v.level).toBe('unknown')
    expect(v.blocking).toBe(false)
  })
})

describe('표 무결성', () => {
  it('규칙의 seriesKey 가 중복되지 않는다 — 중복되면 뒤 규칙이 죽는다', () => {
    const keys = SERIES_RENEWAL.map((r) => r.seriesKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('모든 규칙에 근거 note 가 있다 (화면이 그대로 보여준다)', () => {
    for (const r of SERIES_RENEWAL) expect(r.note.length).toBeGreaterThan(10)
  })

  it('발행사 기본값 레벨이 유효 토큰이다', () => {
    for (const p of Object.values(PUBLISHER_DEFAULT)) {
      expect(['renewed', 'likely-pd', 'unknown']).toContain(p.level)
    }
  })
})
