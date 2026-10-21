// apps/web/src/lib/csat/map/v62/__tests__/learning-notes.test.ts
// T-0071 — 노트 ↔ TASK 납품의 정확한 결속(ref + deliveryId + 교수 역할) · 처음/고친 계보 · 확인 못 함 ≠ 빈 목록
import { describe, expect, it } from 'vitest'

import type { ReasoningNote } from '@/lib/csat/dissect'

import { notesForTask, notesFromStateResponse } from '../learning-notes'

const note = (id: string, o: Partial<ReasoningNote> = {}): ReasoningNote => ({
  id, item: 'authored:opt-guided-1', pairIds: [], binding: { analysisVersion: null }, statement: `s-${id}`, grounds: 'g', applicability: 'a', limit: 'l', evidence: [],
  afterExplanation: true, comparedWithModel: false, authored: { deliveryId: 'D1', annotationHash: 'h' }, at: 1, updatedAt: 1, ...o,
})
const rows = [
  { ref: 'authored:opt-guided-1', deliveryId: 'D1', role: 'guided_practice', current: true },
  { ref: 'authored:opt-ind-1', deliveryId: 'D2', role: 'independent_check', current: true },
]

describe('notesForTask', () => {
  it('정확히 결속된 교수 납품 노트만 · 처음 → 고친 순 계보', () => {
    const g = notesForTask([note('n1', { at: 1 }), note('n2', { at: 2, revisionOf: 'n1' }), note('n3', { at: 3, revisionOf: 'n2' })], rows)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ role: 'guided_practice', deliveryId: 'D1', current: true })
    expect(g[0].chains.map((c) => c.map((n) => [n.id, n.revision]))).toEqual([[['n1', false], ['n2', true], ['n3', true]]])
  })
  it('다른 납품 id · 다른 문항 · 결속 없음(기출 노트) · 평가 역할 납품은 잇지 않는다', () => {
    const g = notesForTask([
      note('x1', { authored: { deliveryId: 'OTHER', annotationHash: 'h' } }),
      note('x2', { item: 'authored:opt-guided-2' }),
      note('x3', { authored: undefined }),
      note('x4', { item: 'authored:opt-ind-1', authored: { deliveryId: 'D2', annotationHash: 'h' } }),
    ], rows)
    expect(g).toEqual([])
  })
  it('고친 노트만 이 납품에 결속돼도 처음 노트를 계보 기준으로 쓴다(다른 납품 노트는 보이지 않음)', () => {
    const g = notesForTask([note('r1', { at: 1, authored: { deliveryId: 'OLD', annotationHash: 'h' } }), note('r2', { at: 2, revisionOf: 'r1' })], rows)
    expect(g[0].chains).toEqual([[expect.objectContaining({ id: 'r2', revision: true })]])
  })
  it('노트가 없으면 빈 목록(성공)', () => {
    expect(notesForTask([], rows)).toEqual([])
    expect(notesForTask(undefined, rows)).toEqual([])
  })
})

describe('notesFromStateResponse — 확인 못 함 ≠ 빈 목록', () => {
  it('200 + 노트', () => expect(notesFromStateResponse(200, { ok: true, record: { reasoningNotes: [note('n1')] } })).toMatchObject({ ok: true, notes: [{ id: 'n1' }] }))
  it('200 + 기록 없음 = 빈 목록(성공)', () => expect(notesFromStateResponse(200, { ok: true, record: null })).toEqual({ ok: true, notes: [] }))
  it('401 · 423(보류 판정) · 503 · 모양 이상 = 확인 못 함', () => {
    expect(notesFromStateResponse(401, { ok: false })).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(notesFromStateResponse(423, null)).toEqual({ ok: false, reason: 'held' })
    expect(notesFromStateResponse(503, { ok: false })).toEqual({ ok: false, reason: 'error' })
    expect(notesFromStateResponse(200, { ok: true, record: { reasoningNotes: 'x' } })).toEqual({ ok: false, reason: 'error' })
  })
})
