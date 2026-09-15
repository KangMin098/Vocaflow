// apps/web/src/lib/textfit/__tests__/coverage.test.ts
//
// TextFit 엔진 회귀. 이 파일이 지키는 계약:
//
//  1. **커버리지는 기억의 함수다** — 같은 지문·같은 학습자라도 복습을 미루면 내려간다.
//     이 성질이 깨지면 TextFit 은 Lexile 의 열등한 복제품이 된다(경쟁 우위가 사라진다).
//  2. **처방은 최소 개수여야 한다** — "14개만 하면 됩니다" 가 15개면 학습자는 헛수고를 한다.
//  3. **화면에 나가는 숫자는 절대 범위를 벗어나지 않는다** — 커버리지 음수/100% 초과는
//     하이픈 복합어에서 실제로 발생 가능하므로 클램프가 살아있는지 계속 확인한다.

import { describe, expect, it } from 'vitest'

import {
  ASSUMED_WEIGHT,
  BAND_THRESHOLDS,
  FORECAST_DAYS,
  analyzeTextFit,
  bandFor,
  prescribe,
  retentionAt,
  stageFor,
} from '../coverage'
import type { FsrsState, TextFitInput, WordVerdict } from '../types'

const NOW = new Date('2026-08-17T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

function input(partial: Partial<TextFitInput>): TextFitInput {
  return {
    counts: {},
    totalTokens: 0,
    userVLevel: null,
    familiarity: new Map(),
    fsrs: new Map(),
    dictVLevel: new Map(),
    now: NOW,
    ...partial,
  }
}

// ── R(t) ────────────────────────────────────────────────────────────────────

describe('retentionAt — FSRS 인출 확률', () => {
  it('경과일 = stability 이면 정확히 0.9 (수식 정의)', () => {
    const s: FsrsState = { stability: 10, lastReviewAt: daysAgo(10) }
    expect(retentionAt(s, NOW)).toBeCloseTo(0.9, 10)
  })

  it('방금 복습했으면 1.0', () => {
    expect(retentionAt({ stability: 5, lastReviewAt: NOW }, NOW)).toBeCloseTo(1, 10)
  })

  it('stability 가 클수록 같은 기간에 덜 잊는다', () => {
    const weak = retentionAt({ stability: 2, lastReviewAt: daysAgo(14) }, NOW)
    const strong = retentionAt({ stability: 60, lastReviewAt: daysAgo(14) }, NOW)
    expect(strong).toBeGreaterThan(weak)
  })

  it('복습 이력이 없으면(lastReviewAt null) 0 — 단어장에 담기만 한 것은 아는 게 아니다', () => {
    expect(retentionAt({ stability: 30, lastReviewAt: null }, NOW)).toBe(0)
  })

  it('stability 가 null/0/음수면 0 — 기억이 형성되지 않았다', () => {
    expect(retentionAt({ stability: null, lastReviewAt: daysAgo(1) }, NOW)).toBe(0)
    expect(retentionAt({ stability: 0, lastReviewAt: daysAgo(1) }, NOW)).toBe(0)
    expect(retentionAt({ stability: -3, lastReviewAt: daysAgo(1) }, NOW)).toBe(0)
  })

  it('미래 시각(시계 오차)이 들어와도 1 을 넘지 않는다', () => {
    const future = new Date(NOW.getTime() + 5 * 86_400_000)
    expect(retentionAt({ stability: 10, lastReviewAt: future }, NOW)).toBeCloseTo(1, 10)
  })
})

// ── 대역 ────────────────────────────────────────────────────────────────────

describe('bandFor — csat_stage_gates 임계와 일치', () => {
  it('경계값은 상위 대역에 포함된다 (>= 비교)', () => {
    expect(bandFor(BAND_THRESHOLDS.flow)).toBe('flow')
    expect(bandFor(BAND_THRESHOLDS.growth)).toBe('growth')
    expect(bandFor(BAND_THRESHOLDS.study)).toBe('study')
    expect(bandFor(BAND_THRESHOLDS.hard)).toBe('hard')
  })

  it('경계 바로 아래는 한 단계 내려간다', () => {
    expect(bandFor(0.9799)).toBe('growth')
    expect(bandFor(0.9499)).toBe('study')
    expect(bandFor(0.8999)).toBe('hard')
    expect(bandFor(0.8499)).toBe('overload')
  })

  it('overload 는 어떤 학습 단계도 지원하지 않는다', () => {
    expect(stageFor('overload')).toBeNull()
    expect(stageFor('growth')).toBe('S2')
  })
})

// ── 커버리지 계산 ───────────────────────────────────────────────────────────

describe('analyzeTextFit — 커버리지', () => {
  it('기능어는 기지어로 센다 — 분모는 러닝 워드, 내용어만으로 깎이지 않는다', () => {
    // 러닝 워드 100 개 중 내용어 미지어가 2 회 등장 → 커버리지 98%
    const r = analyzeTextFit(input({ counts: { quixotic: 2 }, totalTokens: 100 }))
    expect(r.coverage).toBeCloseTo(0.98, 10)
    expect(r.band).toBe('flow')
    expect(r.breakdown.function_word).toBe(98)
  })

  it('자기보고 known 은 가중치 1 — 커버리지를 깎지 않는다', () => {
    const r = analyzeTextFit(
      input({
        counts: { arbitrary: 5 },
        totalTokens: 100,
        familiarity: new Map([['arbitrary', 'known']]),
      }),
    )
    expect(r.coverage).toBe(1)
    expect(r.unknown).toHaveLength(0)
  })

  it('레벨 추정은 0.85 만 인정한다 — 과대평가 방지', () => {
    const r = analyzeTextFit(
      input({
        counts: { inherent: 10 },
        totalTokens: 100,
        userVLevel: 7,
        dictVLevel: new Map([['inherent', 6]]),
      }),
    )
    // 10 토큰 × (1 - 0.85) = 1.5 미지 질량 → 98.5%
    expect(r.coverage).toBeCloseTo(1 - (10 * (1 - ASSUMED_WEIGHT)) / 100, 10)
    expect(r.breakdown.level_assumed).toBe(10)
  })

  it('학습자 레벨 미진단이면 추정 근거를 쓰지 않는다 — 없는 정보로 후하게 매기지 않는다', () => {
    const r = analyzeTextFit(
      input({
        counts: { inherent: 10 },
        totalTokens: 100,
        userVLevel: null,
        dictVLevel: new Map([['inherent', 3]]),
      }),
    )
    expect(r.breakdown.level_assumed).toBe(0)
    expect(r.breakdown.none).toBe(10)
  })

  it('자기보고가 레벨 추정을 이긴다 — 학습자가 모른다면 모르는 것이다', () => {
    const r = analyzeTextFit(
      input({
        counts: { inherent: 10 },
        totalTokens: 100,
        userVLevel: 9,
        dictVLevel: new Map([['inherent', 2]]),
        familiarity: new Map([['inherent', 'unknown']]),
      }),
    )
    expect(r.coverage).toBeCloseTo(0.9, 10)
    expect(r.unknown.map((u) => u.lemma)).toEqual(['inherent'])
  })

  it('FSRS 가 자기보고 unknown 을 이긴다 — 그 뒤로 학습을 시작했다는 뜻이다', () => {
    const r = analyzeTextFit(
      input({
        counts: { inherent: 10 },
        totalTokens: 100,
        familiarity: new Map([['inherent', 'unknown']]),
        fsrs: new Map([['inherent', { stability: 100, lastReviewAt: NOW }]]),
      }),
    )
    expect(r.coverage).toBe(1)
    expect(r.breakdown.fsrs).toBe(10)
  })

  it('하이픈 복합어로 미지 질량이 분모를 넘어도 커버리지는 0 아래로 안 간다', () => {
    const r = analyzeTextFit(input({ counts: { a: 50, b: 50, c: 50 }, totalTokens: 100 }))
    expect(r.coverage).toBe(0)
    expect(r.band).toBe('overload')
    expect(r.stage).toBeNull()
  })

  it('빈 지문은 커버리지 1 — 0 으로 나누지 않는다', () => {
    const r = analyzeTextFit(input({ counts: {}, totalTokens: 0 }))
    expect(r.coverage).toBe(1)
    expect(r.prescriptions.every((p) => p.wordsNeeded === 0)).toBe(true)
  })

  it('breakdown 합 = 러닝 워드 수 — 커버리지의 출처가 화면에서 검산된다', () => {
    const r = analyzeTextFit(
      input({
        counts: { alpha: 3, beta: 2, gamma: 5 },
        totalTokens: 60,
        userVLevel: 6,
        dictVLevel: new Map([['beta', 4]]),
        familiarity: new Map([['alpha', 'known']]),
      }),
    )
    const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0)
    expect(sum).toBe(60)
  })
})

// ── 신뢰 구간 ───────────────────────────────────────────────────────────────

describe('신뢰도와 범위 — 추정에 기댄 만큼 정직하게 넓어진다', () => {
  it('추정이 없으면 confidence 1, 범위 폭 0', () => {
    const r = analyzeTextFit(
      input({
        counts: { alpha: 5 },
        totalTokens: 100,
        familiarity: new Map([['alpha', 'known']]),
      }),
    )
    expect(r.confidence).toBe(1)
    expect(r.coverageHigh - r.coverageLow).toBeCloseTo(0, 10)
  })

  it('추정 비중이 클수록 범위가 넓어지고 신뢰도는 떨어진다', () => {
    const mk = (n: number) =>
      analyzeTextFit(
        input({
          counts: { alpha: n },
          totalTokens: 100,
          userVLevel: 8,
          dictVLevel: new Map([['alpha', 3]]),
        }),
      )
    const small = mk(10)
    const large = mk(40)
    expect(large.confidence).toBeLessThan(small.confidence)
    expect(large.coverageHigh - large.coverageLow).toBeGreaterThan(
      small.coverageHigh - small.coverageLow,
    )
  })

  it('하한/상한은 항상 [0,1] 안에 있고 coverage 를 감싼다', () => {
    const r = analyzeTextFit(
      input({
        counts: { alpha: 80 },
        totalTokens: 100,
        userVLevel: 9,
        dictVLevel: new Map([['alpha', 1]]),
      }),
    )
    expect(r.coverageLow).toBeGreaterThanOrEqual(0)
    expect(r.coverageHigh).toBeLessThanOrEqual(1)
    expect(r.coverageLow).toBeLessThanOrEqual(r.coverage)
    expect(r.coverage).toBeLessThanOrEqual(r.coverageHigh)
  })
})

// ── 살아있는 커버리지 (핵심 차별점) ────────────────────────────────────────

describe('살아있는 커버리지 — 복습을 미루면 내려간다', () => {
  const base = () =>
    input({
      counts: { alpha: 10, beta: 10 },
      totalTokens: 100,
      fsrs: new Map([
        ['alpha', { stability: 7, lastReviewAt: NOW }],
        ['beta', { stability: 7, lastReviewAt: NOW }],
      ]),
    })

  it('14일 예보는 현재보다 낮다 — 정적 지표였다면 같아야 한다', () => {
    const r = analyzeTextFit(base())
    expect(r.coverage).toBeCloseTo(1, 10)
    expect(r.coverageIn14Days).toBeLessThan(r.coverage)
  })

  it('예보 감쇠폭이 R(t) 수식과 정확히 일치한다', () => {
    const r = analyzeTextFit(base())
    const rFuture = Math.exp((Math.log(0.9) * FORECAST_DAYS) / 7)
    // 20 토큰이 R 만큼만 인정된다 → 미지 질량 20×(1-R)
    expect(r.coverageIn14Days).toBeCloseTo(1 - (20 * (1 - rFuture)) / 100, 10)
  })

  it('안정성이 높은 학습자는 예보가 거의 안 떨어진다', () => {
    const strong = analyzeTextFit(
      input({
        counts: { alpha: 20 },
        totalTokens: 100,
        fsrs: new Map([['alpha', { stability: 400, lastReviewAt: NOW }]]),
      }),
    )
    expect(strong.coverage - strong.coverageIn14Days).toBeLessThan(0.01)
  })

  it('흔들리는 단어(R<0.9)를 잡아낸다 — 복습만으로 회복 가능한 손실', () => {
    const r = analyzeTextFit(
      input({
        counts: { shaky: 4, solid: 4 },
        totalTokens: 100,
        fsrs: new Map([
          ['shaky', { stability: 5, lastReviewAt: daysAgo(20) }], // R ≈ 0.66
          ['solid', { stability: 200, lastReviewAt: daysAgo(1) }], // R ≈ 1.00
        ]),
      }),
    )
    expect(r.fading.map((f) => f.lemma)).toEqual(['shaky'])
    expect(r.unknown).toHaveLength(0) // 잊고 있을 뿐 미지어는 아니다
  })

  // 실 데이터에서 나온 요구 — 검증 계정 135장 중 19장이 review_count=13 인데 stability≈0 이었다.
  it('완전히 잊은 단어를 "처음 보는 단어" 로 부르지 않는다', () => {
    const r = analyzeTextFit(
      input({
        counts: { forgotten: 5, brandNew: 5 },
        totalTokens: 100,
        // stability 0.21일 · 마지막 복습 30일 전 → R ≈ 0 (실측 분포에서 가장 흔한 조합)
        fsrs: new Map([['forgotten', { stability: 0.21, lastReviewAt: daysAgo(30) }]]),
      }),
    )

    expect(r.unknown.map((u) => u.lemma)).toEqual(['brandNew'])
    expect(r.fading.map((f) => f.lemma)).toEqual(['forgotten'])
    // 커버리지 기여는 둘 다 사실상 0 이다 — 분류만 다르고 수식은 정직하게 유지된다.
    //   R(t) = exp(ln0.9 × 30/0.21) ≈ 2.9e-7 로 0 이 아니다. 반올림해서 0 으로 만들지 않는다 —
    //   "거의 잊었다" 와 "본 적 없다" 를 수식이 구분하고 있다는 뜻이라 그대로 둔다.
    expect(r.coverage).toBeCloseTo(0.9, 6)
    expect(r.coverage).toBeGreaterThan(0.9)
  })

  it('복습 이력이 없는 카드는 미지어다 — 담기만 한 것은 배운 게 아니다', () => {
    const r = analyzeTextFit(
      input({
        counts: { justAdded: 5 },
        totalTokens: 100,
        // 실측: last_review_at IS NULL ⟺ review_count = 0 (예외 0건)
        fsrs: new Map([['justAdded', { stability: 0, lastReviewAt: null }]]),
      }),
    )
    expect(r.coverage).toBeCloseTo(0.95, 10)
    // FSRS 카드가 있으니 fading 으로 분류된다 — 처방에서 "돌아올 단어" 로 안내된다
    expect(r.fading.map((f) => f.lemma)).toEqual(['justAdded'])
    expect(r.unknown).toHaveLength(0)
  })
})

// ── 처방 ────────────────────────────────────────────────────────────────────

describe('prescribe — 최소 단어 수 역산', () => {
  const wv = (lemma: string, count: number): WordVerdict => ({
    lemma,
    count,
    source: 'none',
    weight: 0,
    vLevel: null,
  })

  it('이미 목표를 넘었으면 0개', () => {
    const p = prescribe([wv('a', 1)], 100, 0.99, 0.95)
    expect(p.wordsNeeded).toBe(0)
    expect(p.reachable).toBe(true)
  })

  it('빈도 높은 단어부터 고른다 — 같은 개수로 최대 효과', () => {
    const cands = [wv('rare', 1), wv('common', 5), wv('mid', 3)]
    const p = prescribe(cands, 100, 0.91, 0.95)
    expect(p.words[0]?.lemma).toBe('common')
  })

  it('최소성 — 한 개를 빼면 목표에 못 닿는다', () => {
    const cands = [wv('a', 4), wv('b', 3), wv('c', 2), wv('d', 1)]
    const total = 100
    const current = 1 - (4 + 3 + 2 + 1) / total // 0.90
    const p = prescribe(cands, total, current, 0.95)

    expect(p.reachable).toBe(true)
    const gainOfLast = (p.words[p.words.length - 1]!.count * 1) / total
    expect(p.projectedCoverage - gainOfLast).toBeLessThan(0.95)
  })

  it('결정론 — 같은 입력이면 항상 같은 처방 (동률은 사전순)', () => {
    const cands = [wv('zeta', 3), wv('alpha', 3), wv('mid', 3)]
    const a = prescribe(cands, 100, 0.91, 0.95)
    const b = prescribe([...cands].reverse(), 100, 0.91, 0.95)
    expect(a.words.map((w) => w.lemma)).toEqual(b.words.map((w) => w.lemma))
    expect(a.words[0]?.lemma).toBe('alpha')
  })

  it('전부 익혀도 목표에 못 닿으면 reachable=false — 거짓 희망을 주지 않는다', () => {
    const p = prescribe([wv('a', 1)], 100, 0.9, 0.98)
    expect(p.reachable).toBe(false)
    expect(p.projectedCoverage).toBeCloseTo(0.91, 10)
  })

  it('흔들리는 단어도 처방 후보다 — 복습이 곧 커버리지 회복이다', () => {
    const r = analyzeTextFit(
      input({
        counts: { shaky: 8 },
        totalTokens: 100,
        fsrs: new Map([['shaky', { stability: 3, lastReviewAt: daysAgo(30) }]]),
      }),
    )
    const p95 = r.prescriptions.find((p) => p.target === 0.95)!
    expect(p95.words.some((w) => w.lemma === 'shaky')).toBe(true)
  })

  it('처방 목표는 다독 적정(0.95)과 무보조(0.98) 두 개', () => {
    const r = analyzeTextFit(input({ counts: { a: 20 }, totalTokens: 100 }))
    expect(r.prescriptions.map((p) => p.target)).toEqual([0.95, 0.98])
    // 더 높은 목표가 더 많은(또는 같은) 단어를 요구한다 — 단조성
    expect(r.prescriptions[1]!.wordsNeeded).toBeGreaterThanOrEqual(r.prescriptions[0]!.wordsNeeded)
  })
})

// ── 실제 시나리오 ───────────────────────────────────────────────────────────

describe('시나리오 — 고3이 내신 프린트를 붙여넣었을 때', () => {
  it('진단만 끝낸 학습자: 판정은 나오되 신뢰도가 낮다고 말한다', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 40; i++) counts[`w${i}`] = 2
    const dict = new Map(Object.keys(counts).map((w, i) => [w, i < 34 ? 5 : 9] as const))

    const r = analyzeTextFit(
      input({ counts, totalTokens: 220, userVLevel: 6, dictVLevel: new Map(dict) }),
    )

    expect(r.confidence).toBeLessThan(0.8) // 대부분이 추정 근거
    expect(r.coverageHigh).toBeGreaterThan(r.coverage)
    expect(r.unknown.length).toBe(6) // 레벨 위 단어만 미지어
  })

  it('학습 이력이 쌓인 학습자: 신뢰도가 오르고 예보가 의미를 갖는다', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 40; i++) counts[`w${i}`] = 2
    const fsrs = new Map(
      Object.keys(counts).map(
        (w, i) => [w, { stability: 10 + i, lastReviewAt: daysAgo(3) }] as const,
      ),
    )

    const r = analyzeTextFit(input({ counts, totalTokens: 220, fsrs: new Map(fsrs) }))

    expect(r.confidence).toBe(1) // 추정에 기대지 않았다
    expect(r.coverageIn14Days).toBeLessThan(r.coverage) // 복습을 미루면 내려간다
    expect(r.breakdown.fsrs).toBe(80)
  })
})
