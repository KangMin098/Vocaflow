// apps/web/src/components/csat/theater/__tests__/ReasoningNoteRevision.test.tsx
// T-0063 — 자기 설명 고쳐 쓰기: 원본은 덮어쓰지 않고 새 노트(revisionOf) · 처음/고친/제공 설명 구분 · 다른 판 노트는 대조 안 함 · 옛 노트 호환
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { normalizeReasoningNote, type ReasoningNote } from '@/lib/csat/dissect'
import { EMPTY_NOTE, revisionChain, rootNoteOf } from '@/lib/csat/explain-draft'

import { ReasoningNoteForm } from '../ReasoningNoteForm'

const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64)
const DID = '11111111-2222-4333-8444-555555555555'
const note = (o: Partial<ReasoningNote>): ReasoningNote => normalizeReasoningNote({ id: 'note-0001', item: 'ev-guided-1', pairIds: [], binding: { analysisVersion: null }, statement: '처음 설명', grounds: '', applicability: '', limit: '', evidence: [], afterExplanation: true, comparedWithModel: false, at: 1, updatedAt: 1, authored: { deliveryId: DID, annotationHash: H1 }, ...o })!
const principle = { statement: '제공된 원리', when_applies: [], when_not: [] } as never
const render = (saved: ReasoningNote[], draft: Partial<typeof EMPTY_NOTE>, authoredHash = H1) => renderToStaticMarkup(
  <ReasoningNoteForm itemId="ev-guided-1" analysisVersion={null} principle={principle} pairs={[]} saved={saved} onSave={async () => true} draft={{ ...EMPTY_NOTE, ...draft }} onDraft={() => {}} modelLabel="제공된 설명(사람 검수 전)" authored={{ deliveryId: DID, annotationHash: authoredHash }} />,
)

describe('노트 정규화 · 고쳐 쓴 사슬', () => {
  it('revisionOf 는 선택 필드 — 옛 노트는 그대로 · 자기 자신 · 형식 밖 값은 버린다', () => {
    expect(note({}).revisionOf).toBeUndefined()
    expect(note({ id: 'note-0002', revisionOf: 'note-0001' }).revisionOf).toBe('note-0001')
    expect(note({ id: 'note-0002', revisionOf: 'note-0002' }).revisionOf).toBeUndefined()
    expect(note({ id: 'note-0002', revisionOf: 'x' }).revisionOf).toBeUndefined()
  })
  it('처음 노트 · 사슬(처음 → 마지막) · 순환 · 끊긴 고리', () => {
    const a = note({}), b = note({ id: 'note-0002', revisionOf: 'note-0001', statement: '고친 1', at: 2 }), c = note({ id: 'note-0003', revisionOf: 'note-0002', statement: '고친 2', at: 3 })
    const other = note({ id: 'note-0009', statement: '다른 노트', at: 4 })
    expect(rootNoteOf([a, b, c, other], c).id).toBe('note-0001')
    expect(revisionChain([a, b, c, other], b).map((n) => n.id)).toEqual(['note-0001', 'note-0002', 'note-0003'])
    const orphan = note({ id: 'note-0004', revisionOf: 'gone-00001' })
    expect(rootNoteOf([orphan], orphan).id).toBe('note-0004')
  })
})

describe('ReasoningNoteForm — 처음 · 고친 · 제공 설명', () => {
  const a = note({}), b = note({ id: 'note-0002', revisionOf: 'note-0001', statement: '고친 설명 본문', at: 2 })
  it('고친 노트를 열면 처음 설명과 고친 설명을 둘 다 구분해 보인다(원본 보존)', () => {
    const html = render([a, b], { shownId: 'note-0002' })
    expect(html).toContain('data-testid="note-first"')
    expect(html).toContain('처음 설명')
    expect(html).toContain('고친 설명 본문')
    expect(html).toContain('data-revisions="2"')
  })
  it('처음 노트만 있으면 「대조해 보고 고쳐 쓰기」 행동 · 고친 설명 칸 없음', () => {
    const html = render([a], { shownId: 'note-0001' })
    expect(html).toContain('data-testid="note-revise"')
    expect(html).not.toContain('data-testid="note-first"')
  })
  it('고쳐 쓰는 중: 안내 · 취소 · 저장 버튼 문구 — 원본 대신 새 노트로 남는다고 말한다', () => {
    const html = render([a], { revising: 'note-0001', fields: { statement: '처음 설명', grounds: '', applicability: '', limit: '' } })
    expect(html).toContain('data-testid="note-revising"')
    expect(html).toContain('data-testid="note-revise-cancel"')
    expect(html).toContain('고친 설명 저장')
    expect(html).toContain('새 노트')
  })
  it('다른 주석 판으로 쓴 노트는 지금 제공 설명과 대조하지 않는다', () => {
    const html = render([a], { shownId: 'note-0001' }, H2)
    expect(html).toContain('data-testid="note-other-edition"')
    expect(html).not.toContain('data-testid="note-open-model"')
  })
})

describe('두 기기 병합 — ID 합집합 · 고친 노트 보존(continuity.mergeReasoningNotes)', () => {
  it('기기 A 의 처음 노트 · 기기 B 의 고친 노트 · B 의 다른 노트가 모두 남고 revisionOf 가 유지된다 · 같은 제출 재전송은 한 건', async () => {
    const { mergeReasoningNotes } = await import('@/lib/csat/continuity')
    const a = note({})
    const rev = note({ id: 'note-0002', revisionOf: 'note-0001', statement: '고친 설명', at: 2, updatedAt: 2 })
    const other = note({ id: 'note-0003', statement: '다른 기기 노트', at: 3, updatedAt: 3 })
    const merged = mergeReasoningNotes([a], [a, rev, other, rev])!
    expect(merged.map((n) => n.id).sort()).toEqual(['note-0001', 'note-0002', 'note-0003'])
    expect(merged.find((n) => n.id === 'note-0001')!.statement, '원본 덮어쓰기 없음').toBe('처음 설명')
    expect(merged.find((n) => n.id === 'note-0002')!.revisionOf).toBe('note-0001')
  })
})

describe('T0063-P1-1 — 판이 섞인 처음/고친 노트: 대조 판정은 보이는 설명 기준', () => {
  const rootA = note({ authored: { deliveryId: DID, annotationHash: H1 } })
  const revB = note({ id: 'note-0002', revisionOf: 'note-0001', statement: '판 B 로 고친 설명', at: 2, authored: { deliveryId: DID, annotationHash: H2 } })
  it('지금 판 A · 처음 A 를 골라도 보이는 고친 설명은 판 B → 제공 설명(A)과 대조하지 않는다', () => {
    const html = render([rootA, revB], { shownId: 'note-0001' }, H1)
    expect(html).toContain('판 B 로 고친 설명')
    expect(html).toContain('data-testid="note-other-edition"')
    expect(html).not.toContain('data-testid="note-open-model"')
  })
  it('지금 판 B · 처음 A 를 골라도 보이는 고친 설명이 판 B → 같은 판 대조를 막지 않는다', () => {
    const html = render([rootA, revB], { shownId: 'note-0001' }, H2)
    expect(html).not.toContain('data-testid="note-other-edition"')
    expect(html).toContain('data-testid="note-open-model"')
  })
})
