// apps/web/src/lib/csat/authored/__tests__/self-explanation.test.ts — FI-011 C 자기 설명 노트: 결속 보존 · 서버 결속 검증 · 대조 모델 · 지도 복귀
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { modelOf, MODEL_LABEL } from '@/components/csat/authored/AuthoredRunner'
import { authoredNoteBindingOk } from '@/lib/csat/authored/server'
import { normalizeReasoningNote } from '@/lib/csat/dissect'
import { withMapReturn } from '@/lib/csat/map-return'

const DID = '7eb50a7c-0245-4951-bf42-67bf8231fa79'
const HASH = 'a'.repeat(64)
const note = (extra: Record<string, unknown> = {}) => ({ id: 'n1', item: 'authored:r5-cm-guided-1', statement: '주장 문장을 먼저 찾는다', at: 1, updatedAt: 1, ...extra })

describe('노트 정규화 — 창작 결속은 형식이 맞을 때만 남는다(기출 노트 호환)', () => {
  it('결속 보존 · 잘못된 형식은 버림 · 없으면 없음', () => {
    expect(normalizeReasoningNote(note({ authored: { deliveryId: DID, annotationHash: HASH } }))?.authored).toEqual({ deliveryId: DID, annotationHash: HASH })
    expect(normalizeReasoningNote(note({ authored: { deliveryId: 'x', annotationHash: HASH } }))?.authored).toBeUndefined()
    expect(normalizeReasoningNote(note())?.authored).toBeUndefined()
    expect(normalizeReasoningNote(note())?.afterExplanation).toBe(true)
  })
})

/** 가짜 클라이언트 — 납품 한 행 · 현재 유효성 · 현재 hash */
function fakes(o: { role?: string; ref?: string; current?: boolean | null; hash?: string; error?: boolean } = {}) {
  const row = { id: DID, role: o.role ?? 'guided_practice', artifact_ref: o.ref ?? 'authored:r5-cm-guided-1' }
  const chain: Record<string, unknown> = {}
  for (const k of ['select', 'eq']) chain[k] = () => chain
  chain.limit = async () => (o.error ? { data: null, error: { message: 'x' } } : { data: [row], error: null })
  const learner = { from: () => chain, rpc: async () => ({ data: o.current === undefined ? true : o.current, error: null }) } as unknown as SupabaseClient
  const admin = { rpc: async () => ({ data: o.hash ?? HASH, error: null }) } as unknown as SupabaseClient
  return { admin, learner }
}

describe('authoredNoteBindingOk — 본인 · 같은 자료 · 교수 역할 · 지금 유효 · 현재 hash 일 때만', () => {
  const b = { deliveryId: DID, annotationHash: HASH }
  it('모두 맞으면 true', async () => {
    const { admin, learner } = fakes()
    expect(await authoredNoteBindingOk(admin, learner, 'u', 'authored:r5-cm-guided-1', b)).toBe(true)
  })
  it.each([
    ['평가 역할 납품', { role: 'independent_check' }],
    ['다른 자료의 납품', { ref: 'authored:other' }],
    ['무효 납품(철회 · 대체)', { current: false }],
    ['유효성 판정 불가', { current: null }],
    ['주석 hash 바뀜', { hash: 'b'.repeat(64) }],
    ['조회 실패', { error: true }],
  ])('%s → false(fail-closed)', async (_, o) => {
    const { admin, learner } = fakes(o)
    expect(await authoredNoteBindingOk(admin, learner, 'u', 'authored:r5-cm-guided-1', b)).toBe(false)
  })
  it('결속 없음 · 기출 문항 → false', async () => {
    const { admin, learner } = fakes()
    expect(await authoredNoteBindingOk(admin, learner, 'u', 'authored:r5-cm-guided-1', undefined)).toBe(false)
    expect(await authoredNoteBindingOk(admin, learner, 'u', 'M2026-34', b)).toBe(false)
  })
})

describe('대조 모델 — 응답 뒤 공개분 · 교수 단계만(지어내지 않음) · 「검수된」 이라 부르지 않음', () => {
  it('gist 우선 · 교수 단계는 조건 줄 · 없으면 null', () => {
    expect(modelOf({ gist: '요지' }, [{ step: 's', text: '1단계', sentences: [] }])).toEqual({ statement: '요지', when_applies: ['1단계'], when_not: [] })
    expect(modelOf({ answer: 1 }, [{ step: 's', text: 'A', sentences: [] }, { step: 't', text: 'B', sentences: [] }])).toEqual({ statement: 'A', when_applies: ['B'], when_not: [] })
    expect(modelOf({ answer: 1 }, null)).toBeNull()
    expect(MODEL_LABEL).not.toContain('검수된')
  })
})

describe('지도 복귀 — 받은 창작 자료 링크도 문맥을 싣는다', () => {
  it('/csat/learn 은 from=map + 검증된 문맥 · 다른 경로는 그대로', () => {
    const href = withMapReturn('/csat/learn/r5-cm-guided-1?d=' + DID, { task: 'r.central_meaning' })
    expect(href).toContain('from=map')
    expect(href).toContain('d=' + DID)
    expect(withMapReturn('/csat/practice/x', { task: 'r.central_meaning' })).toBe('/csat/practice/x')
  })
})

describe('노트 문구 조사 — 받침 · 괄호 덧말', () => {
  it('검수된 원리와 · 제공된 설명(사람 검수 전)과 · 이/가', async () => {
    const { josa } = await import('@/components/csat/theater/ReasoningNoteForm')
    expect(josa('검수된 원리', '과', '와')).toBe('검수된 원리와')
    expect(josa('제공된 설명(사람 검수 전)', '과', '와')).toBe('제공된 설명(사람 검수 전)과')
    expect(josa('검수된 원리', '이', '가')).toBe('검수된 원리가')
    expect(josa('제공된 설명(사람 검수 전)', '이', '가')).toBe('제공된 설명(사람 검수 전)이')
  })
})
