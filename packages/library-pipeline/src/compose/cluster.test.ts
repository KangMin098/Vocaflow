// packages/library-pipeline/src/compose/cluster.test.ts
// ACP §20 — 사건 묶기 회귀.
//
// 이 단계의 실패 모드는 "덜 묶는 것" 이 아니라 **잘못 묶는 것**이다.
// 다른 사건이 붙으면 실제로는 한 곳에서만 나온 사실이 "독립 2계통" 으로 보이고,
// 그 상태로 취재를 시작하면 I12 가 잡기 전까지 비용을 쓴다. 그래서 보수적으로 묶는다.

import { describe, expect, it } from 'vitest'

import {
  CLUSTER_THRESHOLDS,
  clusterStories,
  diceCoefficient,
  headlineTokens,
  sameEvent,
} from './cluster'
import type { StoryCandidate } from './news-feed'

const BASE = Date.parse('2026-08-14T09:00:00Z')
const H = 3_600_000

function cand(
  publisher: string,
  wire: string | null,
  title: string,
  hoursOffset = 0,
): StoryCandidate {
  return {
    sourceKey: publisher.split('.')[0]!,
    publisher,
    wire,
    title,
    url: `https://${publisher}/${encodeURIComponent(title.slice(0, 20))}`,
    published_at: new Date(BASE + hoursOffset * H).toISOString(),
    holdMs: 0,
  }
}

describe('headlineTokens', () => {
  it('불용어와 한 글자를 버리고 내용어만 남긴다', () => {
    expect([...headlineTokens('The quake that hit the central coast on Tuesday')].sort()).toEqual([
      'central',
      'coast',
      'hit',
      'quake',
      'tuesday',
    ])
  })

  it('규모 수치는 통째로 남긴다 — 쪼개면 한 글자가 되어 사라진다', () => {
    const t = headlineTokens('Magnitude 5.2 quake hits U.S. coast')
    expect(t.has('5.2')).toBe(true)
    expect(t.has('u.s')).toBe(true)
    expect(t.has('quake')).toBe(true)
    // 문장 끝 마침표는 토큰에 붙지 않는다
    expect(headlineTokens('Storm forms offshore.').has('offshore')).toBe(true)
  })

  it('Breaking·Live 같은 편집 표지는 버린다', () => {
    expect(headlineTokens('BREAKING: Live updates on storm').has('breaking')).toBe(false)
    expect(headlineTokens('BREAKING: Live updates on storm').has('storm')).toBe(true)
  })
})

describe('sameEvent', () => {
  it('같은 사건을 다르게 쓴 두 헤드라인은 묶인다', () => {
    const a = cand('reuters.com', 'reuters', 'Magnitude 5.2 quake strikes California central coast')
    const b = cand('bbc.co.uk', null, 'California central coast hit by 5.2 magnitude quake', 3)
    expect(sameEvent(a, b)).toBe(true)
  })

  it('무관한 사건은 안 묶인다', () => {
    const a = cand('reuters.com', 'reuters', 'Magnitude 5.2 quake strikes California central coast')
    const b = cand('bbc.co.uk', null, 'Central bank holds interest rates steady', 2)
    expect(sameEvent(a, b)).toBe(false)
  })

  it('흔한 단어 하나만 겹치면 안 묶는다 (2차 조건)', () => {
    const a = cand('reuters.com', 'reuters', 'California wildfire spreads north')
    const b = cand('bbc.co.uk', null, 'California governor signs housing bill', 1)
    expect(sameEvent(a, b)).toBe(false)
  })

  it('시간 창을 벗어나면 같은 제목이어도 안 묶는다', () => {
    const a = cand('reuters.com', 'reuters', 'Magnitude 5.2 quake strikes California central coast')
    const b = cand(
      'bbc.co.uk',
      null,
      'Magnitude 5.2 quake strikes California central coast',
      CLUSTER_THRESHOLDS.maxHoursApart + 1,
    )
    expect(sameEvent(a, b)).toBe(false)
  })

  it('발행 시각이 없으면 묶지 않는다', () => {
    const a = cand('reuters.com', 'reuters', 'Magnitude 5.2 quake strikes California coast')
    const b = { ...cand('bbc.co.uk', null, 'Magnitude 5.2 quake strikes California coast'), published_at: null }
    expect(sameEvent(a, b)).toBe(false)
  })
})

describe('diceCoefficient', () => {
  it('완전 일치 1, 무관 0', () => {
    expect(diceCoefficient(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1)
    expect(diceCoefficient(new Set(['a']), new Set(['b']))).toBe(0)
    expect(diceCoefficient(new Set(), new Set(['a']))).toBe(0)
  })
})

describe('clusterStories', () => {
  const QUAKE_R = cand('reuters.com', 'reuters', 'Magnitude 5.2 quake strikes California central coast')
  const QUAKE_LOCAL = cand('coastdaily.example', 'reuters', 'Magnitude 5.2 quake strikes California central coast', 2)
  const QUAKE_BBC = cand('bbc.co.uk', null, 'California central coast hit by 5.2 magnitude quake', 3)
  const RATES = cand('apnews.com', 'ap', 'Central bank holds interest rates steady', 5)

  it('계통이 다른 두 보도는 묶여 취재 대상이 된다', () => {
    const [top] = clusterStories([QUAKE_R, QUAKE_BBC, RATES])
    expect(top!.members.map((m) => m.publisher).sort()).toEqual(['bbc.co.uk', 'reuters.com'])
    expect(top!.independentLines).toBe(2)
    expect(top!.worthPursuing).toBe(true)
  })

  it('같은 통신사 재게재는 같은 묶음에 들어가지 않는다', () => {
    // reuters 원고를 지역지가 그대로 실었다 — 묶어 봐야 독립 출처가 안 늘고,
    // "회원 많은 묶음" 처럼 보여 판단만 흐린다.
    const clusters = clusterStories([QUAKE_R, QUAKE_LOCAL])
    expect(clusters).toHaveLength(2)
    expect(clusters.every((c) => c.independentLines === 1)).toBe(true)
    expect(clusters.every((c) => c.worthPursuing === false)).toBe(true)
  })

  it('단독 보도는 취재 대상이 아니다', () => {
    const [only] = clusterStories([RATES])
    expect(only!.independentLines).toBe(1)
    expect(only!.worthPursuing).toBe(false)
  })

  it('독립 계통이 많은 묶음이 먼저 온다', () => {
    const clusters = clusterStories([RATES, QUAKE_R, QUAKE_BBC])
    expect(clusters[0]!.independentLines).toBe(2)
    expect(clusters[0]!.headline).toContain('quake')
  })

  it('대표 제목과 사건 시각은 가장 이른 보도에서 가져온다', () => {
    const [top] = clusterStories([QUAKE_BBC, QUAKE_R])
    expect(top!.headline).toBe(QUAKE_R.title)
    expect(top!.earliestAt).toBe(QUAKE_R.published_at)
  })
})
