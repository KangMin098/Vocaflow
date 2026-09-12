// apps/web/src/lib/auth/__tests__/privilege-escalation.integration.test.ts
//
// 권한 상승 회귀 락 — 실 DB 에 anon key 로 붙어 직접 공격해 본다.
//
// 배경 (2026-08-14 실측):
//   RLS "own data" 가 FOR ALL 이라 일반 사용자가 브라우저에서 한 줄로 스스로 admin 이 됐다.
//   마이그레이션 20260814150000 이 컬럼 GRANT + 트리거로 막았고, 이 테스트가 그 상태를 고정한다.
//
// ⚠️ 이 테스트가 실패하면 = 누군가 user_profiles 권한을 되돌려 놨다는 뜻이다.
//    "테스트를 고치지" 말고 권한을 원복할 것.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI). 로컬은 apps/web/.env.local 에서 로드된다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = 'RuntimeTest1!'

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

describe.skipIf(skip)('user_profiles 권한 상승 차단 (실 DB)', () => {
  let learner: SupabaseClient
  let svc: SupabaseClient
  let uid: string
  /** 테스트가 건드리기 전 원본 — afterAll 에서 반드시 되돌린다 */
  let original: Record<string, unknown> | null = null

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    const { data, error } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw new Error(`검증 계정 로그인 실패: ${error.message}`)
    uid = data.user!.id

    const { data: row } = await svc
      .from('user_profiles')
      .select('role, status, display_name, daily_word_goal, theme')
      .eq('user_id', uid)
      .single()
    original = row as Record<string, unknown>

    expect(original?.role, '검증 계정은 일반 사용자여야 의미가 있다').toBe('user')
  })

  afterAll(async () => {
    // 테스트가 만든 어떤 변화도 남기지 않는다 (다음 실행·다른 spec 오염 차단)
    if (original && uid) {
      await svc.from('user_profiles').update(original).eq('user_id', uid)
    }
    await learner?.auth.signOut()
  })

  it('스스로 role 을 admin 으로 올릴 수 없다', async () => {
    const { error } = await learner
      .from('user_profiles')
      .update({ role: 'admin' })
      .eq('user_id', uid)

    expect(error, 'role UPDATE 가 거부되지 않았다 — 권한 상승이 열려 있다').not.toBeNull()

    const { data } = await svc.from('user_profiles').select('role').eq('user_id', uid).single()
    expect((data as { role: string }).role).toBe('user')
  })

  it('스스로 role 을 curator 로도 올릴 수 없다', async () => {
    const { error } = await learner
      .from('user_profiles')
      .update({ role: 'curator' })
      .eq('user_id', uid)
    expect(error).not.toBeNull()

    const { data } = await svc.from('user_profiles').select('role').eq('user_id', uid).single()
    expect((data as { role: string }).role).toBe('user')
  })

  it('정지된 계정이 스스로 정지를 풀 수 없다', async () => {
    await svc.from('user_profiles').update({ status: 'suspended' }).eq('user_id', uid)

    const { error } = await learner
      .from('user_profiles')
      .update({ status: 'active' })
      .eq('user_id', uid)
    expect(error, 'status 자가 해제가 가능하다 — 정지가 무력하다').not.toBeNull()

    const { data } = await svc.from('user_profiles').select('status').eq('user_id', uid).single()
    expect((data as { status: string }).status).toBe('suspended')

    await svc.from('user_profiles').update({ status: 'active' }).eq('user_id', uid)
  })

  it('정상 설정 변경에 role 을 끼워 넣어도 통째로 거부된다', async () => {
    const { error } = await learner
      .from('user_profiles')
      .update({ display_name: '침투시도', role: 'admin' })
      .eq('user_id', uid)
    expect(error).not.toBeNull()

    const { data } = await svc
      .from('user_profiles')
      .select('role, display_name')
      .eq('user_id', uid)
      .single()
    const row = data as { role: string; display_name: string }
    expect(row.role).toBe('user')
    // 부분 적용도 없어야 한다 (거부는 문장 전체에 걸린다)
    expect(row.display_name).not.toBe('침투시도')
  })

  it('자기 프로필 행을 지울 수 없다 (반쪽 계정 방지)', async () => {
    await learner.from('user_profiles').delete().eq('user_id', uid)

    const { data } = await svc.from('user_profiles').select('user_id').eq('user_id', uid).maybeSingle()
    expect(data, '프로필 행이 삭제됐다 — 계정이 반쪽이 된다').not.toBeNull()
  })

  it('user_id 를 남의 것으로 바꿔치기할 수 없다', async () => {
    const { error } = await learner
      .from('user_profiles')
      .update({ user_id: '00000000-0000-0000-0000-000000000001' })
      .eq('user_id', uid)
    expect(error).not.toBeNull()

    const { data } = await svc.from('user_profiles').select('user_id').eq('user_id', uid).maybeSingle()
    expect(data).not.toBeNull()
  })

  // ── 막는 것만큼 "안 막는 것" 도 중요하다 ──
  it('본인 설정 변경은 그대로 동작한다', async () => {
    const { error } = await learner
      .from('user_profiles')
      .update({ display_name: '설정변경검증', daily_word_goal: 25, theme: 'dark' })
      .eq('user_id', uid)

    expect(error, '정상 설정 저장까지 막혔다 — 과잉 차단').toBeNull()

    const { data } = await svc
      .from('user_profiles')
      .select('display_name, daily_word_goal, theme')
      .eq('user_id', uid)
      .single()
    expect(data).toMatchObject({
      display_name: '설정변경검증',
      daily_word_goal: 25,
      theme: 'dark',
    })
  })

  it('본인 프로필 조회는 되고, 남의 프로필은 안 보인다', async () => {
    const { data, error } = await learner.from('user_profiles').select('user_id, role')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect((data as { user_id: string }[])[0].user_id).toBe(uid)
  })
})
