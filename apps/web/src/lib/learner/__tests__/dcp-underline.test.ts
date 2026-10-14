// apps/web/src/lib/learner/__tests__/dcp-underline.test.ts
// v6.2 P-F8d — 밑줄 선택(vocab_choice) 화면 계약: 저장 payload 파싱 · 문장 분할 · 채점 규칙 · 학습자 화면 비노출
import { describe, expect, it } from 'vitest'

import { fixtureItems } from '@/app/dev/vocab-practice/fixtures'

import { isPlayableDcpType } from '../dcp-types'
import { gradeUnderlineChoice, parseUnderlinePayload, splitSentence } from '../dcp-underline'

/** 개발 DB 실측 표본과 같은 모양(문장은 바꿨다) */
const RAW = {
  sentences: ['The US has stood as a reference point.', 'Networks withhold training and supplies.', 'Extensive evidence supports it.', 'Now these services will take on a new level.', 'Instead of relying on the process, they act.'],
  underlines: [
    { word: 'stood', label: '①', sentenceIdx: 0 },
    { word: 'withhold', label: '②', sentenceIdx: 1 },
    { word: 'Extensive', label: '③', sentenceIdx: 2 },
    { word: 'services', label: '④', sentenceIdx: 3 },
    { word: 'relying', label: '⑤', sentenceIdx: 4 },
  ],
}

describe('parseUnderlinePayload', () => {
  it('실측 모양을 받는다 · 묻는 말을 붙인다', () => {
    const p = parseUnderlinePayload('vocab_choice', RAW)!
    expect(p.underlines.map((u) => u.word)).toEqual(['stood', 'withhold', 'Extensive', 'services', 'relying'])
    expect(p.stemKo).toMatch(/적절하지 않은/)
  })
  it('성립하지 않는 문항은 null — 밑줄 4개 · 라벨 순서 · 문장 범위 밖 · 문장에 없는 낱말 · 다른 유형', () => {
    expect(parseUnderlinePayload('vocab_choice', { ...RAW, underlines: RAW.underlines.slice(0, 4) })).toBeNull()
    expect(parseUnderlinePayload('vocab_choice', { ...RAW, underlines: [RAW.underlines[1], RAW.underlines[0], ...RAW.underlines.slice(2)] })).toBeNull()
    expect(parseUnderlinePayload('vocab_choice', { ...RAW, underlines: [{ ...RAW.underlines[0]!, sentenceIdx: 9 }, ...RAW.underlines.slice(1)] })).toBeNull()
    expect(parseUnderlinePayload('vocab_choice', { ...RAW, underlines: [{ ...RAW.underlines[0]!, word: 'absent' }, ...RAW.underlines.slice(1)] })).toBeNull()
    expect(parseUnderlinePayload('grammar_choice', RAW)).toBeNull()
  })
})

describe('splitSentence', () => {
  it('밑줄 낱말만 표시하고 구두점은 밖에 둔다 · 원문 글자를 잃지 않는다', () => {
    const p = parseUnderlinePayload('vocab_choice', RAW)!
    const parts = splitSentence(RAW.sentences[2]!, [p.underlines[2]!])
    expect(parts.filter((x) => x.mark).map((x) => x.text)).toEqual(['Extensive'])
    expect(parts.map((x) => x.text).join('')).toBe(RAW.sentences[2])
    const s4 = splitSentence(RAW.sentences[4]!, [p.underlines[4]!])
    expect(s4.map((x) => x.text).join('')).toBe(RAW.sentences[4])
  })
})

describe('gradeUnderlineChoice · 노출 범위', () => {
  it('고른 번호 = position · 범위 밖은 예외', () => {
    expect(gradeUnderlineChoice({ position: 2 }, { choice: 2 })).toBe(true)
    expect(gradeUnderlineChoice({ position: 2 }, { choice: 3 })).toBe(false)
    expect(() => gradeUnderlineChoice({ position: 2 }, { choice: 0 })).toThrow(/Bad choice/)
  })
  it('vocab_choice 는 아직 학습자 재생 유형이 아니다(DB 채점 확장 승인 전)', () => {
    expect(isPlayableDcpType('vocab_choice')).toBe(false)
  })
  it('격리 화면 합성 문항은 모두 파서를 통과한다', () => {
    expect(fixtureItems()).toHaveLength(2)
  })
})
