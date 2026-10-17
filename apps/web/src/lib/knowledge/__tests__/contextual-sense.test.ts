// apps/web/src/lib/knowledge/__tests__/contextual-sense.test.ts
//
// LM-G1.5a — V2 문맥 의미 선택 instrument 계약 · 반례(순수 · 합성 주석). 실제 기출 원문은 쓰지 않는다.
// F1 수정(V2-F1): 기록 = B(+C) 첫 제출 · 뜻(D)은 B 를 맞힌 채점 응답의 지도 연습 · 제출 전 화면 모양에 뜻 선택지 없음.

import { describe, expect, it } from 'vitest'

import {
  contextualSenseHash,
  contextualSensePanel,
  gradeContextualSense,
  parseContextualSense,
  releasable,
  validAnnotation,
  type ContextualSenseAnnotation,
} from '../contextual-sense'
import { contextualSenseAnnotationCount, contextualSenseAnnotationFor } from '../contextual-sense-annotations'

const ann = (o: Partial<ContextualSenseAnnotation> = {}): ContextualSenseAnnotation => ({
  version: 'contextual-sense-test.v1',
  itemId: 'T#30',
  skeletonSig: 'sig',
  sentenceCount: 8,
  sourceRevision: 'a'.repeat(64),
  officialAnswer: 4,
  markerStyle: 'circled',
  construct: 'lexical_sense',
  targets: [1, 2, 3, 5, 6],
  misfit: 3,
  sense: { options: ['줄어든', '늘어난', '그대로인'], correct: 0, rejectWhy: { '1': '뒤 문장이 감소를 말한다', '2': '변화를 말하는 흐름과 어긋난다' } },
  cue: { sentences: [4], accepted: [6], reviewed: true },
  review: { status: 'accepted', annotator: 'claude', independentReviewer: 'codex', reviewerBlind: true, agreement: '3/3', reviewedAt: '2026-10-17' },
  ...o,
})
const go = (a: ContextualSenseAnnotation, raw: unknown) => {
  const r = parseContextualSense(raw, a)
  return r ? gradeContextualSense(a, r) : null
}

describe('LM-G1.5a V2 contextual-sense — F1 분리 계약', () => {
  it('F1 · 제출 전 화면 모양에 뜻 선택지 · 정답 · 배제 이유 · 근거가 없다(서버 props 단계)', () => {
    const p = contextualSensePanel(ann())
    expect(Object.keys(p).sort()).toEqual(['cueGraded', 'markers', 'sentenceCount', 'targets'])
    expect(JSON.stringify(p)).not.toMatch(/줄어든|늘어난|그대로인|misfit|correct|rejectWhy|"sentences"|뒤 문장이 감소/)
  })
  it('F1 · 첫 제출에 뜻(sense)을 섞어 보내면 거절 — 선택지를 미리 본 기록이 섞이지 않는다', () => {
    expect(parseContextualSense({ misfit: 3, sense: 0, cue: [4] }, ann())).toBeNull()
    expect(parseContextualSense({ misfit: 3, cue: [6, 4] }, ann())).toEqual({ misfit: 3, cue: [4, 6] })
  })
  it('V01 · 정오는 B 판별만 · 맞혔을 때만 뜻 연습(followUp)이 온다', () => {
    expect(go(ann(), { misfit: 3, cue: [4] })).toEqual({ misfitOk: true, cueOk: true, isCorrect: true, followUp: { senseOptions: ['줄어든', '늘어난', '그대로인'], senseCorrect: 0 } })
  })
  it('V02 · B 를 틀리면 뜻 선택지를 내려주지 않는다(선택지가 B 정답을 알려 주므로 · F1)', () => {
    const g = go(ann(), { misfit: 0, cue: [] })!
    expect(g).toMatchObject({ misfitOk: false, isCorrect: false, followUp: null })
    expect(JSON.stringify(g)).not.toMatch(/줄어든|늘어난/)
  })
  it('V03 · B 는 맞혔지만 근거 문장이 틀림 → 정오 성공 · 근거는 따로 실패', () => {
    const g = go(ann(), { misfit: 3, cue: [0] })!
    expect(g.isCorrect).toBe(true)
    expect(g.cueOk).toBe(false)
  })
  it('V03b · 검수되지 않은 근거는 채점하지 않음(null)', () => {
    const a = ann({ cue: { sentences: [4], accepted: [], reviewed: false } })
    expect(go(a, { misfit: 3, cue: [0] })!.cueOk).toBeNull()
    expect(contextualSensePanel(a).cueGraded).toBe(false)
  })
  it('V04 · 오답 뜻마다 배제 이유가 없으면 주석 무효', () => {
    expect(validAnnotation(ann({ sense: { options: ['a', 'b', 'c'], correct: 0, rejectWhy: { '1': '이유' } } }))).toBe(false)
    expect(validAnnotation(ann())).toBe(true)
  })
  it('V05 · 주석 내용이 바뀌면 해시가 달라짐(content_hash STALE 의 근거)', () => {
    expect(contextualSenseHash(ann())).not.toBe(contextualSenseHash(ann({ sense: { ...ann().sense, correct: 1, rejectWhy: { '0': 'x', '2': 'y' } } })))
    expect(contextualSenseHash(ann())).not.toBe(contextualSenseHash(ann({ markerStyle: 'letter' })))
  })
  it('V13 · 잘못된 입력은 채점하지 않음(범위 밖 · 중복 근거 · 형식)', () => {
    const a = ann()
    for (const raw of [null, {}, { misfit: 5 }, { misfit: 3, cue: [8] }, { misfit: 3, cue: [1, 1] }, { misfit: '3' }, { misfit: 3, cue: 'x' }]) expect(parseContextualSense(raw, a)).toBeNull()
  })
  it('F5 · 밑줄 표지 — R-VOCAB ①~⑤ · X-VOCAB (a)~(e) · 미지정은 출시 자격 없음', () => {
    expect(contextualSensePanel(ann()).markers).toEqual(['①', '②', '③', '④', '⑤'])
    expect(contextualSensePanel(ann({ markerStyle: 'letter' })).markers).toEqual(['(a)', '(b)', '(c)', '(d)', '(e)'])
    expect(releasable(ann({ markerStyle: undefined }))).toBe(false)
    expect(validAnnotation({ ...ann(), markerStyle: 'roman' })).toBe(false)
  })
  it('F6 · 문장 논리로 풀리는 문항(sentence_logic) · 미분류는 V2 근거로 출시하지 않음', () => {
    expect(releasable(ann({ construct: 'sentence_logic' }))).toBe(false)
    expect(releasable(ann({ construct: undefined }))).toBe(false)
    expect(validAnnotation(ann({ construct: 'sentence_logic' }))).toBe(true)
  })
  it('V15 · 합의 전(draft · 맹검 아님 · 검수자 없음 · 거절) 주석은 노출 자격 없음', () => {
    expect(releasable(ann())).toBe(true)
    expect(releasable(ann({ review: { ...ann().review, status: 'draft' } }))).toBe(false)
    expect(releasable(ann({ review: { ...ann().review, reviewerBlind: false } }))).toBe(false)
    expect(releasable(ann({ review: { ...ann().review, independentReviewer: null } }))).toBe(false)
    expect(releasable(ann({ review: { ...ann().review, status: 'rejected' } }))).toBe(false)
  })
  it('주석 모양 경계 — 밑줄 5개 · 문장 범위 · 뜻 중복 · 검수된 근거는 비어 있지 않음', () => {
    expect(validAnnotation(ann({ targets: [1, 2, 3, 5] }))).toBe(false)
    expect(validAnnotation(ann({ targets: [1, 2, 3, 5, 8] }))).toBe(false)
    expect(validAnnotation(ann({ sense: { options: ['a', 'a'], correct: 0, rejectWhy: { '1': 'x' } } }))).toBe(false)
    expect(validAnnotation(ann({ cue: { sentences: [], accepted: [], reviewed: true } }))).toBe(false)
    expect(validAnnotation(ann({ misfit: 5 }))).toBe(false)
  })
  it('V18 · 지금 합의 주석 0개 → 어떤 문항에도 과제가 없다', () => {
    expect(contextualSenseAnnotationCount()).toBe(0)
    expect(contextualSenseAnnotationFor('M2609#30')).toBeNull()
  })
})
