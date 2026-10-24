// apps/web/src/lib/csat/judgment/__tests__/r-grammar.test.ts
// R-GRAMMAR 판단 모델 — 실제 픽스처 2문항(H2609G2#29 · H2609G1#29)으로 검사한다.
import { describe, expect, it } from 'vitest'
import { checkReveal, leakedAnswerKeys, refsOf } from '../evidence'
import { itemsOf, revealOf } from '../fixtures'
import {
  alternativesOf, analysisFor, choiceDefects, clampLen, learnerRecord, markState, parseMarks, patchMark, setRole, spanText, warningsOf,
  type GrammarState,
} from '../r-grammar'

const items = itemsOf('R-GRAMMAR')
const [g2, g1] = items

describe('밑줄 지점 찾기 — units 의 ①~⑤ 기호', () => {
  it('두 문항 모두 다섯 지점이 원문 단위에 있다', () => {
    for (const it of items) {
      const marks = parseMarks(it.units)
      expect(marks.map((m) => m.n)).toEqual([1, 2, 3, 4, 5])
      for (const m of marks) expect(it.units.find((u) => u.id === m.unitId)!.text).toContain('①②③④⑤'[m.n - 1])
    }
  })
  it('후보 낱말은 기호 바로 뒤 낱말이다(선지 문자열이 아니라)', () => {
    expect(parseMarks(g2.units).map((m) => spanText(m, m.defaultLen))).toEqual(['one', 'Reproducing', 'bring', 'abundantly', 'which'])
    expect(parseMarks(g1.units).map((m) => spanText(m, m.defaultLen))).toEqual(['which', 'to access', 'creating', 'is', 'warmed'])
  })
  it('학습자가 범위를 넓히고 좁힐 수 있되 문장 끝·4낱말을 넘지 않는다', () => {
    const m = parseMarks(g1.units).find((x) => x.n === 5)! // warmed up, exercise ...
    expect(spanText(m, 2)).toBe('warmed up')
    expect(clampLen(m, 0)).toBe(1)
    expect(clampLen(m, 99)).toBe(4)
    const last = parseMarks(g1.units).find((x) => x.n === 4)! // is often so miserable.
    expect(clampLen(last, 99)).toBe(4)
    expect(spanText(last, 4)).toBe('is often so miserable')
  })
  it('기호 없는 원문은 지점 0 — 자료 없음', () => {
    expect(parseMarks([{ id: 'u1', n: 1, kind: 'sentence', text: 'No marks here.' }])).toEqual([])
    expect(parseMarks([])).toEqual([])
  })
})

describe('원문 파싱 결함 기록', () => {
  it('DB choices 가 밑줄이 아니라 다음 기호까지 잘린 긴 문자열이다 — 결함으로 기록', () => {
    for (const it of items) {
      const d = choiceDefects(it)
      expect(d.filter((x) => x.kind === 'choice-overlong').length).toBeGreaterThanOrEqual(4)
      expect(d.some((x) => x.kind === 'mark-missing' || x.kind === 'mark-count')).toBe(false)
    }
  })
})

describe('구조 표시 · 반례 질문', () => {
  it('G1 ④: 가까운 명사 workout 을 주어로 고르면 전치사 of 반례가 뜬다, minutes 면 안 뜬다', () => {
    const m = parseMarks(g1.units).find((x) => x.n === 4)!
    const iWorkout = m.tokens.indexOf('workout')
    const iMinutes = m.tokens.indexOf('minutes')
    let s: GrammarState = setRole({}, 4, iWorkout, 'S')
    s = setRole(s, 4, m.at, 'V')
    expect(warningsOf(m, markState(s, 4)).map((w) => w.id)).toContain('near-noun')
    let t: GrammarState = setRole({}, 4, iMinutes, 'S')
    t = setRole(t, 4, m.at, 'V')
    expect(warningsOf(m, markState(t, 4)).map((w) => w.id)).not.toContain('near-noun')
  })
  it('G2 ②: 문두 -ing 를 수식으로 묶고 다른 주어가 없으면 동명사 주어 반례가 뜬다', () => {
    const m = parseMarks(g2.units).find((x) => x.n === 2)!
    let s = setRole({}, 2, 0, 'M')
    s = setRole(s, 2, m.tokens.indexOf('is'), 'V')
    expect(warningsOf(m, markState(s, 2)).map((w) => w.id)).toContain('initial-ing')
    const t = setRole(setRole({}, 2, 0, 'S'), 2, m.tokens.indexOf('is'), 'V')
    expect(warningsOf(m, markState(t, 2)).map((w) => w.id)).not.toContain('initial-ing')
  })
  it('관계사 낱말 하나만으로 완전/불완전을 결론 내리지 않게 한다 — 뒤 절 성분 표시 요구', () => {
    const m = parseMarks(g2.units).find((x) => x.n === 5)!
    const s = patchMark({}, 5, { need: 'rel-complete' })
    expect(warningsOf(m, markState(s, 5)).map((w) => w.id)).toContain('no-structure')
    const s2 = setRole(setRole(s, 5, m.tokens.indexOf('things'), 'S'), 5, m.tokens.indexOf('seized'), 'V')
    expect(warningsOf(m, markState(s2, 5)).map((w) => w.id)).not.toContain('no-structure')
  })
  it('같은 붓으로 다시 누르면 지우고, 지점별 상태는 서로 섞이지 않는다', () => {
    let s = setRole({}, 1, 3, 'S')
    s = setRole(s, 2, 0, 'V')
    expect(markState(s, 1).roles).toEqual({ 3: 'S' })
    s = setRole(s, 1, 3, 'S')
    expect(markState(s, 1).roles).toEqual({})
    expect(markState(s, 2).roles).toEqual({ 0: 'V' })
  })
})

describe('대안 형태(조건 조작)', () => {
  it('which ↔ where, is ↔ are, -ly → 형용사 를 낱말로, 그 밖은 형태 종류로 낸다', () => {
    const m2 = parseMarks(g2.units)
    expect(alternativesOf(m2[4], 1).map((a) => a.label)).toContain('where')
    expect(alternativesOf(m2[3], 1).map((a) => a.id)).toContain('adj:abundant')
    const m1 = parseMarks(g1.units)
    expect(alternativesOf(m1[3], 1).map((a) => a.id)).toContain('num:are')
    expect(alternativesOf(m1[1], 2).map((a) => a.id)).toEqual(['orig', 'form:ing', 'form:bare'])
    for (const m of [...m1, ...m2]) expect(alternativesOf(m, m.defaultLen)[0].id).toBe('orig')
  })
})

describe('공개 상태', () => {
  it('공개 전 모델 출력에 정답·verdict 가 없다', () => {
    for (const it of items) {
      const marks = parseMarks(it.units)
      const out = marks.map((m) => ({ m, alts: alternativesOf(m, m.defaultLen), rec: learnerRecord(m, markState({}, m.n)) }))
      expect(leakedAnswerKeys({ marks, out, defects: choiceDefects(it) })).toEqual([])
    }
  })
  it('공개 뒤: 해설 근거가 원문 같은 문장으로 이어지고 정답 지점의 기호가 그 문장에 있다', async () => {
    for (const it of items) {
      const r = checkReveal(it, await revealOf('R-GRAMMAR', it.id))
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      const marks = parseMarks(it.units)
      const ans = marks.find((m) => m.n === r.data.answer)!
      expect(it.units.find((u) => u.id === ans.unitId)!.n).toBe(r.data.answerLocus!.sentence_index![0])
      for (const m of marks) {
        const a = analysisFor(r.data, m.n)!
        const text = a.verdict === 'correct' ? a.confirmed_at?.note : a.how_to_reject
        expect(refsOf(text, it.units)).toContain(m.unitId)
      }
    }
  })
  it('판본이 다르거나 자료 형식이 틀리면 공개하지 않는다', async () => {
    const d = await revealOf('R-GRAMMAR', g1.id)
    expect(checkReveal(g1, { ...d, analysisVersion: 99 })).toEqual({ ok: false, reason: 'version' })
    expect(checkReveal(g1, null)).toEqual({ ok: false, reason: 'shape' })
  })
})
