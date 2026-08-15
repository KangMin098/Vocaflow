// apps/web/src/lib/auth/__tests__/rls-surface.integration.test.ts
//
// 클라이언트에 열려 있으면 안 되는 표면 회귀 락 (마이그레이션 20260815020000).
//
// 배경 (2026-08-15 실측):
//   1) `sw_players` · `sw_comments` · `st17_timetables` 가 `FOR ALL TO anon USING(true)` 였다.
//      anon key 는 브라우저 번들에 그대로 들어 있으므로 사실상 전 인터넷 공개였고,
//      실제로 `sw_players.pass_hash` 를 anon key 만으로 읽어냈다.
//      이 세 테이블은 제품 코드가 전혀 참조하지 않는 고아다(다른 실험의 잔여물).
//   2) `class_members.cm_self_join` 이 초대코드를 보지 않고 직접 INSERT 를 허용했다.
//      class_id 만 알면 남의 클래스에 스스로 들어가고 role 을 직접 적을 수 있었다.
//
// ⚠️ 이 테스트가 실패하면 = 누군가 정책/권한을 되돌려 놨다는 뜻이다.
//    "테스트를 고치지" 말고 권한을 원복할 것.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = 'RuntimeTest1!'

/** 제품이 쓰지 않는데 열려 있던 테이블들. */
const ORPHAN_TABLES = ['sw_players', 'sw_comments', 'st17_timetables'] as const

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

describe.skipIf(skip)('클라이언트에 열려 있으면 안 되는 표면 (실 DB)', () => {
  let anon: SupabaseClient
  let learner: SupabaseClient
  let svc: SupabaseClient
  let uid: string

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    const { data, error } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw new Error(`검증 계정 로그인 실패: ${error.message}`)
    uid = data.user!.id
  })

  afterAll(async () => {
    await learner?.auth.signOut()
  })

  // ── 고아 테이블 ──
  describe.each(ORPHAN_TABLES)('%s — 제품이 쓰지 않는 테이블', (table) => {
    it('익명(anon key)에게 열리지 않는다', async () => {
      const { error } = await anon.from(table).select('*').limit(1)
      expect(error, `${table} 이 anon 에게 읽힌다 — anon key 는 브라우저에 공개된다`).not.toBeNull()
    })

    it('로그인 사용자에게도 열리지 않는다', async () => {
      const { error } = await learner.from(table).select('*').limit(1)
      expect(error, `${table} 이 로그인 사용자에게 읽힌다`).not.toBeNull()
    })

    it('쓰기도 막힌다', async () => {
      const { error } = await learner.from(table).delete().neq('nick', '___never___')
      expect(error, `${table} 에 클라이언트 쓰기가 열려 있다`).not.toBeNull()
    })
  })

  it('sw_players 의 pass_hash 는 어떤 클라이언트에게도 노출되지 않는다', async () => {
    // 컬럼을 콕 집어 요청해도 막혀야 한다 (select('*') 만 막히면 의미 없다)
    for (const [label, client] of [
      ['anon', anon],
      ['authenticated', learner],
    ] as const) {
      const { data, error } = await client.from('sw_players').select('nick, pass_hash').limit(1)
      expect(error, `${label} 이 pass_hash 를 읽었다`).not.toBeNull()
      expect(data).toBeNull()
    }
  })

  // ── class_members ──
  describe('class_members — 초대코드가 유일한 가입 경로다', () => {
    let classId: string | null = null
    const INVITE = 'RLSPRB'

    beforeAll(async () => {
      const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
      const teacherId = users.users[0]?.id
      const { data } = await svc
        .from('classes')
        .insert({ teacher_id: teacherId, name: 'rls-surface-probe', invite_code: INVITE })
        .select('id')
        .single()
      classId = (data as { id: string } | null)?.id ?? null
    })

    afterAll(async () => {
      // 테스트가 만든 클래스·멤버십을 남기지 않는다
      if (classId) {
        await svc.from('class_members').delete().eq('class_id', classId)
        await svc.from('classes').delete().eq('id', classId)
      }
    })

    it('class_id 를 알아도 직접 가입할 수 없다', async () => {
      expect(classId, '픽스처 클래스 생성 실패').not.toBeNull()
      const { error } = await learner
        .from('class_members')
        .insert({ class_id: classId, user_id: uid, role: 'student' })
      expect(error, '초대코드 없이 남의 클래스에 들어갔다').not.toBeNull()
    })

    it('role 을 teacher 로 자칭하며 들어갈 수 없다', async () => {
      const { error } = await learner
        .from('class_members')
        .insert({ class_id: classId, user_id: uid, role: 'teacher' })
      expect(error).not.toBeNull()

      const { data } = await svc.from('class_members').select('user_id').eq('class_id', classId!)
      expect(data ?? []).toHaveLength(0)
    })

    // 막는 것만큼 "안 막는 것" 도 중요하다
    it('정상 경로(초대코드 RPC)는 그대로 동작하고 role 을 student 로 고정한다', async () => {
      const { data, error } = await learner.rpc('join_class_by_code', { p_code: INVITE })
      expect(error, '정상 가입 경로까지 막혔다 — 과잉 차단').toBeNull()
      expect(data).toBe(classId)

      const { data: rows } = await svc
        .from('class_members')
        .select('user_id, role')
        .eq('class_id', classId!)
      expect(rows).toHaveLength(1)
      expect((rows as { user_id: string; role: string }[])[0]).toMatchObject({
        user_id: uid,
        role: 'student',
      })
    })

    it('가입한 뒤에도 자기 역할을 teacher 로 올릴 수 없다', async () => {
      // 앞 테스트에서 student 로 가입된 상태
      const { error } = await learner
        .from('class_members')
        .update({ role: 'teacher' })
        .eq('class_id', classId!)
        .eq('user_id', uid)

      const { data } = await svc
        .from('class_members')
        .select('role')
        .eq('class_id', classId!)
        .eq('user_id', uid)
        .maybeSingle()

      // UPDATE 정책이 아예 없으므로 거부되거나 0행 영향 — 어느 쪽이든 role 은 그대로여야 한다
      expect((data as { role: string } | null)?.role, `role 이 바뀌었다 (error=${error?.message})`).toBe(
        'student',
      )
    })
  })
})
