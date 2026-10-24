// apps/web/src/lib/csat/content-review/__tests__/candidates.test.ts
import { describe, expect, it } from 'vitest'

import { buildRelations, candidateId, dedupeCandidates } from '../candidates'
import snapshot from '../data/snapshot.json'
import type { ReviewCandidate, RevisionBinding } from '../types'

const B: RevisionBinding = { itemId: '2015#25', itemMd5: 'a'.repeat(32), analysisVersion: 5, analysisMd5: 'b'.repeat(32), lectureVersion: 3, lectureHash: 'c'.repeat(16) }

function cand(over: Partial<ReviewCandidate> = {}): ReviewCandidate {
  const base: Omit<ReviewCandidate, 'id'> = {
    itemId: '2015#25', source: 'C_HANDOFF_30', sourceRef: '#1', defect: 'false_elimination', tracks: ['lecture_cue'],
    binding: B, changes: [{ target: 'cue:c9', current: '현재', proposed: '제안', draftRef: null }],
    officialText: { verdict: 'TEXT_MATCH', note: null }, officialAnswers: [4], officialAnswerBasis: 'db_only',
    aiEvidence: ['XV'], note: null, ...over,
  }
  return { ...base, id: over.id ?? candidateId(base) }
}

describe('candidateId', () => {
  it('같은 내용이면 같은 id, target 순서와 무관', () => {
    const a = cand({ changes: [{ target: 'cue:c1', current: '', proposed: 'x', draftRef: null }, { target: 'cue:c2', current: '', proposed: 'y', draftRef: null }] })
    const b = cand({ changes: [{ target: 'cue:c2', current: '', proposed: 'y', draftRef: null }, { target: 'cue:c1', current: '', proposed: 'x', draftRef: null }] })
    expect(a.id).toBe(b.id)
    expect(a.id).toMatch(/^cr_[0-9a-f]{16}$/)
  })
  it('판본이 바뀌면 id 가 바뀐다 — 옛 판정이 새 판본에 붙지 않는다', () => {
    const a = cand()
    const b = cand({ binding: { ...B, lectureHash: 'd'.repeat(16) } })
    expect(a.id).not.toBe(b.id)
  })
})

describe('buildRelations', () => {
  it('같은 결함·target·판본 = duplicate', () => {
    const a = cand({ source: 'C_HANDOFF_30' })
    const b = cand({ source: 'C_HOLD', id: 'cr_other' })
    expect(buildRelations([a, b]).map((r) => r.kind)).toEqual(['duplicate'])
  })
  it('같은 target 에 다른 제안 = conflict', () => {
    const a = cand()
    const b = cand({ defect: 'false_trap', changes: [{ target: 'cue:c9', current: '현재', proposed: '전혀 다른 문안', draftRef: null }] })
    expect(buildRelations([a, b])[0]!.kind).toBe('conflict')
  })
  it('공식 정답 선지를 오답 소거로 남기는 변경 = conflict(복수정답 2015#25)', () => {
    const a = cand({ officialAnswers: [4, 5], changes: [{ target: 'analysis:reject:5', current: '⑤ 오답', proposed: '⑤ 는 도표와 맞아 오답', draftRef: null }] })
    const rel = buildRelations([a])
    expect(rel).toHaveLength(1)
    expect(rel[0]!.reason).toContain('공식 정답 5')
  })
  it('정답 집합을 단일 숫자로 줄이지 않는다 — ⑤ 를 정답으로 고치는 제안은 충돌 아님', () => {
    const a = cand({ officialAnswers: [4, 5], changes: [{ target: 'analysis:reject:5', current: '', proposed: '⑤ 도 공식 정답', draftRef: null }] })
    expect(buildRelations([a])).toEqual([])
  })
  it('다른 문항끼리는 관계가 없다', () => {
    expect(buildRelations([cand(), cand({ itemId: '2019#29', binding: { ...B, itemId: '2019#29' } })])).toEqual([])
  })
})

describe('dedupeCandidates', () => {
  it('중복은 하나로 합치고 원천·증거를 모은다', () => {
    const a = cand()
    const b = cand({ source: 'C_HOLD', sourceRef: '보류', id: 'cr_b', aiEvidence: ['R3'] })
    const { kept, merged } = dedupeCandidates([a, b])
    expect(kept).toHaveLength(1)
    expect(merged).toEqual([{ into: a.id, from: 'cr_b' }])
    expect(kept[0]!.aiEvidence).toEqual(['XV', 'R3'])
    expect(kept[0]!.sourceRef).toContain('C_HOLD:보류')
  })
  it('입력을 바꾸지 않는다', () => {
    const a = cand()
    dedupeCandidates([a, cand({ id: 'cr_b', aiEvidence: ['R3'] })])
    expect(a.aiEvidence).toEqual(['XV'])
  })
})

describe('snapshot.json', () => {
  const s = snapshot as unknown as { counts: Record<string, number>; candidates: ReviewCandidate[]; currentBindings: Record<string, RevisionBinding>; generatedFrom: { humanApprovals: number } }
  it('원천별 수 — C 30 · 보류 1 · 복수정답 1 · gold 18', () => {
    expect(s.counts).toEqual({ C_HANDOFF_30: 30, C_HOLD: 1, DRAIN_MULTI_ANSWER: 1, E_T0149_GOLD: 18 })
  })
  it('id 는 저장된 내용에서 다시 계산한 값과 같고 유일하다', () => {
    const ids = s.candidates.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of s.candidates) expect(candidateId(c)).toBe(c.id)
  })
  it('모든 후보는 현재 판본에 결속돼 있고 사람 승인은 0', () => {
    for (const c of s.candidates) expect(c.binding).toEqual(s.currentBindings[c.itemId])
    expect(s.generatedFrom.humanApprovals).toBe(0)
  })
  it('2015#25 는 정답 집합 {4,5} · 세 트랙 · 평가원 정답표 근거 · 제안 문안 6 · 사람 승인 없음', () => {
    const c = s.candidates.find((x) => x.itemId === '2015#25')!
    expect(c.officialAnswers).toEqual([4, 5])
    expect(c.tracks).toEqual(['official_answer', 'explanation', 'lecture_cue'])
    // 정정 패키지(docs/csat-learner/content-review/2015-25)에서 보도 근거 → 평가원 정답표 원본으로 올렸다
    expect(c.officialAnswerBasis).toBe('kice_answer_sheet')
    expect(c.changes.filter((ch) => ch.proposed != null)).toHaveLength(6)
    expect(c.note).toMatch(/사람 내용 승인 없음/)
  })
  it('AI 합의는 aiEvidence 로만 남는다(gold 18)', () => {
    const g = s.candidates.filter((x) => x.source === 'E_T0149_GOLD')
    expect(g.every((x) => x.aiEvidence.includes('Claude A + Codex B 교집합') && x.tracks.join() === 'evidence_gold')).toBe(true)
  })
})
