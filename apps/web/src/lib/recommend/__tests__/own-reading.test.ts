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
    expect(a).toEqual({ module: 'workspace', label: 'X 이어 보기', textId: 't1', reason: 'resume_text' })
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

// ── 서버 조회 — 본인 UID 로만 · SELECT 만 · 쪽 나누기 경계(Codex R01 · R02) ──
// 모의 DB 가 쿼리 조건을 **실제로 적용**한다(eq · is · or · not · order · range) — 조건을 기록만 하면 경계 결함을 못 잡는다.
type Row = Record<string, unknown>
const calls: { table: string; ops: [string, unknown[]][] }[] = []
let tableRows: Row[] = []
let textsError: unknown = null
let currentUser: { id: string } | null = { id: A }

function applyTexts(ops: [string, unknown[]][]): Row[] {
  let rows = [...tableRows]
  const orders: { col: string; asc: boolean; nullsFirst: boolean }[] = []
  let range: [number, number] | null = null
  for (const [op, a] of ops) {
    if (op === 'eq') rows = rows.filter((r) => r[a[0] as string] === a[1])
    else if (op === 'is') rows = rows.filter((r) => (r[a[0] as string] ?? null) === a[1])
    else if (op === 'not' && a[1] === 'is' && a[2] === null) rows = rows.filter((r) => r[a[0] as string] != null)
    else if (op === 'or') {
      expect(a[0]).toBe('source_url.is.null,source_url.eq.')
      rows = rows.filter((r) => r.source_url == null || r.source_url === '')
    } else if (op === 'order') {
      const o = (a[1] ?? {}) as { ascending?: boolean; nullsFirst?: boolean }
      const asc = o.ascending !== false
      orders.push({ col: a[0] as string, asc, nullsFirst: o.nullsFirst ?? !asc }) // PostgreSQL 기본: DESC 는 NULLS FIRST
    } else if (op === 'range') range = [a[0] as number, a[1] as number]
  }
  rows.sort((x, y) => {
    for (const o of orders) {
      const xv = x[o.col] ?? null
      const yv = y[o.col] ?? null
      if (xv === yv) continue
      if (xv === null) return o.nullsFirst ? -1 : 1
      if (yv === null) return o.nullsFirst ? 1 : -1
      const c = String(xv) < String(yv) ? -1 : 1
      return o.asc ? c : -c
    }
    return 0
  })
  return range ? rows.slice(range[0], range[1] + 1) : rows
}

function builder(table: string) {
  const rec = { table, ops: [] as [string, unknown[]][] }
  calls.push(rec)
  const result = () =>
    table === 'texts'
      ? textsError
        ? { data: null, error: textsError }
        : { data: applyTexts(rec.ops), error: null }
      : table === 'user_stats'
        ? { data: { mastery_level: 'warm' }, error: null }
        : { count: 0, error: null }
  const b: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'lte', 'is', 'or', 'not', 'order', 'limit', 'range', 'maybeSingle', 'update', 'insert', 'upsert', 'delete']) {
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

const many = (n: number, over: (i: number) => Partial<OwnTextRow>) =>
  Array.from({ length: n }, (_, i) => row({ id: `x${String(i).padStart(3, '0')}`, ...over(i) }) as unknown as Row)
const pickedId = async () => {
  const { getNextActionForUser } = await import('../get-next-action')
  const r = await getNextActionForUser()
  return r.personal ? r.action.textId : null
}

describe('getNextActionForUser — P2 조회', () => {
  beforeEach(() => {
    calls.length = 0
    currentUser = { id: A }
    textsError = null
    tableRows = [row({}) as unknown as Row]
  })

  it('본인 UID · in_progress · 도서/묶음 · 출처 표지 · 제목을 서버에서 걸고, 정렬은 updated_at NULLS LAST → id', async () => {
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
    expect(ops).toContain(`order:${JSON.stringify(['updated_at', { ascending: false, nullsFirst: false }])}`)
    expect(ops).toContain(`order:${JSON.stringify(['id', { ascending: true }])}`)
    expect(t.ops.find(([o]) => o === 'select')?.[1][0]).not.toMatch(/content|body/)
    expect(t.ops.some(([o]) => o === 'limit')).toBe(false)
    for (const c of calls) expect(c.ops.some(([o]) => ['update', 'insert', 'upsert', 'delete'].includes(o))).toBe(false)
  })

  it('R01: 더 최신인 기사 표지 20개 뒤의 개인 글을 찾는다', async () => {
    tableRows = [
      ...many(20, () => ({ source_url: 'article:035b1c37-6ede-4bf6-88bb-ef583aaf6994', updated_at: '2026-10-25T00:00:00Z' })),
      row({ id: 'valid', updated_at: '2026-10-01T00:00:00Z' }) as unknown as Row,
    ]
    expect(await pickedId()).toBe('valid')
  })

  it('R01: 공백 제목 20개가 첫 쪽을 채워도 다음 쪽의 유효한 글을 찾는다', async () => {
    tableRows = [...many(20, () => ({ title: '   ', updated_at: '2026-10-25T00:00:00Z' })), row({ id: 'valid', updated_at: '2026-10-01T00:00:00Z' }) as unknown as Row]
    expect(await pickedId()).toBe('valid')
    expect(calls.filter((c) => c.table === 'texts').length).toBe(2) // 두 쪽까지만
  })

  it('R02: 시각 없는 20개보다 시각 있는 글이 앞선다(NULLS LAST)', async () => {
    tableRows = [...many(20, () => ({ updated_at: null })), row({ id: 'dated', updated_at: '2026-01-01T00:00:00Z' }) as unknown as Row]
    expect(await pickedId()).toBe('dated')
  })

  it('R02: 같은 시각 21개 — id 가장 작은 것(쪽 경계와 무관)', async () => {
    tableRows = many(21, () => ({ updated_at: '2026-10-20T00:00:00Z' })).reverse()
    expect(await pickedId()).toBe('x000')
  })

  it('조회 실패 · 빈 결과면 P2 없이 기존 추천 · 로그인 없으면 cold', async () => {
    textsError = { message: 'boom' }
    const { getNextActionForUser } = await import('../get-next-action')
    expect(await getNextActionForUser()).toMatchObject({ personal: false, action: { module: 'spellforge' } })
    textsError = null
    tableRows = []
    expect(await getNextActionForUser()).toMatchObject({ personal: false })
    tableRows = many(45, () => ({ title: '' }))
    expect(await getNextActionForUser()).toMatchObject({ personal: false }) // 끝까지 읽고 없음
    currentUser = null
    expect(await getNextActionForUser()).toMatchObject({ personal: false, ownerId: null, action: { module: 'library' } })
  })
})
