// apps/web/src/lib/recommend/__tests__/own-reading.test.ts
// 추천 P2 — 본인이 열어 둔 개인 글 · 화면 신원 결속 · 서버 조회 조건.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decideNextAction } from '../decide'
import { pickOwnInProgressText, type OwnTextRow } from '../own-reading'
import type { OwnedNextAction } from '../types'
import { visibleNextAction } from '../use-next-action'

const A = 'user-a'
const row = (over: Partial<OwnTextRow>): OwnTextRow => ({
  id: 't1',
  title: 'My Essay',
  user_id: A,
  status: 'in_progress',
  source_url: null,
  library_book_id: null,
  user_book_group_id: null,
  updated_at: '2026-10-20T00:00:00Z',
  ...over,
})

describe('pickOwnInProgressText', () => {
  it('본인 · in_progress · 연결 자료 없음 · 출처 표지 없음 · id/제목 있음만', () => {
    expect(pickOwnInProgressText([row({})], A)).toEqual({ id: 't1', title: 'My Essay' })
    for (const bad of [
      { user_id: 'user-b' },
      { status: 'completed' },
      { status: 'not_started' },
      { status: 'extracted' },
      { status: 'conquered' },
      { library_book_id: 'b1' },
      { user_book_group_id: 'g1' },
      { source_url: 'article:035b1c37-6ede-4bf6-88bb-ef583aaf6994' },
      { source_url: 'https://example.com/x' },
      { id: '' },
      { title: '  ' },
      { title: null },
    ]) {
      expect(pickOwnInProgressText([row(bad)], A), JSON.stringify(bad)).toBeNull()
    }
    expect(pickOwnInProgressText([row({ source_url: '' })], A)).not.toBeNull() // 빈 문자열은 표지가 아니다
  })

  it('updated_at 최신 → id 순으로 결정론', () => {
    const rows = [
      row({ id: 'b', title: 'B', updated_at: '2026-10-20T00:00:00Z' }),
      row({ id: 'a', title: 'A', updated_at: '2026-10-20T00:00:00Z' }),
      row({ id: 'old', title: 'Old', updated_at: '2026-01-01T00:00:00Z' }),
      row({ id: 'z', title: 'NoTime', updated_at: null }),
    ]
    expect(pickOwnInProgressText(rows, A)?.id).toBe('a')
    expect(pickOwnInProgressText([...rows].reverse(), A)?.id).toBe('a')
  })

  it('빈 · 없는 입력 · 소유자 없음', () => {
    expect(pickOwnInProgressText([], A)).toBeNull()
    expect(pickOwnInProgressText(null, A)).toBeNull()
    expect(pickOwnInProgressText([row({})], '')).toBeNull()
  })
})

describe('decideNextAction P2', () => {
  it('P1 이 우선 · P2 는 「이어 보기」(청취를 말하지 않는다)', () => {
    expect(decideNextAction({ masteryLevel: 'warm', urgentWordCount: 5, inProgressTextTitle: 'X', inProgressTextId: 't1' }).module).toBe('flashcard')
    const a = decideNextAction({ masteryLevel: 'warm', urgentWordCount: 0, inProgressTextTitle: 'X', inProgressTextId: 't1' })
    expect(a).toEqual({ module: 'workspace', label: 'X 이어 보기', textId: 't1' })
    expect(a.label).not.toContain('듣기')
  })
})

describe('visibleNextAction — 개인 글은 신원이 같을 때만', () => {
  const personal: OwnedNextAction = {
    action: { module: 'workspace', label: 'My Essay 이어 보기', textId: 't1' },
    fallback: { module: 'spellforge', label: '단어를 정확하게 — 철자로 다지기' },
    personal: true,
    ownerId: A,
  }
  it('same 일 때만 개인 글 · checking/changed 는 fallback · 응답 전은 기본', () => {
    expect(visibleNextAction(personal, 'same').textId).toBe('t1')
    expect(visibleNextAction(personal, 'checking')).toEqual(personal.fallback)
    expect(visibleNextAction(personal, 'changed')).toEqual(personal.fallback)
    expect(visibleNextAction({ ...personal, ownerId: null }, 'same')).toEqual(personal.fallback)
    expect(visibleNextAction(null, 'same').module).toBe('flashcard')
  })
  it('개인 글이 없는 추천은 예전처럼 그대로', () => {
    const generic: OwnedNextAction = { action: personal.fallback, fallback: personal.fallback, personal: false, ownerId: A }
    expect(visibleNextAction(generic, 'checking')).toEqual(personal.fallback)
  })
})

// ── 서버 조회 조건 — 본인 UID 로만 · SELECT 만 ──
const calls: { table: string; ops: [string, unknown[]][] }[] = []
let textsResult: { data: unknown; error: unknown } = { data: [], error: null }
let currentUser: { id: string } | null = { id: A }

function builder(table: string) {
  const rec = { table, ops: [] as [string, unknown[]][] }
  calls.push(rec)
  const result = () =>
    table === 'texts' ? textsResult : table === 'user_stats' ? { data: { mastery_level: 'warm' }, error: null } : { count: 0, error: null }
  const b: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'lte', 'is', 'order', 'limit', 'maybeSingle', 'update', 'insert', 'upsert', 'delete']) {
    b[op] = (...args: unknown[]) => {
      rec.ops.push([op, args])
      return b
    }
  }
  b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from: (t: string) => builder(t),
  }),
}))

describe('getNextActionForUser — P2 조회', () => {
  beforeEach(() => {
    calls.length = 0
    currentUser = { id: A }
    textsResult = { data: [row({})], error: null }
  })

  it('본인 UID · in_progress · 도서/묶음 없음으로 SELECT 하고 개인 추천에 소유자를 붙인다', async () => {
    const { getNextActionForUser } = await import('../get-next-action')
    const r = await getNextActionForUser()
    expect(r).toMatchObject({ personal: true, ownerId: A, action: { module: 'workspace', textId: 't1', label: 'My Essay 이어 보기' } })
    expect(r.fallback.module).toBe('spellforge')
    const t = calls.find((c) => c.table === 'texts')!
    const ops = t.ops.map(([o, a]) => `${o}:${JSON.stringify(a)}`)
    expect(ops).toContain(`eq:${JSON.stringify(['user_id', A])}`)
    expect(ops).toContain(`eq:${JSON.stringify(['status', 'in_progress'])}`)
    expect(ops).toContain(`is:${JSON.stringify(['library_book_id', null])}`)
    expect(ops).toContain(`is:${JSON.stringify(['user_book_group_id', null])}`)
    expect(t.ops.find(([o]) => o === 'select')?.[1][0]).not.toMatch(/content|body/)
    for (const c of calls) expect(c.ops.some(([o]) => ['update', 'insert', 'upsert', 'delete'].includes(o))).toBe(false)
  })

  it('조회 실패 · 빈 결과면 P2 없이 기존 추천 · 로그인 없으면 cold', async () => {
    const { getNextActionForUser } = await import('../get-next-action')
    textsResult = { data: null, error: { message: 'boom' } }
    expect(await getNextActionForUser()).toMatchObject({ personal: false, action: { module: 'spellforge' } })
    textsResult = { data: [], error: null }
    expect(await getNextActionForUser()).toMatchObject({ personal: false })
    currentUser = null
    expect(await getNextActionForUser()).toMatchObject({ personal: false, ownerId: null, action: { module: 'library' } })
  })
})
