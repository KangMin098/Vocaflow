// apps/web/src/lib/csat/__tests__/design.test.ts
import { describe, expect, it } from 'vitest'

import { parseDesign, topicQuestion, topicSentences, type PassageDesign } from '../design'
import { grade } from '../reveal-gate'

const blank: PassageDesign = {
  roles: ['background', 'topic', 'support', 'example', 'conclusion'],
  alternatives: [{ index: 4, role: 'topic' }],
  pattern: 'myth_rebuttal',
  selection: '지문을 고른 이유',
  transform: 'abstraction',
  transform_note: '정답 표현 변환 설명',
  cues: [],
}
const letter: PassageDesign = { ...blank, roles: ['background', 'support', 'speech_act', 'closing'], alternatives: [], pattern: 'request_letter', transform: 'speech_act_verb' }
const order: PassageDesign = { ...blank, transform: 'none', cues: ['pronoun', 'connective'] }

describe('설계 주석 — 주제문', () => {
  it('topic 역할과 허용 대안을 모두 정답으로 본다', () => {
    expect(topicSentences(blank)).toEqual([1, 4])
  })
  it('주제문이 없는 화행 글은 화행 문장을 묻는다', () => {
    expect(topicSentences(letter)).toEqual([2])
    expect(topicQuestion(letter)).toContain('글쓴이가 하려는 일')
  })
})

describe('설계 주석 — 채점', () => {
  const key = { answer: 3, evidence: [1], design: blank }
  it('주제문 · 뼈대 · 변환을 따로 채점한다', () => {
    const r = grade({ sentence: 1, choice: 3, confidence: 3, topic: 4, pattern: 'contrast', transform: 'abstraction' }, key)
    expect(r).toMatchObject({ topicHit: true, patternHit: false, transformHit: true })
  })
  it('고르지 않은 칸은 틀림으로 세지 않는다(null)', () => {
    const r = grade({ sentence: 1, choice: 3, confidence: 3, topic: null, pattern: null, transform: null }, key)
    expect(r).toMatchObject({ topicHit: null, patternHit: null, transformHit: null })
  })
  it('변환이 없는 유형(순서)은 변환을 채점하지 않는다', () => {
    expect(grade({ sentence: 1, choice: 3, confidence: 3, transform: 'paraphrase' }, { ...key, design: order }).transformHit).toBeNull()
  })
  it('설계 칸이 틀려도 확신 과잉 경고에는 넣지 않는다 — 경고는 근거 · 정답 기준', () => {
    expect(grade({ sentence: 1, choice: 3, confidence: 5, pattern: 'contrast' }, key).overconfident).toBe(false)
  })
})

describe('설계 주석 — jsonb 읽기', () => {
  it('모양이 어긋나면 null — 주석 없는 문항처럼 동작한다', () => {
    expect(parseDesign(null)).toBeNull()
    expect(parseDesign({ roles: 'x' })).toBeNull()
    expect(parseDesign({ roles: ['topic'], pattern: 'contrast', transform: 'none' })).toMatchObject({ alternatives: [], cues: [], selection: '' })
  })
})
