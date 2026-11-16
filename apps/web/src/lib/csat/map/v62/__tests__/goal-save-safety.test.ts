// apps/web/src/lib/csat/map/v62/__tests__/goal-save-safety.test.ts
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GoalConflictError, MapInputError, setGoal } from '../../server'
import { GoalVersionConflictError } from '../../v4/plan-store'

const key = '10000000-0000-4000-8000-000000000001'
const now = new Date('2026-10-16T01:00:00Z')
// Models the installed RPC's user lock and key-only replay, including a barrier
// that forces BOTH prechecks to observe no row. No production implementation copied.
function store(barrier = false) {
  const rows: Record<string, unknown>[] = []
  let release: () => void
  const gate = new Promise<void>(r => { release = r })
  let reads = 0
  const db = {
    from() {
      let wanted = ''
      const q = {
        select() { return q }, eq(k: string, v: string) { if (k === 'client_key') wanted = v; return q }, order() { return q },
        async limit() {
          const data = wanted ? rows.filter(r => r.client_key === wanted) : [...rows].reverse()
          if (barrier && ++reads <= 2) { if (reads === 2) release(); await gate }
          return { data, error: null }
        },
      }
      return q
    },
    async rpc(_name: string, p: Record<string, unknown>) {
      const prior = rows.find(r => r.client_key === p.p_client_key)
      if (prior) return { data: prior.id, error: null }
      const row = { id: rows.length + 1, client_key: p.p_client_key, target_score: p.p_score, target_grade: p.p_grade, target_exam: p.p_exam, target_date: p.p_date, created_at: now.toISOString() }
      rows.push(row)
      return { data: row.id, error: null }
    },
  } as unknown as SupabaseClient
  return { db, rows }
}
describe('goal save safety against installed key-only RPC', () => {
  it.each(['40001', 'PT409'])('recognizes only the explicit goal_changed business conflict (%s)', async code => {
    const { db } = store()
    db.rpc = (async () => ({ data: null, error: { code, message: 'goal_changed' } })) as unknown as typeof db.rpc
    await expect(setGoal(db, 'owned', { target: 80, clientKey: key }, now)).rejects.toBeInstanceOf(GoalVersionConflictError)
    db.rpc = (async () => ({ data: null, error: { code, message: 'unrelated failure' } })) as unknown as typeof db.rpc
    await expect(setGoal(db, 'owned', { target: 80, clientKey: key }, now)).rejects.not.toBeInstanceOf(GoalVersionConflictError)
  })
  it('same key different bodies cannot both report success after missing prechecks', async () => {
    const { db, rows } = store(true)
    const got = await Promise.allSettled([80, 90].map(target => setGoal(db, 'owned', { target, clientKey: key }, now)))
    expect(got.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    expect(got.filter(x => x.status === 'rejected')).toHaveLength(1)
    const failed = got.find(x => x.status === 'rejected') as PromiseRejectedResult
    expect(failed.reason).toBeInstanceOf(GoalConflictError)
    expect(rows).toHaveLength(1)
  })
  it('same key same bodies concurrent are one stored version', async () => {
    const { db, rows } = store(true)
    const a = await Promise.all([1, 2].map(() => setGoal(db, 'owned', { target: 80, clientKey: key }, now)))
    expect(a[0].goalVersionId).toBe(a[1].goalVersionId)
    expect(rows).toHaveLength(1)
  })
  it('lost response replay still succeeds after the saved date passes', async () => {
    const { db, rows } = store()
    const body = { target: 80, date: '2026-10-16', clientKey: key }
    const first = await setGoal(db, 'owned', body, now)
    const replay = await setGoal(db, 'owned', body, new Date('2026-10-17T01:00:00Z'))
    expect(replay.goalVersionId).toBe(first.goalVersionId)
    expect(replay.reused).toBe(true)
    expect(rows).toHaveLength(1)
  })
  it.each(['2026-10-15T15:30:00Z', '2026-10-15T23:30:00Z', '2026-10-16T00:30:00Z', '2026-10-16T14:30:00Z'])('rejects a new yesterday date at Seoul time %s', async time => {
    const { db } = store()
    await expect(setGoal(db, 'owned', { target: 80, date: '2026-10-15', clientKey: key }, new Date(time))).rejects.toBeInstanceOf(MapInputError)
  })
  it('old-key replay returns its original version without resetting a newer goal', async () => {
    const { db, rows } = store()
    const a = await setGoal(db, 'owned', { target: 80, clientKey: key }, now)
    await setGoal(db, 'owned', { target: 90, clientKey: key.replace(/1$/, '2') }, now)
    const replay = await setGoal(db, 'owned', { target: 80, clientKey: key }, now)
    expect(replay.goalVersionId).toBe(a.goalVersionId)
    expect(rows).toHaveLength(2)
    expect(rows[1].target_score).toBe(90)
    await expect(setGoal(db, 'owned', { target: 90, clientKey: key }, now)).rejects.toBeInstanceOf(GoalConflictError)
  })
  it('read failure cannot be acknowledged as absence or success', async () => {
    const { db } = store()
    db.from = (() => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { code: '08006', message: 'read down' } }) }) }) }) })) as unknown as typeof db.from
    await expect(setGoal(db, 'owned', { target: 80, clientKey: key }, now)).rejects.toThrow('read down')
  })
  it('RPC failure cannot produce success', async () => {
    const { db } = store()
    db.rpc = (async () => ({ data: null, error: { code: '08006', message: 'write down' } })) as unknown as typeof db.rpc
    await expect(setGoal(db, 'owned', { target: 80, clientKey: key }, now)).rejects.toThrow('write down')
  })
  it('RPC id without matching persisted history cannot produce success', async () => {
    const { db } = store()
    db.rpc = (async () => ({ data: 999, error: null })) as unknown as typeof db.rpc
    await expect(setGoal(db, 'owned', { target: 80, clientKey: key }, now)).rejects.toThrow('목표 저장 결과')
  })
  it('missing RPC cannot fall back to latest-only after versioned history exists', async () => {
    const { db, rows } = store()
    await setGoal(db, 'owned', { target: 80, clientKey: key }, now)
    db.rpc = (async () => ({ data: null, error: { code: 'PGRST202', message: 'missing RPC' } })) as unknown as typeof db.rpc
    await expect(setGoal(db, 'owned', { target: 90, clientKey: key.replace(/1$/, '2') }, now)).rejects.toThrow('기존 목표 이력이 있어')
    expect(rows).toHaveLength(1)
  })
  it.each([
    ['2026-12-31T15:30:00Z', '2027-01-01'],
    ['2026-10-31T15:30:00Z', '2026-11-01'],
    ['2028-02-28T15:30:00Z', '2028-02-29'],
  ])('accepts Seoul today across month/year/leap boundaries %s', async (time, date) => {
    const { db } = store()
    expect((await setGoal(db, 'owned', { target: 80, date, clientKey: key }, new Date(time))).date).toBe(date)
  })
  it.each(['2026-02-29', '2028-02-30', '2026-13-01'])('rejects invalid calendar date %s even on replay path', async date => {
    const { db } = store()
    await expect(setGoal(db, 'owned', { target: 80, date, clientKey: key }, now)).rejects.toBeInstanceOf(MapInputError)
  })
})
