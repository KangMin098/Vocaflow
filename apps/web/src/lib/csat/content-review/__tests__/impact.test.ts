// apps/web/src/lib/csat/content-review/__tests__/impact.test.ts
//
// **F4 수정 영향 검사 계약** — 실제 2015#25 강의(v3 · cue 12)와 공개 경계(stopBefore=3)로
// cue 수정이 판본 · 공개 경계 · 원문 이해 sidecar · 분석 revision 에 미치는 영향을 본다.

import { describe, expect, it } from 'vitest'

import exam2015 from '../../lecture-data/2015.json'
import type { Lecture } from '../../lecture/types'
import { analyzeImpact, type ImpactInput } from '../impact'

const base = (exam2015 as unknown as { lectures: Record<string, Lecture> }).lectures["2015#25"]!
// feat/lecture-learner-control disclosure-data.json 2015#25 (F3 문서 §4)
const disclosure = { version: base.version, cues: base.cues.length, stopBefore: 3 }
const ms = { analysisVersion: 5, unitsHash: 'u', basePublicHash: 'p' }

const edit = (id: string, text: string, bump = 1): Lecture => ({
  ...base,
  version: base.version + bump,
  cues: base.cues.map((c) => (c.id === id ? { ...c, segments: [{ lang: 'ko-KR', text }] } : c)),
})
const run = (after: Lecture, extra: Partial<ImpactInput> = {}) =>
  analyzeImpact({ before: base, after, passageSentenceCount: 6, disclosure, meaningSupport: ms, analysisVersionBefore: 5, ...extra })
const codes = (r: ReturnType<typeof analyzeImpact>) => r.findings.map((f) => f.code)

describe('2015#25 cue 수정 영향', () => {
  it('변경 없음이면 아무것도 무효가 아니다', () => {
    const r = run(base)
    expect(r.ok).toBe(true)
    expect(r.lectureVersionBumpRequired).toBe(false)
    expect(r.disclosureInvalidated).toBe(false)
  })

  it('경계 뒤 c9 수정 — 판본 bump 필요, 경계는 유지', () => {
    const r = run(edit('c9', '오 번도 정답입니다. 퍼센트와 퍼센트 포인트는 달라요.'))
    expect(r.changedCues).toEqual(['c9'])
    expect(r.lectureVersionBumpRequired).toBe(true)
    expect(r.disclosureInvalidated).toBe(false)
    expect(r.ok).toBe(true)
  })

  it('version 을 안 올리면 BLOCK', () => {
    expect(codes(run(edit('c9', '바뀜', 0)))).toContain('VERSION_NOT_BUMPED')
  })

  it('경계 앞 c1 수정 → 경계 재판정, 정답을 말하게 바꾸면 BLOCK', () => {
    const soft = run(edit('c1', '도표와 맞지 않는 진술을 고르세요.'))
    expect(soft.disclosureInvalidated).toBe(true)
    expect(codes(soft)).toContain('CHANGED_BEFORE_BOUNDARY')
    expect(soft.ok).toBe(true)
    const leak = run(edit('c1', '사 번이 정답입니다.'))
    expect(codes(leak)).toContain('REVEAL_BEFORE_BOUNDARY')
    expect(leak.ok).toBe(false)
  })

  it('cue 추가 · 삭제 · 순서 변경은 경계 index 를 밀어 BLOCK', () => {
    const removed: Lecture = { ...base, version: base.version + 1, cues: base.cues.filter((c) => c.id !== 'c10') }
    expect(codes(run(removed))).toContain('DISCLOSURE_INDEX_SHIFT')
    const swapped: Lecture = { ...base, version: base.version + 1, cues: [base.cues[1]!, base.cues[0]!, ...base.cues.slice(2)] }
    const r = run(swapped)
    expect(r.orderChanged).toBe(true)
    expect(r.disclosureInvalidated).toBe(true)
  })

  it('앵커가 지문 문장 밖이면 BLOCK, 문장 수를 모르면 REVIEW', () => {
    const out: Lecture = { ...base, version: base.version + 1, cues: base.cues.map((c) => (c.id === 'c4' ? { ...c, target: { kind: 'anchor', id: 'sentence:9' } } : c)) }
    expect(codes(run(out))).toContain('ANCHOR_OUT_OF_RANGE')
    const unknown = run(out, { passageSentenceCount: null })
    expect(codes(unknown)).toContain('ANCHOR_UNVERIFIED')
  })

  it('분석을 고치면 새 revision 필요 · 원문 이해 sidecar stale', () => {
    const same = run(base, { analysisChanged: true, analysisVersionAfter: 5 })
    expect(codes(same)).toContain('ANALYSIS_REVISION_NOT_BUMPED')
    const bumped = run(base, { analysisChanged: true, analysisVersionAfter: 6 })
    expect(bumped.analysisRevisionBumpRequired).toBe(true)
    expect(bumped.meaningSupportInvalidated).toBe(true)
    expect(codes(bumped)).toContain('MEANING_SUPPORT_STALE')
  })
})
