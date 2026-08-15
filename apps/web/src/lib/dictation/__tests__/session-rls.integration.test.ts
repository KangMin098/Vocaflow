// apps/web/src/lib/dictation/__tests__/session-rls.integration.test.ts
//
// 받아쓰기 세션의 **노출 경계** — 실 DB 통합. 환경변수 없으면 skip.
//
// 왜 이 테스트가 지금 필요한가:
//   2026-08-15 에 세션을 DB 에서 복원하도록 바꿨다(`items` 컬럼 + restoreDictationSession).
//   그 전까지 진행 상태는 기기 안에만 있어서 **URL 을 아무리 공유해도 남이 볼 것이 없었다.**
//   이제는 `/dictate/session?sessionId=<uuid>` 가 서버에서 문항 본문을 되살린다 —
//   즉 이 URL 이 처음으로 **공유 가능한 표면**이 됐다. 실제로 사용자가 이 URL 을 그대로
//   복사해 붙여넣는 것을 봤다(신고 경로가 그것이었다).
//
//   화면 게이트는 노출 경계의 증거가 아니다. 경계는 **키로** 확인해야 한다
//   (word-set-rls 통합 테스트와 같은 이유).
//
// 무엇을 고정하나:
//   ① anon 키로는 남의 세션을 못 읽는다 — items(문항 본문)가 새지 않는다
//   ② anon 키로는 남의 시도(받아쓴 내용)도 못 읽는다
//   ③ service_role(관리 경로)은 본다 — 정책이 과잉 차단이 아님을 확인

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON_KEY =
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'

describe.skipIf(skipIfNoEnv)('받아쓰기 세션 노출 경계 (integration)', () => {
  let anon: SupabaseClient
  let svc: SupabaseClient
  let sessionId: string | null = null

  beforeAll(async () => {
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

    const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    const userId = users?.users.find((u) => u.email === TEST_EMAIL)?.id
    if (!userId) return

    // 문항 본문이 실제로 든 세션 하나를 만든다 — 그게 새면 안 되는 것이다
    const { data } = await svc
      .from('dictation_sessions')
      .insert({
        user_id: userId,
        source_kind: 'custom',
        title: 'RLS 경계 검증',
        total_items: 1,
        config: { chunkSize: 1, count: 'all', order: 'sequential' },
        items: [{ index: 0, expectedText: 'This sentence must not leak to anon.' }],
      })
      .select('id')
      .single()
    sessionId = (data as { id: string } | null)?.id ?? null

    if (sessionId) {
      await svc.from('dictation_attempts').insert({
        session_id: sessionId,
        user_id: userId,
        item_idx: 0,
        expected: 'This sentence must not leak to anon.',
        user_input: 'this sentence must not leak',
        accuracy: 80,
        hints_used: 0,
        replay_count: 0,
        skipped: false,
      })
    }
  })

  afterAll(async () => {
    if (sessionId) {
      await svc.from('dictation_attempts').delete().eq('session_id', sessionId)
      await svc.from('dictation_sessions').delete().eq('id', sessionId)
    }
  })

  it('anon 은 남의 세션을 못 읽는다 (문항 본문이 새지 않는다)', async () => {
    expect(sessionId, '검증용 세션을 만들지 못했다').toBeTruthy()
    const { data } = await anon
      .from('dictation_sessions')
      .select('id, items')
      .eq('id', sessionId!)
    expect(data ?? [], 'anon 에게 세션이 보인다 — 세션 URL 이 남의 문항을 노출한다').toEqual([])
  })

  it('anon 은 남의 받아쓴 내용도 못 읽는다', async () => {
    const { data } = await anon
      .from('dictation_attempts')
      .select('id, user_input')
      .eq('session_id', sessionId!)
    expect(data ?? [], 'anon 에게 시도가 보인다').toEqual([])
  })

  it('service_role 은 본다 — 정책이 과잉 차단은 아니다', async () => {
    const { data } = await svc
      .from('dictation_sessions')
      .select('id, items')
      .eq('id', sessionId!)
    expect(data?.length, '관리 경로에서도 안 보인다면 데이터가 없는 것이다').toBe(1)
    expect(Array.isArray((data![0] as { items: unknown }).items)).toBe(true)
  })
})
