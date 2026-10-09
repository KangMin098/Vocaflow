// apps/web/src/lib/knowledge/__tests__/effect-signals-paging.test.ts
// 성과 검토 신호 — 수행 기록 전량 읽기(1,000 행을 넘어도 잘리거나 화면이 멈추지 않는다)
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { PAGE, readAllById } from '../effect-signals-server'

const source = (n: number) => {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i + 1 }))
  const calls: (number | null)[] = []
  const fetchPage = (after: number | null) => {
    calls.push(after)
    return Promise.resolve({ data: rows.filter((r) => after === null || r.id > after).slice(0, PAGE), error: null })
  }
  return { fetchPage, calls }
}

describe('readAllById', () => {
  it('1,000 행을 넘는 기록을 빠짐없이 읽는다', async () => {
    const s = source(2 * PAGE + 37)
    const all = await readAllById('수행 기록', s.fetchPage)
    expect(all).toHaveLength(2 * PAGE + 37)
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length)
    expect(s.calls).toEqual([null, PAGE, 2 * PAGE])
  })
  it('정확히 한 페이지면 다음 페이지를 한 번 더 확인하고 끝낸다', async () => {
    const s = source(PAGE)
    expect(await readAllById('수행 기록', s.fetchPage)).toHaveLength(PAGE)
    expect(s.calls).toEqual([null, PAGE])
  })
  it('오류는 숫자로 바꾸지 않고 실패로 알린다', async () => {
    await expect(readAllById('수행 기록', () => Promise.resolve({ data: null, error: { code: '42P01', message: 'x' } }))).rejects.toThrow(/읽기 실패/)
  })
  it('키가 증가하지 않으면(정렬 깨짐) 무한 반복하지 않고 멈춘다', async () => {
    const stuck = () => Promise.resolve({ data: Array.from({ length: PAGE }, () => ({ id: 5 })), error: null })
    await expect(readAllById('수행 기록', stuck)).rejects.toThrow(/단조/)
  })
})
