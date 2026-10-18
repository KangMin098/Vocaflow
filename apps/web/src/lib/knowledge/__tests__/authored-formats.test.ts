// apps/web/src/lib/knowledge/__tests__/authored-formats.test.ts
// FINAL §5 — 과제 형식별 채점 계약. 형식마다 「무엇이 맞아야 정답인가」와 우연 정답 · 형식 밖 응답 처리를 본다.
import { describe, expect, it } from 'vitest'

import { FORMAT_SPECS } from '../authored/formats'

const S6 = ['s0.', 's1.', 's2.', 's3.', 's4.', 's5.']
const D4 = (answer: number, design = 'distorted') => [0, 1, 2, 3, 4].filter((i) => i !== answer).map((choice) => ({ choice, design, why: '이유를 충분히 적었다' }))

describe('choice_evidence(e.evidence_location · r.inference)', () => {
  const body = { format: 'choice_evidence', sentences: S6, stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'] }
  const gold = { answer: 2, decisive: 3, evidence: [3, 4], evidenceAlt: [1], rationale: '3번이 빈칸을 정한다 — 이유', distractors: D4(2) }
  const g = (r: unknown) => FORMAT_SPECS.choice_evidence.grade(body, gold, r, 'v1')
  it('검증 통과 · 결정 근거가 근거 목록에 없으면 위반', () => {
    expect(FORMAT_SPECS.choice_evidence.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.choice_evidence.validate(body, { ...gold, evidence: [4] })).toContain('근거 문장에 결정 근거가 없다')
  })
  it('정답 = 선택 ✓ + 결정 근거 포함 + 범주 밖 근거 없음(보조 근거는 허용)', () => {
    expect(g({ choice: 2, evidence: [3] })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 2, evidence: [1, 3] })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 2, evidence: [4] })?.grade).toMatchObject({ isCorrect: false, decisiveOk: false })
    expect(g({ choice: 2, evidence: [3, 0] })?.grade).toMatchObject({ isCorrect: false, evidenceExtra: [0] })
    expect(g({ choice: 1, evidence: [3] })?.grade).toMatchObject({ isCorrect: false, choiceDesign: 'distorted' })
  })
  it('근거 없이 고른 답 · 범위 밖은 형식 밖(null)', () => {
    expect(g({ choice: 2, evidence: [] })).toBeNull()
    expect(g({ choice: 2 })).toBeNull()
    expect(g({ choice: 9, evidence: [3] })).toBeNull()
  })
})

describe('option_correspondence(e.option_correspondence)', () => {
  const body = { format: 'option_correspondence', sentences: S6, stem: '다음 글의 내용과 일치하지 않는 것은?', choices: ['a', 'b', 'c', 'd', 'e'] }
  const options = [
    { verdict: 'matches', sentence: 0, why: '0번과 같은 뜻이다' }, { verdict: 'matches', sentence: 1, why: '1번과 같은 뜻이다' },
    { verdict: 'reversed', sentence: 2, why: '2번과 반대로 말한다' }, { verdict: 'matches', sentence: 3, why: '3번과 같은 뜻이다' },
    { verdict: 'matches', sentence: 4, why: '4번과 같은 뜻이다' },
  ]
  const gold = { answer: 2, options }
  const g = (r: unknown) => FORMAT_SPECS.option_correspondence.grade(body, gold, r, 'v1')
  const right = { choice: 2, options: options.map((o) => ({ verdict: o.verdict, sentence: o.sentence })) }
  it('검증: 불일치 발문이면 정답 외 4개가 matches 여야 한다', () => {
    expect(FORMAT_SPECS.option_correspondence.validate(body, gold)).toEqual([])
    const bad = { ...gold, options: options.map((o, i) => (i === 0 ? { ...o, verdict: 'distorted' } : o)) }
    expect(FORMAT_SPECS.option_correspondence.validate(body, bad).join()).toMatch(/불일치 발문/)
    expect(FORMAT_SPECS.option_correspondence.validate(body, { ...gold, options: options.map((o, i) => (i === 2 ? { ...o, verdict: 'not_in_text' } : o)) }).join()).toMatch(/대응 문장/)
  })
  it('정답 = 고른 답 + 모든 선지 판정 + 정답 선지 대응 문장', () => {
    expect(g(right)?.grade.isCorrect).toBe(true)
    const oneWrong = { ...right, options: right.options.map((o, i) => (i === 0 ? { ...o, verdict: 'distorted' } : o)) }
    expect(g(oneWrong)?.grade).toMatchObject({ isCorrect: false, choiceOk: true })
    expect(g({ ...right, options: right.options.map((o, i) => (i === 2 ? { ...o, sentence: 5 } : o)) })?.grade).toMatchObject({ isCorrect: false, sentenceOk: false })
  })
  it('판정이 빠지면 형식 밖', () => {
    expect(g({ choice: 2, options: right.options.slice(0, 4) })).toBeNull()
    expect(g({ choice: 2, options: right.options.map((o) => ({ ...o, verdict: 'maybe' })) })).toBeNull()
  })
})

describe('contextual_sense(v.contextual_sense)', () => {
  const body = { format: 'contextual_sense', sentences: ['The firm declined.', 'Its figure was low.', 'x.'], target: { sentence: 1, word: 'figure' }, stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'] }
  const gold = { answer: 3, cue: [0, 1], senseGloss: '수치', distractors: D4(3, 'basic_meaning') }
  const g = (r: unknown) => FORMAT_SPECS.contextual_sense.grade(body, gold, r, 'v1')
  it('검증: 목표 낱말이 그 문장에 없으면 위반', () => {
    expect(FORMAT_SPECS.contextual_sense.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.contextual_sense.validate({ ...body, target: { sentence: 0, word: 'figure' } }, gold)).toContain('목표 낱말이 그 문장에 없다')
  })
  it('정답 = 뜻 ✓ + 근거 문장이 근거 범주 안(하나 이상)', () => {
    expect(g({ choice: 3, cue: [1] })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 3, cue: [2] })?.grade).toMatchObject({ isCorrect: false, cueOk: false })
    expect(g({ choice: 0, cue: [1] })?.grade).toMatchObject({ isCorrect: false, choiceDesign: 'basic_meaning' })
  })
})

describe('sentence_relation(r.relation)', () => {
  const body = { format: 'sentence_relation', sentences: S6, stem: 'q', pairs: [[0, 1], [2, 3]] }
  const gold = { pairs: [{ relation: 'contrast', alt: [], cue: 'However' }, { relation: 'example', alt: ['addition'], cue: '(연결어 없음)' }] }
  const g = (r: unknown) => FORMAT_SPECS.sentence_relation.grade(body, gold, r, 'v1')
  it('검증: 인접하지 않은 쌍 · Gold 쌍 수 불일치는 위반', () => {
    expect(FORMAT_SPECS.sentence_relation.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.sentence_relation.validate({ ...body, pairs: [[0, 2], [2, 3]] }, gold).join()).toMatch(/인접/)
  })
  it('정답 = 모든 쌍 ✓ · 허용된 대체 관계도 인정', () => {
    expect(g({ pairs: ['contrast', 'example'] })?.grade.isCorrect).toBe(true)
    expect(g({ pairs: ['contrast', 'addition'] })?.grade.isCorrect).toBe(true)
    expect(g({ pairs: ['cause_effect', 'example'] })?.grade).toMatchObject({ isCorrect: false, pairOk: [false, true] })
    expect(g({ pairs: ['contrast'] })).toBeNull()
  })
})

describe('form_scope(s.form_scope)', () => {
  const body = { format: 'form_scope', sentences: ['They were running fast.', 'The list of items are long.', 'He enjoys reading.'], stem: 'q',
    marks: [{ sentence: 0, text: 'were' }, { sentence: 0, text: 'running' }, { sentence: 1, text: 'are' }, { sentence: 2, text: 'enjoys' }, { sentence: 2, text: 'reading' }] }
  const gold = { answer: 2, reason: 'agreement', correction: 'is', marks: [0, 1, 2, 3, 4].map(() => ({ reason: 'agreement', why: '규칙에 맞는다' })) }
  const g = (r: unknown) => FORMAT_SPECS.form_scope.grade(body, gold, r, 'v1')
  it('검증: 밑줄이 그 문장에 없으면 위반', () => {
    expect(FORMAT_SPECS.form_scope.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.form_scope.validate({ ...body, marks: body.marks.map((m, i) => (i === 0 ? { ...m, text: 'zzz' } : m)) }, gold).join()).toMatch(/밑줄 0/)
  })
  it('정답 = 틀린 곳 ✓ + 이유 ✓ — 위치만 맞으면 오답(우연 정답 구별)', () => {
    expect(g({ choice: 2, reason: 'agreement' })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 2, reason: 'voice' })?.grade).toMatchObject({ isCorrect: false, choiceOk: true, reasonOk: false })
    expect(g({ choice: 2, reason: 'spelling' })).toBeNull()
  })
})
