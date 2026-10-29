// apps/web/src/lib/dictation/__tests__/read-session-detail.test.ts
// T-0254 — 받아쓰기 결과 조회: 세션 오류 · 문항 오류 · 예외 · 확인된 부재 · 완전한 결과를 가른다(대역 클라이언트 · 실DB 없음).
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchDictationSessionDetail, readDictationSessionDetail } from '../persist'

type Res = { data: unknown; error: unknown }
function fake(session: Res | 'throw', attempts: Res) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      calls.push(table)
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.maybeSingle = async () => {
        if (session === 'throw') throw new Error('net')
        return session
      }
      chain.order = async () => attempts
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}
const SESSION = { id: 's-1', user_id: 'u-1', title: 'T', source_kind: 'text', avg_accuracy: 80, completed_items: 1, total_items: 1, started_at: '2026-10-29T00:00:00Z' }
const ATTEMPT = { item_idx: 0, expected: 'a b', user_input: 'a b', accuracy: 100, skipped: false }

describe('readDictationSessionDetail', () => {
  it('세션 · 문항 모두 성공 → ok(완전한 결과)', async () => {
    const r = await readDictationSessionDetail(fake({ data: SESSION, error: null }, { data: [ATTEMPT], error: null }).client, 's-1')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') {
      expect(r.detail.session).toMatchObject({ id: 's-1', userId: 'u-1' })
      expect(r.detail.attempts).toHaveLength(1)
    }
  })
  it('세션 조회가 오류 없이 행 0 → absent(확인된 부재) · 문항은 묻지 않는다', async () => {
    const f = fake({ data: null, error: null }, { data: [ATTEMPT], error: null })
    expect(await readDictationSessionDetail(f.client, 's-1')).toEqual({ status: 'absent' })
    expect(f.calls).toEqual(['dictation_sessions'])
  })
  it('세션 조회 오류 → failed(session) — 부재로 바꾸지 않는다', async () => {
    const f = fake({ data: null, error: { message: 'timeout' } }, { data: [], error: null })
    expect(await readDictationSessionDetail(f.client, 's-1')).toEqual({ status: 'failed', reason: 'session' })
    expect(f.calls).toEqual(['dictation_sessions'])
  })
  it('문항 조회 오류 → failed(attempts) — 문항 0개의 불완전 결과를 ok 로 만들지 않는다', async () => {
    expect(await readDictationSessionDetail(fake({ data: SESSION, error: null }, { data: null, error: { message: 'x' } }).client, 's-1')).toEqual({ status: 'failed', reason: 'attempts' })
  })
  it('예외 → failed(exception)', async () => {
    expect(await readDictationSessionDetail(fake('throw', { data: [], error: null }).client, 's-1')).toEqual({ status: 'failed', reason: 'exception' })
  })
  it('문항이 정말 0개(오류 없음)면 ok · 빈 문항 목록', async () => {
    const r = await readDictationSessionDetail(fake({ data: SESSION, error: null }, { data: [], error: null }).client, 's-1')
    expect(r).toMatchObject({ status: 'ok', detail: { attempts: [] } })
  })
  it('기존 fetchDictationSessionDetail 호환 — ok 만 결과, 부재 · 실패는 null', async () => {
    expect(await fetchDictationSessionDetail(fake({ data: SESSION, error: null }, { data: [ATTEMPT], error: null }).client, 's-1')).not.toBeNull()
    expect(await fetchDictationSessionDetail(fake({ data: null, error: null }, { data: [], error: null }).client, 's-1')).toBeNull()
    expect(await fetchDictationSessionDetail(fake({ data: SESSION, error: null }, { data: null, error: { message: 'x' } }).client, 's-1')).toBeNull()
  })
})
