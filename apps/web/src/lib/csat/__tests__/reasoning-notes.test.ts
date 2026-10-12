// apps/web/src/lib/csat/__tests__/reasoning-notes.test.ts
//
// 원리 노트(v3 M4) — 정규화 · 동시 병합 · 보류 비노출 · 옛 기록 호환 · 크기
import { describe, expect, it } from 'vitest'

import { correctnessItemIds, mergeDissection, mergeReasoningNotes, withoutHeldCorrectness } from '../continuity'
import { emptyDissectionRecord, NOTE_FIELD_MAX, NOTE_KEEP, normalizeReasoningNote, type ReasoningNote } from '../dissect'

const note = (over: Partial<ReasoningNote> = {}): ReasoningNote => ({
  id: 'n1', item: '2026#34', pairIds: [], binding: { analysisVersion: 3 }, statement: '빈칸이 부정 범위 안이면 반대 방향을 고른다',
  grounds: '7번 문장', applicability: '부정어가 빈칸 문장 전체에 걸릴 때', limit: '부정이 일부에만 걸리면 다르다',
  evidence: [7], afterExplanation: true, comparedWithModel: false, at: 100, updatedAt: 100, ...over,
})

describe('normalizeReasoningNote', () => {
  it('원리 문장이 비면 버리고, 칸은 NOTE_FIELD_MAX 로 자른다', () => {
    expect(normalizeReasoningNote(note({ statement: '   ' }))).toBeNull()
    expect(normalizeReasoningNote(note({ grounds: 'x'.repeat(NOTE_FIELD_MAX + 50) }))!.grounds).toHaveLength(NOTE_FIELD_MAX)
  })
  it('afterExplanation 은 언제나 true · 모르는 helpAtReveal 은 버린다', () => {
    const n = normalizeReasoningNote({ ...note(), afterExplanation: false as unknown as true, helpAtReveal: 'bogus' as 'hint' })!
    expect(n.afterExplanation).toBe(true)
    expect(n).not.toHaveProperty('helpAtReveal')
  })
})

describe('병합 · 보류', () => {
  it('같은 id 는 나중에 고친 쪽 · 다른 기기에서 쓴 노트는 둘 다', () => {
    const m = mergeReasoningNotes([note({ statement: '옛 문장', updatedAt: 100 })], [note({ statement: '새 문장', updatedAt: 200 }), note({ id: 'n2', at: 150, updatedAt: 150 })])!
    expect(m.map((x) => x.id)).toEqual(['n1', 'n2'])
    expect(m[0].statement).toBe('새 문장')
  })
  it('노트를 모르는 옛 기기가 올려도 서버의 노트가 사라지지 않는다', () => {
    const server = { ...emptyDissectionRecord(1), reasoningNotes: [note()], updatedAt: 100 }
    const oldDevice = { ...emptyDissectionRecord(1), updatedAt: 300 }
    expect(mergeDissection(oldDevice, server).reasoningNotes).toHaveLength(1)
  })
  it('보류 문항의 노트는 내보내지 않고, 보류 판정 대상에 포함된다', () => {
    const r = { ...emptyDissectionRecord(1), reasoningNotes: [note(), note({ id: 'n2', item: 'M2709#31' })] }
    expect(correctnessItemIds(r)).toContain('M2709#31')
    expect(withoutHeldCorrectness(r, (id) => id === 'M2709#31').reasoningNotes!.map((x) => x.id)).toEqual(['n1'])
  })
  it('보관 상한 — 한글 최대 크기여도 900KB 의 절반 아래', () => {
    const big = Array.from({ length: 400 }, (_, i) =>
      note({ id: `n${i}`, at: i, updatedAt: i, statement: '가'.repeat(NOTE_FIELD_MAX), grounds: '가'.repeat(NOTE_FIELD_MAX), applicability: '가'.repeat(NOTE_FIELD_MAX), limit: '가'.repeat(NOTE_FIELD_MAX) }))
    const m = mergeReasoningNotes(big, [])!
    expect(m).toHaveLength(NOTE_KEEP)
    expect(new TextEncoder().encode(JSON.stringify(m)).length).toBeLessThan(450_000)
  })
})
