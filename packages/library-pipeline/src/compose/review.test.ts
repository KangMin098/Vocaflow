// packages/library-pipeline/src/compose/review.test.ts
//
// 초안 검수 — 잰 것과 판단이 필요한 것의 경계를 못 박는다.

import { describe, expect, it } from 'vitest'

import { withAttribution } from './attribution'
import { assessFactDensity, OBSERVED_FACT_DENSITY, REVIEW_JUDGE_CHECKLIST, reviewDraft } from './review'
import type { SpineWord } from './spine'

const W = (spec: Array<[string, number | null]>): SpineWord[] =>
  spec.map(([word, v]) => ({ word, v }))

const SPEC = { words: { min: 90, max: 170 }, avgSentenceWords: 9, band: 'elementary' as const }

const EASY = [
  'A river ran low this summer. The water fell far below its usual level. People saw the change. Boats could not pass.',
  'The plant takes water from that river. It has no other way to cool. The company had to stop it. The lights stayed on.',
].join('\n\n')

describe('검수 — 잰 것', () => {
  it('출처 표기는 본문에서 떼고 잰다 — 표기 어수가 발주 어수로 계산되면 안 된다', () => {
    const bare = reviewDraft({ text: EASY, spec: SPEC, words: [] })
    const withNote = reviewDraft({
      text: withAttribution(EASY, ['bbc.co.uk', 'dw.com']),
      spec: SPEC,
      words: [],
    })
    expect(withNote.metrics.words).toBe(bare.metrics.words)
    expect(withNote.metrics.hasAttribution).toBe(true)
    expect(bare.metrics.hasAttribution).toBe(false)
  })

  it('출처 표기가 없으면 지적한다', () => {
    const r = reviewDraft({ text: EASY, spec: SPEC, words: [] })
    expect(r.findings.map((f) => f.code)).toContain('R7')
  })

  it('가장 무거운 문장으로 글을 열면 진입 부담을 지적한다', () => {
    // 실측: 수능형 첫 문장이 34어절(목표 22)이었다. 길이만 보면 임의 기준이 되므로
    //   글 안에서의 상대 위치를 함께 본다.
    const heavy = [
      'A nuclear station needs a steady supply of cool water and for this plant that supply comes entirely from the river nearby.',
      'The river fell.',
      'The plant stopped.',
      'People noticed.',
      'The town waited.',
      'Rain came later.',
    ].join(' ')
    const r = reviewDraft({
      text: withAttribution(heavy, ['x.com']),
      spec: { ...SPEC, avgSentenceWords: 9 },
      words: [],
    })
    expect(r.findings.map((f) => f.code)).toContain('R2')
  })

  it('짧은 문장이 고르게 이어지면 진입 부담을 지적하지 않는다', () => {
    const r = reviewDraft({ text: withAttribution(EASY, ['x.com']), spec: SPEC, words: [] })
    expect(r.findings.map((f) => f.code)).not.toContain('R2')
  })

  it('빈 줄 없이 길게 쓰면 문단 구성을 지적한다 — 단일 개행은 문단이 아니다', () => {
    const oneBlock = Array.from({ length: 9 }, (_, i) => `This is sentence number ${i} here.`).join(' ')
    const r = reviewDraft({ text: withAttribution(oneBlock, ['x.com']), spec: SPEC, words: [] })
    const r4 = r.findings.find((f) => f.code === 'R4')
    expect(r4?.detail).toContain('한 문단')
  })

  it('밴드를 넘는 단어를 이름까지 말한다', () => {
    const r = reviewDraft({
      text: withAttribution(EASY, ['x.com']),
      spec: SPEC,
      words: W([['river', 2], ['reactor', 8], ['coolant', 9]]),
    })
    const r5 = r.findings.find((f) => f.code === 'R5')
    expect(r5?.detail).toContain('reactor(V8)')
    expect(r5?.detail).toContain('coolant(V9)')
  })

  it('원장에 있는데 안 쓴 사실을 지적한다', () => {
    const r = reviewDraft({
      text: withAttribution(EASY, ['x.com']),
      spec: SPEC,
      words: [],
      ledgerFactIds: ['f1', 'f2', 'f3'],
      factOrder: ['f1'],
    })
    expect(r.findings.find((f) => f.code === 'R6')?.detail).toContain('2건')
  })
})

describe('검수 — 판단이 필요한 것', () => {
  it('지적이 0건이어도 판단 목록은 항상 함께 돌려준다', () => {
    const clean = reviewDraft({
      text: withAttribution(EASY, ['x.com']),
      // 이 픽스처의 실제 평균(≈5.8어절)에 맞춘 발주 — 목표가 어긋나면 R3 가 먼저 뜬다.
      spec: { ...SPEC, words: { min: 10, max: 400 }, avgSentenceWords: 6 },
      words: W([['river', 2]]),
    })
    expect(clean.findings).toEqual([])
    expect(clean.judgeChecklist.length).toBeGreaterThan(0)
  })

  it('기계가 못 잡는 것이 목록에 들어 있다', () => {
    // "about twenty percent" 와 "One fifth of the country's power" 는 같은 사실인데
    // 내용어가 하나도 겹치지 않는다 — 어떤 임계값으로도 못 잡는다.
    const joined = REVIEW_JUDGE_CHECKLIST.join(' ')
    expect(joined).toContain('두 번 말하지')
    expect(joined).toContain('의의')
    expect(joined).toContain('재인')
  })

  it('판단 항목은 검수 보고서와 같은 목록이다 — 두 벌이면 갈린다', () => {
    const r = reviewDraft({ text: EASY, spec: SPEC, words: [] })
    expect(r.judgeChecklist).toEqual([...REVIEW_JUDGE_CHECKLIST])
  })
})

describe('사실 밀도 — 판정이 아니라 예보', () => {
  it('실측 범위 안쪽은 편안하다고 말한다', () => {
    // 실제로 쓴 글들: 149어/8사실=18.6 · 188/8=23.5
    expect(assessFactDensity(149, 8).verdict).toBe('comfortable')
    expect(assessFactDensity(188, 8).verdict).toBe('comfortable')
  })

  it('범위 위쪽이면 늘려 쓰는 자리라고 알린다', () => {
    // 실측 35.8·36.6 — 내가 어수를 채우려 애썼던 두 편이다.
    const a = assessFactDensity(180, 5)
    expect(a.verdict).toBe('stretch')
    expect(a.detail).toContain('두 번 말하지 않도록')
  })

  it('해낸 적 없는 밀도는 따로 표시한다', () => {
    // 사실 5개로 320어 = 64어/사실. 실측 최대(36.6)의 두 배에 가깝다.
    const a = assessFactDensity(320, 5)
    expect(a.verdict).toBe('beyond-observed')
    expect(a.detail).toContain('사실을 더 넣거나')
  })

  it('사실이 없으면 밀도가 아니라 근거가 없는 것이다', () => {
    const a = assessFactDensity(180, 0)
    expect(a.verdict).toBe('beyond-observed')
    expect(a.detail).toContain('쓸 근거가 없')
  })

  it('기준은 어수 하한이다 — 채우기 어려운 쪽이 하한이다', () => {
    // 같은 사실 수라도 하한이 높으면 더 빡빡하다.
    expect(assessFactDensity(90, 5).density).toBeLessThan(assessFactDensity(180, 5).density)
  })

  it('관측 분포를 값으로 남긴다 — 범위만 남기면 모양을 알 수 없다', () => {
    expect(OBSERVED_FACT_DENSITY.values).toHaveLength(OBSERVED_FACT_DENSITY.samples)
    expect(Math.min(...OBSERVED_FACT_DENSITY.values)).toBe(OBSERVED_FACT_DENSITY.min)
    expect(Math.max(...OBSERVED_FACT_DENSITY.values)).toBe(OBSERVED_FACT_DENSITY.max)
  })
})
