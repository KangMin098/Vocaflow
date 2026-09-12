// apps/web/src/lib/teacher/__tests__/invite-rpc.integration.test.ts
//
// **초대 링크가 모든 코드에 대해 "확인할 수 없어요" 로 죽는 것**을 잡는다.
//
// `/join/[code]` 는 익명 방문자에게 학급 이름을 보여준다. 그러려면 `peek_class_by_code` 에
// **anon 실행 권한**이 있어야 한다(`classes` 의 RLS 는 비멤버에게 닫혀 있다).
// 권한이 없으면 함수 호출이 거부되고, 코드는 `null` 을 받아 화면이 "확인할 수 없어요" 를
// 그린다 — **정상적인 실패 화면과 구별되지 않는다.** 유효한 초대까지 전부 그렇게 보인다.
//
// GRANT 는 마이그레이션 한 줄이라 다음 함수 교체 때 조용히 빠질 수 있다. 그래서 잰다.
//
// 환경변수 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const skipIfNoEnv = !URL_BASE || !ANON

/** 초대 링크를 여는 학생과 **같은 권한** — 로그인 전이다. */
function anonClient(): SupabaseClient {
  return createClient(URL_BASE as string, ANON as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

describe.skipIf(skipIfNoEnv)('초대 링크 RPC (실 DB · anon)', () => {
  it('익명이 peek_class_by_code 를 실행할 수 있다 — 막히면 모든 초대가 죽는다', async () => {
    const { error } = await anonClient().rpc('peek_class_by_code', { p_code: 'ZZZZZZ' })

    expect(
      error,
      `익명 실행이 거부됐다: ${error?.message ?? ''} — GRANT EXECUTE ... TO anon 을 확인할 것`,
    ).toBeNull()
  })

  it('없는 코드에는 아무것도 주지 않는다 — 열거로 학급 목록을 얻을 수 없다', async () => {
    const { data } = await anonClient().rpc('peek_class_by_code', { p_code: 'ZZZZZZ' })
    expect(Array.isArray(data) ? data.length : data).toBeFalsy()
  })

  it('교사 신원을 돌려주지 않는다 — 이름과 인원만', async () => {
    // 0행이어도 계약은 검사할 수 있다: PostgREST 가 컬럼 이름을 알기 때문이다.
    // 함수가 teacher_id 를 실어 나르기 시작하면 이 호출의 반환 형태가 달라진다.
    const { data, error } = await anonClient().rpc('peek_class_by_code', { p_code: 'ZZZZZZ' })
    expect(error).toBeNull()
    for (const row of (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>) {
      expect(Object.keys(row).sort()).toEqual(['class_name', 'member_count'])
    }
  })

  it('비로그인 join 은 아무 일도 일으키지 않는다 — GET 만으로 학급에 들어가지 않는다', async () => {
    // `join_class_by_code` 는 auth.uid() 가 없으면 NULL 을 돌려준다(예외 아님).
    // 이 화면이 공개라 링크 미리보기·prefetch 가 그냥 열 수 있으므로 그 성질에 기댄다.
    const { data, error } = await anonClient().rpc('join_class_by_code', { p_code: 'ZZZZZZ' })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
