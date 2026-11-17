// apps/web/src/components/csat/theater/__tests__/ReasoningNoteRevision.test.tsx
// T-0063 기록 계약(원본 보존 · revisionOf · 병합) 유지 + T-0091 — 원리 노트는 읽기 전용 기록만, 새로 쓰기 · 고쳐 쓰기 · 대조 없음
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { normalizeReasoningNote, type ReasoningNote } from '@/lib/csat/dissect'
import { revisionChain, rootNoteOf } from '@/lib/csat/explain-draft'

import { josa, ReasoningNoteForm } from '../ReasoningNoteForm'

const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64)
const DID = '11111111-2222-4333-8444-555555555555'
const note = (o: Partial<ReasoningNote>): ReasoningNote => normalizeReasoningNote({ id: 'note-0001', item: 'ev-guided-1', pairIds: [], binding: { analysisVersion: null }, statement: '처음 설명', grounds: '', applicability: '', limit: '', evidence: [], afterExplanation: true, comparedWithModel: false, at: 1, updatedAt: 1, authored: { deliveryId: DID, annotationHash: H1 }, ...o })!
const principle = { statement: '제공된 원리', when_applies: ['조건 A'], when_not: ['반례 B'] } as never
const render = (saved: ReasoningNote[], authoredHash = H1, showModel = true) => renderToStaticMarkup(
  <ReasoningNoteForm analysisVersion={null} principle={principle} saved={saved} modelLabel="제공된 설명(사람 검수 전)" authored={{ deliveryId: DID, annotationHash: authoredHash }} showModel={showModel} />,
)

describe('노트 정규화 · 고쳐 쓴 사슬(기록 계약 유지)', () => {
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

describe('ReasoningNoteForm — 제공 원리 + 읽기 전용 기록(T-0091)', () => {
  const a = note({}), b = note({ id: 'note-0002', revisionOf: 'note-0001', statement: '고친 설명 본문', at: 2 })
  it('처음 설명과 고친 설명을 모두 지우지 않고 구분해 보인다', () => {
    const html = render([a, b])
    expect(html).toContain('data-testid="note-mine"')
    expect(html).toContain('data-testid="note-revised"')
    expect(html).toContain('처음 설명')
    expect(html).toContain('고친 설명 본문')
    expect(html).toContain('data-readonly="true"')
  })
  it('쓰기 · 고쳐 쓰기 · 저장 · 대조 행동이 없다', () => {
    const html = render([a])
    expect(html).not.toMatch(/<textarea|<input|note-revise|note-open-model|저장/)
  })
  it('제공 원리 · 조건 · 반례를 보이고, 다른 판 노트는 표시만 한다', () => {
    const html = render([a], H2)
    expect(html).toContain('제공된 원리')
    expect(html).toContain('조건 A')
    expect(html).toContain('반례 B')
    expect(html).toContain('data-testid="note-other-edition"')
  })
  it('학습 정리 안(showModel=false)에서 기록이 없으면 그리지 않는다', () => {
    expect(render([], H1, false)).toBe('')
  })
  it('josa export 보존', () => {
    expect(josa('검수된 원리', '이', '가')).toBe('검수된 원리가')
    expect(josa('제공된 설명(사람 검수 전)', '과', '와')).toBe('제공된 설명(사람 검수 전)과')
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
