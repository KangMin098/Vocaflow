// apps/web/src/lib/knowledge/__tests__/authored-formats.test.ts
// FINAL §5 — 과제 형식별 채점 계약. 형식마다 「무엇이 맞아야 정답인가」와 우연 정답 · 형식 밖 응답 처리를 본다.
import fs from 'node:fs'
import path from 'node:path'

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

describe('discourse_roles(r.discourse_function · r.discourse_structure)', () => {
  const body = { format: 'discourse_roles', sentences: ['a.', 'b.', 'c.', 'd.'], stem: 'q' }
  const gold = { roles: ['background', 'topic', 'support', 'conclusion'], alternatives: [{ index: 3, role: 'topic' }], pattern: 'general_specific', rationale: '2번이 주제문이고 나머지가 받친다' }
  const g = (r: unknown) => FORMAT_SPECS.discourse_roles.grade(body, gold, r, 'v1')
  it('검증: 문장 수와 역할 수가 다르면 위반', () => {
    expect(FORMAT_SPECS.discourse_roles.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.discourse_roles.validate(body, { ...gold, roles: gold.roles.slice(1) })).toContain('문장 수만큼 역할')
  })
  it('정답 = 역할 전부(허용 대안 포함) + 패턴', () => {
    expect(g({ roles: gold.roles, pattern: 'general_specific' })?.grade.isCorrect).toBe(true)
    expect(g({ roles: ['background', 'topic', 'support', 'topic'], pattern: 'general_specific' })?.grade.isCorrect).toBe(true)
    expect(g({ roles: gold.roles, pattern: 'contrast' })?.grade.isCorrect).toBe(false)
    expect(g({ roles: gold.roles.slice(1), pattern: 'contrast' })).toBeNull()
  })
})

describe('demand_choice(e.task_demand)', () => {
  const body = { format: 'demand_choice', sentences: S6, stem: 'q', taskStem: '다음 글의 제목으로 가장 적절한 것은?', choices: ['a', 'b', 'c', 'd', 'e'] }
  const gold = { answer: 1, rationale: '글 전체 중심을 압축한 표현을 고르라는 요구다', distractors: D4(1, 'detail_focus') }
  it('검증 · 채점(오답은 착오 유형 반환)', () => {
    expect(FORMAT_SPECS.demand_choice.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.demand_choice.validate({ ...body, taskStem: '' }, gold)).toContain('분석할 발문(taskStem)')
    expect(FORMAT_SPECS.demand_choice.grade(body, gold, { choice: 1 }, 'v1')?.grade.isCorrect).toBe(true)
    expect(FORMAT_SPECS.demand_choice.grade(body, gold, { choice: 0 }, 'v1')?.grade).toMatchObject({ isCorrect: false, choiceDesign: 'detail_focus' })
  })
})

describe('segment_choice(s.sentence_core 등)', () => {
  const body = { format: 'segment_choice', sentences: ['x.', 'The idea that most people accept is often wrong.'], stem: 'q', focus: { sentence: 1 }, ask: 'verb',
    segments: ['The idea', 'that most people accept', 'is', 'often wrong.'] }
  const gold = { answer: 2, reason: 'main_verb', why: '관계절 accept 가 아니라 is 가 본동사다', segments: [{ reason: 'main_subject', why: '주어 핵' }, { reason: 'modifies_noun', why: 'idea 를 꾸민다' }, { reason: 'main_verb', why: '본동사' }, { reason: 'complement', why: '보어' }] }
  const g = (r: unknown) => FORMAT_SPECS.segment_choice.grade(body, gold, r, 'v1')
  it('검증: 덩어리가 문장에 순서대로 없으면 위반', () => {
    expect(FORMAT_SPECS.segment_choice.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.segment_choice.validate({ ...body, segments: ['is', 'The idea', 'that most people accept'] }, { ...gold, segments: gold.segments.slice(0, 3) }).join()).toMatch(/순서대로/)
  })
  it('정답 = 덩어리 ✓ + 이유 ✓ — 덩어리만 맞으면 오답', () => {
    expect(g({ choice: 2, reason: 'main_verb' })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 2, reason: 'object' })?.grade).toMatchObject({ isCorrect: false, choiceOk: true })
    expect(g({ choice: 9, reason: 'main_verb' })).toBeNull()
  })
})

describe('equivalence(v.semantic_relation)', () => {
  const body = { format: 'equivalence', sentences: ['They purchased a car.', 'The vehicle was new.'], stem: 'q', pair: { a: { sentence: 0, text: 'car' }, b: { sentence: 1, text: 'vehicle' } } }
  const gold = { same: false, relation: 'hypernym', cue: [0, 1], why: 'vehicle 은 car 를 포함하는 넓은 말' }
  it('검증: 같음 여부와 관계 모순 · 표현이 문장에 없으면 위반', () => {
    expect(FORMAT_SPECS.equivalence.validate(body, gold)).toEqual([])
    expect(FORMAT_SPECS.equivalence.validate(body, { ...gold, same: true })).toContain('같음 여부와 관계가 어긋난다')
    expect(FORMAT_SPECS.equivalence.validate({ ...body, pair: { ...body.pair, b: { sentence: 0, text: 'vehicle' } } }, gold).join()).toMatch(/표현 b/)
  })
  it('정답 = 같음 여부 ✓ + 관계 ✓', () => {
    expect(FORMAT_SPECS.equivalence.grade(body, gold, { same: false, relation: 'hypernym' }, 'v1')?.grade.isCorrect).toBe(true)
    expect(FORMAT_SPECS.equivalence.grade(body, gold, { same: false, relation: 'antonym' }, 'v1')?.grade.isCorrect).toBe(false)
    expect(FORMAT_SPECS.equivalence.grade(body, gold, { same: 'no', relation: 'antonym' }, 'v1')).toBeNull()
  })
})

describe('FI-012(#305) — 동등한 대체 결정 근거', () => {
  // Codex 반례: 1 「closes at six」 · 2 「closing time is 6 p.m.」 · 3 무관. 1·2 는 같은 사실을 따로 진술한다
  const body = { format: 'choice_evidence', sentences: ['The reading room closes at six in the evening.', 'Its closing time is 6 p.m.', 'Books can be returned in a box.'], stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'] }
  const gold = { answer: 1, decisive: 0, evidence: [0], evidenceAlt: [1], decisiveAlt: [[1]], rationale: '1번과 2번이 각각 닫는 시간을 직접 진술한다', distractors: D4(1) }
  const g = (r: unknown) => FORMAT_SPECS.choice_evidence.grade(body, gold, r, 'v1')
  it('대체 결정 근거만 골라도 정답 · 대표 근거만 · 둘 다도 정답', () => {
    expect(FORMAT_SPECS.choice_evidence.validate(body, gold)).toEqual([])
    expect(g({ choice: 1, evidence: [1] })?.grade).toMatchObject({ isCorrect: true, decisiveOk: true })
    expect(g({ choice: 1, evidence: [0] })?.grade.isCorrect).toBe(true)
    expect(g({ choice: 1, evidence: [0, 1] })?.grade.isCorrect).toBe(true)
  })
  it('Gold 에 대체 집합이 없으면 보조 단서만 고른 응답은 계속 오답(완화 아님)', () => {
    const noAlt = { ...gold, decisiveAlt: undefined }
    expect(FORMAT_SPECS.choice_evidence.grade(body, noAlt, { choice: 1, evidence: [1] }, 'v1')?.grade).toMatchObject({ isCorrect: false, decisiveOk: false })
  })
  it('여러 문장이 함께 필요한 대체 집합은 일부만 고르면 오답 · 범주 밖 대체 집합은 검증 위반', () => {
    const multi = { ...gold, evidenceAlt: [1, 2], decisiveAlt: [[1, 2]] }
    expect(FORMAT_SPECS.choice_evidence.grade(body, multi, { choice: 1, evidence: [1] }, 'v1')?.grade.isCorrect).toBe(false)
    expect(FORMAT_SPECS.choice_evidence.grade(body, multi, { choice: 1, evidence: [1, 2] }, 'v1')?.grade.isCorrect).toBe(true)
    expect(FORMAT_SPECS.choice_evidence.validate(body, { ...gold, evidenceAlt: [], decisiveAlt: [[2]] }).join()).toMatch(/대체 결정 근거/)
  })
})

// FI-014(#307) — segment_choice 문항별 대체 이유(reasonAlternatives): Gold 에 명시된 것만 함께 인정 · 덩어리는 여전히 정확해야 한다
describe('segment_choice — 문항별 대체 이유', () => {
  const SET = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../authored/s-chunk-boundary.v1.json'), 'utf8')) as { items: { id: string; body: Record<string, unknown>; gold: Record<string, unknown> }[] }
  const item = (id: string) => SET.items.find((i) => i.id === id)!
  const grade = (id: string, r: unknown) => FORMAT_SPECS.segment_choice.grade(item(id).body, item(id).gold, r, 'v1')
  it('cb-ind-2: 정답 덩어리 + 문장의 주어(main_subject) = 정답 · Gold 이유(phrase_boundary)도 정답', () => {
    expect(grade('cb-ind-2', { choice: 0, reason: 'main_subject' })?.grade.isCorrect).toBe(true)
    expect(grade('cb-ind-2', { choice: 0, reason: 'phrase_boundary' })?.grade.isCorrect).toBe(true)
  })
  it('cb-guided-1: 정답 덩어리 + 문장의 본동사(main_verb) = 정답', () => {
    expect(grade('cb-guided-1', { choice: 2, reason: 'main_verb' })?.grade.isCorrect).toBe(true)
  })
  it('대체 이유가 있어도 틀린 덩어리 · 무관한 이유는 오답', () => {
    expect(grade('cb-ind-2', { choice: 1, reason: 'main_subject' })?.grade.isCorrect).toBe(false)
    expect(grade('cb-ind-2', { choice: 0, reason: 'inverted_order' })?.grade).toMatchObject({ choiceOk: true, reasonOk: false, isCorrect: false })
  })
  it('잘못된 대체 이유 정의는 검증 · 채점에서 거절(빈 배열 · Gold 이유 중복 · 짧은 설명 · 모르는 이유)', () => {
    const it0 = item('cb-ind-2')
    for (const bad of [[], [{ reason: 'phrase_boundary', why: '같은 이유를 대체로 둔 경우' }], [{ reason: 'main_subject', why: '짧음' }], [{ reason: 'nope', why: '모르는 이유 범주라서 거절' }]]) {
      const g = { ...it0.gold, reasonAlternatives: bad }
      expect(FORMAT_SPECS.segment_choice.validate(it0.body, g)).toContain('문항별 대체 이유와 설명')
      expect(FORMAT_SPECS.segment_choice.grade(it0.body, g, { choice: 0, reason: 'main_subject' }, 'v1')).toBeNull()
    }
  })
  it('대체 이유는 채점 뒤 공개(reveal)에만 — 풀기 전 학습자 본문에는 없다', () => {
    expect(FORMAT_SPECS.segment_choice.reveal(item('cb-ind-2').gold)).toHaveProperty('reasonAlternatives')
    expect(JSON.stringify(item('cb-ind-2').body)).not.toContain('reasonAlternatives')
  })
})
