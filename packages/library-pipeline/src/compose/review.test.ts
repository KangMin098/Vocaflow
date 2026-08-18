// packages/library-pipeline/src/compose/review.test.ts
//
// 초안 검수 — 잰 것과 판단이 필요한 것의 경계를 못 박는다.

import { describe, expect, it } from 'vitest'

import { withAttribution } from './attribution'
import { REVIEW_JUDGE_CHECKLIST, reviewDraft } from './review'
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
