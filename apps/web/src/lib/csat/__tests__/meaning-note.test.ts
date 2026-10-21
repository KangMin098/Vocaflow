// apps/web/src/lib/csat/__tests__/meaning-note.test.ts
//
// 「내 말로」 노트 계약 — 의미 하나에 하나 · 처음 설명 보존 · 고친 설명/달라진 점 · 대조 표시 · 결속(예전 설명) ·
// 기기 ↔ 서버 병합(동시 탭 · 재시도 · 다른 기기) · 보류 문항 내보내기 제외.
import { describe, expect, it } from 'vitest'

import { mergeDissection, withoutHeldCorrectness } from '../continuity'
import type { DissectionRecord } from '../dissect'
import {
  isStaleMeaningNote, markCompared, MEANING_NOTE_MAX, meaningNoteId, mergeMeaningNotes, normalizeMeaningNote,
  reviseMeaningNote, writeMeaningNote, type MeaningNote,
} from '../meaning-note'

const B = { analysisVersion: 5, contentHash: 'aaaaaaaaaaaaaaaa' }
const base = (over: Partial<DissectionRecord> = {}): DissectionRecord => ({
  version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], ...over,
})
const first = (text = '법은 원래 안 할 일만 막으면 자유를 묶는 게 아니다', now = 100) =>
  writeMeaningNote(null, { item: '2026#34', unitId: 'u1', text, binding: B }, now)!

describe('meaning-note', () => {
  it('처음 저장 — id 는 문항|의미 · 빈 글은 저장하지 않는다 · 길면 자른다', () => {
    const n = first()
    expect(n.id).toBe(meaningNoteId('2026#34', 'u1'))
    expect(n.compared).toBe(false)
    expect(writeMeaningNote(null, { item: '2026#34', unitId: 'u1', text: '   ', binding: B }, 1)).toBeNull()
    expect([...first('가'.repeat(400)).first].length).toBe(MEANING_NOTE_MAX)
  })

  it('이미 있으면 처음 설명을 덮지 않는다(고쳐 쓰기는 따로)', () => {
    const n = first()
    expect(writeMeaningNote(n, { item: '2026#34', unitId: 'u1', text: '다른 글', binding: B }, 200)).toBe(n)
  })

  it('고쳐 쓰기 — 처음 설명은 남고, 고친 설명 · 달라진 점이 붙는다. 같은 글이면 그대로(횟수를 세지 않는다)', () => {
    const n = first()
    const r = reviseMeaningNote(n, { text: '이상적인 법이 이성적으로 어차피 안 할 일만 금지한다면 자유를 묶는다고 볼 수 없다', change: '조건(이상적인 법 · 만약)을 빠뜨렸다', binding: B }, 300)
    expect(r.first).toBe(n.first)
    expect(r.revised).toContain('이상적인 법')
    expect(r.change).toContain('조건')
    expect(r.updatedAt).toBe(300)
    expect(reviseMeaningNote(r, { text: r.revised!, change: r.change, binding: B }, 400)).toBe(r)
    expect(Object.keys(r)).not.toContain('revisions')
  })

  it('대조 표시는 한 번 켜지면 유지된다', () => {
    const c = markCompared(first(), 150)
    expect(c.compared).toBe(true)
    expect(markCompared(c, 999)).toBe(c)
  })

  it('예전 설명으로 쓴 노트 — 내용 해시가 다르면 stale, 같으면 아님', () => {
    const n = first()
    expect(isStaleMeaningNote(n, B)).toBe(false)
    expect(isStaleMeaningNote(n, { analysisVersion: 5, contentHash: 'bbbbbbbbbbbbbbbb' })).toBe(true)
    expect(isStaleMeaningNote({ ...n, binding: { analysisVersion: 4, contentHash: null } }, { analysisVersion: 5, contentHash: null })).toBe(true)
  })

  it('정규화 — 깨진 기록 · 이상한 해시는 버리거나 비운다', () => {
    expect(normalizeMeaningNote({ item: 'x' } as Partial<MeaningNote>)).toBeNull()
    expect(normalizeMeaningNote({ ...first(), binding: { analysisVersion: 5, contentHash: '<script>' } })!.binding.contentHash).toBeNull()
  })

  it('병합 — 같은 의미는 하나 · 새로 고친 쪽이 이긴다(동시 탭 · 다른 기기 · 재시도 중복)', () => {
    const a = first('A 탭', 100)
    const b = reviseMeaningNote(a, { text: 'B 기기에서 고침', binding: B }, 500)
    const merged = mergeMeaningNotes([a, a], [b])!
    expect(merged).toHaveLength(1)
    expect(merged[0].revised).toBe('B 기기에서 고침')
    expect(mergeMeaningNotes([b], [a])![0].revised).toBe('B 기기에서 고침')
  })

  it('mergeDissection — 늦게 쓴 기기가 다른 기기의 다른 의미 노트를 지우지 않는다', () => {
    const u1 = first('u1 노트', 100)
    const u2 = writeMeaningNote(null, { item: '2026#34', unitId: 'u2', text: 'u2 노트', binding: B }, 200)!
    const local = base({ meaningNotes: [u1], updatedAt: 100 })
    const server = base({ meaningNotes: [u2], updatedAt: 900 })
    const m = mergeDissection(local, server)
    expect(m.meaningNotes!.map((x) => x.unitId).sort()).toEqual(['u1', 'u2'])
  })

  it('보류 문항의 노트는 내보내지 않는다(서버 사본은 그대로)', () => {
    const rec = base({ meaningNotes: [first()] })
    expect(withoutHeldCorrectness(rec, (id) => id === '2026#34').meaningNotes).toEqual([])
    expect(withoutHeldCorrectness(rec, () => false).meaningNotes).toHaveLength(1)
  })
})
