// apps/web/src/lib/text-viewer/__tests__/bookmark.test.ts
//
// 지문 작업면 북마크 저장 계약 — RLS 로 0행 갱신이 성공처럼 보이면 안 된다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = {
  from: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}
let result: { data: unknown; error: { message: string } | null } = { data: null, error: null }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const chain = {
      from: (t: string) => (calls.from(t), chain),
      select: (c: string) => (calls.select(c), chain),
      update: (v: unknown) => (calls.update(v), chain),
      eq: (k: string, v: unknown) => (calls.eq(k, v), chain),
      maybeSingle: () => Promise.resolve(result),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej),
    }
    return chain
  },
}))

import { fetchBookmarked, setBookmarked } from '../bookmark'

beforeEach(() => {
  Object.values(calls).forEach((f) => f.mockReset())
  result = { data: null, error: null }
})

describe('setBookmarked', () => {
  it('[0] update 오류면 ok:false 와 오류 메시지', async () => {
    result = { data: null, error: { message: 'boom' } }
    expect(await setBookmarked('t1', true)).toEqual({ ok: false, error: 'boom' })
  })

  it('[1] 갱신된 행이 0 이면 ok:false (빈 배열·null 모두)', async () => {
    result = { data: [], error: null }
    const r = await setBookmarked('t1', true)
    expect(r.ok).toBe(false)
    result = { data: null, error: null }
    expect((await setBookmarked('t1', false)).ok).toBe(false)
  })

  it('[2] 1행 이상 갱신되면 ok:true, is_bookmarked 값과 id 조건으로 update', async () => {
    result = { data: [{ id: 't1' }], error: null }
    expect(await setBookmarked('t1', false)).toEqual({ ok: true })
    expect(calls.from).toHaveBeenCalledWith('texts')
    expect(calls.update).toHaveBeenCalledWith({ is_bookmarked: false })
    expect(calls.eq).toHaveBeenCalledWith('id', 't1')
    expect(calls.select).toHaveBeenCalledWith('id')
  })
})

describe('fetchBookmarked', () => {
  it('[3] 오류·행 없음·null 이면 false', async () => {
    result = { data: { is_bookmarked: true }, error: { message: 'x' } }
    expect(await fetchBookmarked('t1')).toBe(false)
    result = { data: null, error: null }
    expect(await fetchBookmarked('t1')).toBe(false)
    result = { data: { is_bookmarked: null }, error: null }
    expect(await fetchBookmarked('t1')).toBe(false)
    result = { data: { is_bookmarked: false }, error: null }
    expect(await fetchBookmarked('t1')).toBe(false)
  })

  it('[3] is_bookmarked true 일 때만 true, id 조건으로 조회', async () => {
    result = { data: { is_bookmarked: true }, error: null }
    expect(await fetchBookmarked('t9')).toBe(true)
    expect(calls.eq).toHaveBeenCalledWith('id', 't9')
  })
})
