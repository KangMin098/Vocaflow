// apps/web/src/lib/knowledge/__tests__/contextual-sense.test.ts
//
// LM-G1.5a — V2 문맥 의미 선택 instrument 계약 · 반례(순수 · 합성 주석). 실제 기출 원문은 쓰지 않는다.

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

describe('LM-G1.5a V2 contextual-sense', () => {
  it('V01 · B 판별과 D 뜻을 모두 맞혀야 조건 성공 — 낱말 하나 찍기(판별만)는 성공이 아님', () => {
    expect(go(ann(), { misfit: 3, sense: 0, cue: [4] })).toEqual({ misfitOk: true, senseOk: true, cueOk: true, isCorrect: true })
    expect(go(ann(), { misfit: 3, sense: 1, cue: [4] })!.isCorrect).toBe(false)
  })
  it('V02 · 엉뚱한 자리를 고르면 고른 뜻이 우연히 정답 번호여도 뜻 판단은 실패', () => {
    const g = go(ann(), { misfit: 0, sense: 0, cue: [] })!
    expect(g.misfitOk).toBe(false)
    expect(g.senseOk).toBe(false)
  })
  it('V03 · 뜻은 맞혔지만 근거 문장이 틀림 → 정오는 성공 · 근거는 따로 실패(합치지 않음)', () => {
    const g = go(ann(), { misfit: 3, sense: 0, cue: [0] })!
    expect(g.isCorrect).toBe(true)
    expect(g.cueOk).toBe(false)
  })
  it('V03b · 검수되지 않은 근거는 채점하지 않음(null) · 자유 설명은 받지 않음', () => {
    const a = ann({ cue: { sentences: [4], accepted: [], reviewed: false } })
    expect(go(a, { misfit: 3, sense: 0, cue: [0] })!.cueOk).toBeNull()
    expect(contextualSensePanel(a).cueGraded).toBe(false)
  })
  it('V04 · 오답 뜻마다 배제 이유가 없으면 주석 무효', () => {
    expect(validAnnotation(ann({ sense: { options: ['a', 'b', 'c'], correct: 0, rejectWhy: { '1': '이유' } } }))).toBe(false)
    expect(validAnnotation(ann())).toBe(true)
  })
  it('V07 · 화면 모양에 정답 · 배제 이유 · 근거 문장이 없음', () => {
    const p = JSON.stringify(contextualSensePanel(ann()))
    expect(p).not.toMatch(/misfit|correct|rejectWhy|cue"|"sentences"|뒤 문장이 감소/)
    expect(Object.keys(contextualSensePanel(ann())).sort()).toEqual(['cueGraded', 'senseOptions', 'sentenceCount', 'targets'])
  })
  it('V05 · 주석 내용이 바뀌면 해시가 달라짐(content_hash STALE 의 근거)', () => {
    expect(contextualSenseHash(ann())).not.toBe(contextualSenseHash(ann({ sense: { ...ann().sense, correct: 1, rejectWhy: { '0': 'x', '2': 'y' } } })))
  })
  it('V13 · 잘못된 입력은 채점하지 않음(범위 밖 · 중복 근거 · 형식)', () => {
    const a = ann()
    for (const raw of [null, {}, { misfit: 5, sense: 0 }, { misfit: 3, sense: 3 }, { misfit: 3, sense: 0, cue: [8] }, { misfit: 3, sense: 0, cue: [1, 1] }, { misfit: '3', sense: 0 }]) expect(parseContextualSense(raw, a)).toBeNull()
    expect(parseContextualSense({ misfit: 3, sense: 0, cue: [6, 4] }, a)).toEqual({ misfit: 3, sense: 0, cue: [4, 6] })
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
