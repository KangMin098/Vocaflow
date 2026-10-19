// apps/web/src/lib/admin/__tests__/learner-activity.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ gate: vi.fn() }))
vi.mock('@/lib/csat/embargo-gate', () => ({ userHeldSessionDecision: state.gate }))
import { loadAdminLearnerActivity, loadAdminLearnerSnapshots } from '../learner-activity'

type Result = { data: unknown; error: { code?: string; message: string } | null }
function database(results: Record<string, Result>) {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  const db = { from: (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'lt', 'order', 'limit']) chain[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return chain }
    chain.then = (resolve: (result: Result) => unknown) => Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve)
    return chain
  } }
  return { db: db as unknown as SupabaseClient, calls }
}
const attempt = { id: 25, session_id: 's1', content_hash: 'h1', task_key: 'key' }
const binding = { attempt_id: 25, session_id: 's1', annotation_hash: 'h1', workspace_id: 'w1', plan_version: 3 }
beforeEach(() => { state.gate.mockReset(); state.gate.mockResolvedValue({ held: false, failed: false }) })
describe('관리자 수행의 명시적 대상·계획 결속', () => {
  it('같은 사용자 필터와 실제 시도 ID·세션·해시로만 결속한다', async () => {
    const { db, calls } = database({ learning_task_attempts: { data: [attempt], error: null }, workspace_delivery_attempt: { data: [binding], error: null } })
    const result = await loadAdminLearnerActivity(db, 'target')
    expect(result.state === 'loaded' && result.bindings).toEqual({ state: 'loaded', rows: [binding] })
    expect(calls.filter(c => c.method === 'eq').map(c => c.args)).toEqual([['user_id', 'target'], ['user_id', 'target']])
    expect(calls.find(c => c.method === 'in')?.args).toEqual(['attempt_id', ['25']])
  })
  it.each([{ session_id: 'other' }, { annotation_hash: 'old' }, { attempt_id: 99 }])('비슷한 기록을 결속하지 않는다: %j', async change => {
    const { db } = database({ learning_task_attempts: { data: [attempt], error: null }, workspace_delivery_attempt: { data: [{ ...binding, ...change }], error: null } })
    const result = await loadAdminLearnerActivity(db, 'target')
    expect(result.state === 'loaded' && result.bindings.state).toBe('error')
  })
  it.each([['42P01', 'not_installed'], ['42501', 'error']])('미설치와 권한 오류를 다르게 반환한다: %s', async (code, expected) => {
    const { db } = database({ learning_task_attempts: { data: [attempt], error: null }, workspace_delivery_attempt: { data: null, error: { code, message: 'failed' } } })
    const result = await loadAdminLearnerActivity(db, 'target')
    expect(result.state === 'loaded' && result.bindings.state).toBe(expected)
  })
  it('페이지 마지막 ID를 사용하고 잘못된 커서는 DB 전에 거부한다', async () => {
    const { db, calls } = database({ learning_task_attempts: { data: Array.from({ length: 21 }, (_, i) => ({ ...attempt, id: 30 - i })), error: null } })
    const result = await loadAdminLearnerActivity(db, 'target', '31')
    expect(result.state === 'loaded' && [result.rows.length, result.next]).toEqual([20, '11'])
    expect(calls.find(c => c.method === 'lt')?.args).toEqual(['id', '31'])
    calls.length = 0
    expect(await loadAdminLearnerActivity(db, 'target', 'bad')).toEqual({ state: 'error' })
    expect(calls).toEqual([])
  })
  it('시도 조회 오류를 0건으로 삼키지 않는다', async () => {
    const { db } = database({ learning_task_attempts: { data: null, error: { message: 'failed' } } })
    expect(await loadAdminLearnerActivity(db, 'target')).toEqual({ state: 'error' })
  })
  it.each([[true, false, 'held'], [true, true, 'error']])('진단 보류·판정 실패를 기록 없음으로 바꾸지 않는다', async (held, failed, expected) => {
    state.gate.mockResolvedValue({ held, failed })
    const { db, calls } = database({})
    expect(await loadAdminLearnerSnapshots(db, 'target')).toEqual({ state: expected })
    expect(state.gate).toHaveBeenCalledWith('target')
    expect(calls).toEqual([])
  })
  it('동일 대상의 저장 진단만 읽는다', async () => {
    const { db, calls } = database({ csat_dx_snapshot: { data: [{ id: 'snapshot' }], error: null } })
    expect((await loadAdminLearnerSnapshots(db, 'target')).state).toBe('loaded')
    expect(calls.find(c => c.method === 'eq')?.args).toEqual(['user_id', 'target'])
    expect(calls.find(c => c.method === 'limit')?.args).toEqual([10])
  })
})
