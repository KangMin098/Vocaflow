// apps/web/src/lib/csat/judgment/__tests__/r-summary.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { itemsOf } from '../fixtures'
import reveal from '../fixtures/r-summary.reveal.json'
import { leakedAnswerKeys, refsOf } from '../evidence'
import {
  candidatesOf, choiceOfCombo, compareWithReveal, flagsOf, initialState, keyOf, link, linksOf, overview, parseChoices, pick, reusedIn,
  setPolarity, summaryParts, summarySource,
} from '../r-summary'
import type { RevealData } from '../types'

const items = itemsOf('R-SUMMARY')
const item = items[0]
const rv = (reveal as { reveal: RevealData[] }).reveal[0]
const gapUnits = item.units.map((u) => (u.id === 'u9' ? { ...u, text: 'These individuals were more likely to have found jobs.' } : u))

describe('R-SUMMARY 픽스처 구조', () => {
  it('실제 문항은 H1906G1#40 하나뿐 — 두 번째 문항 없음', () => {
    expect(items.map((i) => i.id)).toEqual(['H1906G1#40'])
  })
  it('선지를 칸별 후보어로 나눈다', () => {
    expect(parseChoices(item.choices)?.[1]).toEqual({ a: 'effective', b: 'success' })
    expect(candidatesOf(item.choices)).toEqual({ A: ['effective', 'discouraging', 'common'], B: ['frustration', 'success', 'cooperation', 'failure', 'difficulty'] })
  })
  it('구분자 결함이면 null — 조합에 기대지 않는다', () => {
    expect(parseChoices(['effective success'])).toBeNull()
    expect(candidatesOf(['broken'])).toEqual({ A: [], B: [] })
  })
  it('u9 뒤에 붙은 요약문을 떼어 내고 (A)(B) 껍데기 u10 은 근거에서 뺀다', () => {
    const src = summarySource(item.units)
    expect(src.summary?.fromUnit).toBe('u9')
    expect(src.summary?.text.startsWith('Positive expectations are more (A)')).toBe(true)
    expect(src.shells).toEqual(['u10'])
    const u9 = src.evidence.find((u) => u.id === 'u9')!
    expect(u9.text).toContain('passed their exams')
    expect(u9.text).not.toContain('(A)')
    expect(summaryParts(src.summary!.text).flatMap((p) => (p.kind === 'slot' ? [p.slot] : []))).toEqual(['A', 'B'])
  })
  it('요약문이 껍데기만 있으면 지어내지 않고 null', () => {
    const src = summarySource(gapUnits)
    expect(src.summary).toBeNull()
    expect(src.shells).toEqual(['u10'])
  })
})

describe('판단 기능', () => {
  it('칸마다 독립 선택 · 조합 위치 표시', () => {
    let s = pick(initialState(), 'A', 'effective')
    expect(choiceOfCombo(item.choices, s.pick.A, s.pick.B)).toBeNull()
    s = pick(s, 'B', 'success')
    expect(choiceOfCombo(item.choices, s.pick.A, s.pick.B)).toBe(2)
    s = pick(s, 'B', 'difficulty')
    expect(choiceOfCombo(item.choices, s.pick.A, s.pick.B)).toBeNull()
    s = pick(s, 'B', 'difficulty')
    expect(s.pick.B).toBeUndefined()
  })
  it('지지/반박 잇기 · 같은 관계 재누름은 떼기 · 다른 관계로 바꾸기', () => {
    const k = keyOf('A', 'effective')
    let s = link(initialState(), k, 'u8', 'support')
    s = link(s, k, 'u7', 'refute')
    expect(linksOf(s, k, 'support')).toEqual(['u8'])
    s = link(s, k, 'u7', 'support')
    expect(linksOf(s, k, 'refute')).toEqual([])
    s = link(s, k, 'u8', 'support')
    expect(linksOf(s, k, 'support')).toEqual(['u7'])
  })
  it('지지 근거 한 문장뿐이면 범위 과대 표지 — 한 문장으로 결론 내리지 않게', () => {
    const src = summarySource(item.units)
    const k = keyOf('A', 'effective')
    let s = link(initialState(), k, 'u8', 'support')
    expect(flagsOf(s, 'A', 'effective', ['effective', 'discouraging'], src.evidence).map((f) => f.kind)).toContain('scope')
    s = link(s, k, 'u9', 'support')
    expect(flagsOf(s, 'A', 'effective', ['effective', 'discouraging'], src.evidence).map((f) => f.kind)).not.toContain('scope')
  })
  it('반대 극성 두 후보가 같은 문장을 지지로 쓰면 극성 반전 표지, 같은 극성이면 없음', () => {
    const src = summarySource(item.units)
    const A = candidatesOf(item.choices).A
    let s = initialState()
    s = setPolarity(s, keyOf('A', 'effective'), 'pos')
    s = setPolarity(s, keyOf('A', 'discouraging'), 'neg')
    s = link(s, keyOf('A', 'effective'), 'u7', 'support')
    s = link(s, keyOf('A', 'discouraging'), 'u7', 'support')
    expect(flagsOf(s, 'A', 'effective', A, src.evidence).find((x) => x.kind === 'polarity')).toMatchObject({ unitIds: ['u7'], other: 'discouraging' })
    s = setPolarity(s, keyOf('A', 'discouraging'), 'pos')
    expect(flagsOf(s, 'A', 'effective', A, src.evidence).some((x) => x.kind === 'polarity')).toBe(false)
  })
  it('원문 낱말 재사용: success 는 u8 에, frustration 은 없음 · 요약문 부분은 근거에서 빠진다', () => {
    const src = summarySource(item.units)
    expect(reusedIn('success', src.evidence)).toContain('u8')
    expect(reusedIn('frustration', src.evidence)).toEqual([])
    expect(reusedIn('effective', src.evidence)).toEqual([])
  })
})

describe('공개 계약', () => {
  it('공개 전 모델 출력에 정답·판정 키 없음', () => {
    const s = link(pick(pick(initialState(), 'A', 'effective'), 'B', 'success'), keyOf('A', 'effective'), 'u8', 'support')
    expect(leakedAnswerKeys(overview(item, s))).toEqual([])
    expect(leakedAnswerKeys(item)).toEqual([])
  })
  it('공개 뒤 학습자 판단과 해설 근거 대조', () => {
    let s = pick(pick(initialState(), 'A', 'effective'), 'B', 'frustration')
    s = link(s, keyOf('A', 'effective'), 'u8', 'support')
    const c = compareWithReveal(item, s, rv)
    expect(c.answerWords).toEqual({ a: 'effective', b: 'success' })
    expect(c.slotMatch).toEqual({ A: true, B: false })
    expect(c.locus).toEqual(['u7', 'u8', 'u9'])
    expect(c.shared).toEqual(['u8'])
    expect(c.missed).toEqual(['u7', 'u9'])
  })
  it('해설의 [uN] 참조는 모두 실제 원문 단위', () => {
    for (const ch of rv.choices) {
      const t = ch.verdict === 'correct' ? ch.why_correct : `${ch.why_tempting ?? ''} ${ch.how_to_reject ?? ''}`
      expect(refsOf(t, item.units).length).toBeGreaterThan(0)
    }
  })
  it('자료 없음: 빈 원문이면 요약문 없음 · 근거 없음', () => {
    expect(summarySource([])).toEqual({ summary: null, evidence: [], shells: [] })
  })
})
