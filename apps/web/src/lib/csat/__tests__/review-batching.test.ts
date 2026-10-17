// apps/web/src/lib/csat/__tests__/review-batching.test.ts
import { describe, expect, it } from 'vitest'
import { followupAfter, keysetFollowups, validPersonasBatched, type FollowupKey } from '../review-batching'

const ids = Array.from({ length: 53 }, (_, i) => `a${String(i).padStart(3, '0')}`)
const ok = (part: string[]) => Promise.resolve({ data: part.map((id) => ({ analysis_id: id, personas: ['P1'] })), error: null })

describe('validPersonasBatched', () => {
  it('묶음 크기를 지키고 전량을 돌려준다', async () => {
    const sizes: number[] = []
    const r = await validPersonasBatched(ids, (p) => { sizes.push(p.length); return ok(p) })
    expect(r.error).toBeNull()
    expect(r.rows.map((x) => x.analysis_id).sort()).toEqual(ids)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(20)
  })
  it('시간 초과는 쪼개 다시 묻는다', async () => {
    const r = await validPersonasBatched(ids, (p) => p.length > 5 ? Promise.resolve({ data: null, error: { message: 'canceling statement', code: '57014' } }) : ok(p))
    expect(r.error).toBeNull()
    expect(r.rows).toHaveLength(53)
  })
  it('한 개도 시간 초과면 오류 — 빈 승인으로 삼키지 않는다', async () => {
    const r = await validPersonasBatched(ids, (p) => p.includes('a007') ? Promise.resolve({ data: null, error: { message: 'canceling statement', code: '57014' } }) : ok(p))
    expect(r.error).toMatch(/시간 초과/)
    expect(r.rows).toEqual([])
  })
  it('빠진 행은 읽기 실패다', async () => {
    const r = await validPersonasBatched(ids, (p) => ok(p.filter((x) => x !== 'a010')))
    expect(r.error).toMatch(/1개가 없다/)
  })
  it('동시성 상한', async () => {
    let live = 0, peak = 0
    await validPersonasBatched(ids, async (p) => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 2)); live--; return ok(p) }, 5, 3)
    expect(peak).toBeLessThanOrEqual(3)
  })
})

describe('keysetFollowups', () => {
  const rows: FollowupKey[] = []
  for (let i = 0; i < 25; i++) for (const s of ['blind', 'x,(y)"z']) for (const k of ['k1', 'k2']) rows.push({ item_id: `H2403G1#${String(i).padStart(2, '0')}`, source: s, finding_key: k })
  rows.sort((a, b) => a.item_id.localeCompare(b.item_id) || a.source.localeCompare(b.source) || a.finding_key.localeCompare(b.finding_key))
  // after 문자열에서 마지막 키를 되살려 PK 비교를 흉내 낸다
  const pages = (cap: number) => {
    let last: FollowupKey | null = null
    return (after: string | null) => {
      if (after) expect(after).toBe(followupAfter(last!))
      const cmp = (r: FollowupKey) => !last || r.item_id > last.item_id || (r.item_id === last.item_id && (r.source > last.source || (r.source === last.source && r.finding_key > last.finding_key)))
      const page = rows.filter(cmp).slice(0, cap)
      if (page.length) last = page[page.length - 1]
      return Promise.resolve({ data: page, error: null })
    }
  }
  it('상한을 넘는 장부를 누락·중복 없이 끝까지', async () => {
    const r = await keysetFollowups(pages(7), 7)
    expect(r.error).toBeNull()
    expect(r.rows).toEqual(rows)
  })
  it('특수문자를 따옴표로 감싼다', () => {
    expect(followupAfter({ item_id: 'a', source: 'x,(y)"z', finding_key: 'k' })).toContain('source.gt."x,(y)\\"z"')
  })
  it('오류는 빈 목록 + error', async () => {
    const r = await keysetFollowups(() => Promise.resolve({ data: null, error: { message: 'boom' } }))
    expect(r).toEqual({ rows: [], error: 'boom' })
  })
})
