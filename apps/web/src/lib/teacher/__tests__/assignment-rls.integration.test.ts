// apps/web/src/lib/teacher/__tests__/assignment-rls.integration.test.ts
//
// 학급 과제 권한 회귀 (마이그레이션 `class_assignments`, 2026-08-17 적용).
//
// 왜 이 테스트가 필요한가:
//   `assignment-actions.ts` 는 권한 필터를 **손으로 걸지 않는다** — 전부 RLS 에 맡긴다.
//   그 선택이 옳으려면 정책이 실제로 막아야 한다. 손으로 건 필터와 정책이 어긋나면
//   조용히 새는 쪽은 늘 손으로 건 쪽인데, 여기서는 아예 정책 하나만 두고 그걸 검증한다.
//
// ⚠️ 이 테스트가 실패하면 = 누군가 정책을 되돌려 놨다는 뜻이다.
//    "테스트를 고치지" 말고 권한을 원복할 것.
//
// 데이터는 전부 service_role 로 만들고 finally 에서 지운다 — 공용 DB 를 더럽히지 않는다.
// SERVICE_ROLE_KEY 없으면 자동 skip.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = 'RuntimeTest1!'

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

describe.skipIf(skip)('학급 과제 권한 (실 DB)', () => {
  let svc: SupabaseClient
  let anon: SupabaseClient
  /** 로그인한 학습자 — 이 사람은 어느 학급에도 속하지 않는다(외부인 역할). */
  let outsider: SupabaseClient
  let outsiderId: string

  /** service_role 로 만든 남의 학급·과제. */
  let classId: string
  let assignmentId: string
  let ownerId: string

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    outsider = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    const { data: auth } = await outsider.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    outsiderId = auth.user!.id

    // 과제의 주인은 **다른 사람**이어야 한다 — 검증 계정이 주인이면 "남의 것" 을 못 만든다.
    const { data: users } = await svc.auth.admin.listUsers()
    ownerId = (users.users.find((u) => u.id !== outsiderId) ?? users.users[0]!).id

    const { data: cls } = await svc
      .from('classes')
      .insert({ teacher_id: ownerId, name: '_rls_probe', invite_code: 'RLSPRB' })
      .select('id')
      .single()
    classId = (cls as { id: string }).id

    const { data: asg } = await svc
      .from('class_assignments')
      .insert({
        class_id: classId,
        created_by: ownerId,
        title: '_rls_probe_assignment',
        words: [{ w: 'contingent', m: '~에 달려 있는', v: 8 }],
      })
      .select('id')
      .single()
    assignmentId = (asg as { id: string }).id
  })

  afterAll(async () => {
    if (!svc) return
    // 과제·진도는 학급 삭제로 CASCADE 된다.
    if (classId) await svc.from('classes').delete().eq('id', classId)
  })

  describe('과제 읽기 — 소속이 유일한 열쇠다', () => {
    it('anon 은 과제를 하나도 못 읽는다', async () => {
      const { data } = await anon.from('class_assignments').select('id')
      expect(data ?? []).toEqual([])
    })

    it('소속되지 않은 로그인 사용자도 못 읽는다 — id 를 알아도 마찬가지다', async () => {
      const { data } = await outsider.from('class_assignments').select('id').eq('id', assignmentId)
      expect(data ?? []).toEqual([])
    })
  })

  describe('과제 쓰기 — 남의 학급에 보낼 수 없다', () => {
    it('외부인이 남의 학급에 과제를 만들 수 없다', async () => {
      const { error } = await outsider.from('class_assignments').insert({
        class_id: classId,
        created_by: outsiderId,
        title: '침입',
        words: [{ w: 'intrusion' }],
      })
      expect(error, 'INSERT 가 거부돼야 한다').not.toBeNull()
    })

    it('교사 자신을 사칭해도 막힌다 — created_by 를 남의 id 로 적어도 소용없다', async () => {
      const { error } = await outsider.from('class_assignments').insert({
        class_id: classId,
        created_by: ownerId,
        title: '사칭',
        words: [{ w: 'impersonation' }],
      })
      expect(error).not.toBeNull()
    })

    it('남의 과제를 수정·삭제할 수 없다', async () => {
      await outsider.from('class_assignments').update({ title: '변조' }).eq('id', assignmentId)
      await outsider.from('class_assignments').delete().eq('id', assignmentId)

      const { data } = await svc
        .from('class_assignments')
        .select('title')
        .eq('id', assignmentId)
        .single()
      expect((data as { title: string }).title).toBe('_rls_probe_assignment')
    })
  })

  describe('진도 — 소속 학급의 과제에만 기록을 남길 수 있다', () => {
    it('소속되지 않은 과제에 진도를 못 쓴다', async () => {
      const { error } = await outsider
        .from('class_assignment_progress')
        .insert({ assignment_id: assignmentId, user_id: outsiderId })
      expect(error, '남의 학급 과제에 진도가 써졌다').not.toBeNull()
    })

    it('남의 이름으로 진도를 못 쓴다', async () => {
      const { error } = await outsider
        .from('class_assignment_progress')
        .insert({ assignment_id: assignmentId, user_id: ownerId })
      expect(error).not.toBeNull()
    })

    it('anon 은 진도를 읽지도 쓰지도 못한다', async () => {
      const { data } = await anon.from('class_assignment_progress').select('user_id')
      expect(data ?? []).toEqual([])

      const { error } = await anon
        .from('class_assignment_progress')
        .insert({ assignment_id: assignmentId, user_id: outsiderId })
      expect(error).not.toBeNull()
    })
  })

  describe('형태 제약 — 지문을 넣는 우회가 DB 에서 막힌다', () => {
    // RLS 가 아니라 CHECK 다 — service_role 로도 막혀야 한다.
    it('문장을 표면형으로 넣을 수 없다', async () => {
      const { error } = await svc.from('class_assignments').insert({
        class_id: classId,
        created_by: ownerId,
        title: '지문 우회',
        words: [{ w: 'Scientists have long assumed that memory decays', m: 'x' }],
      })
      expect(error, '지문이 저장됐다').not.toBeNull()
    })

    it('뜻 자리에 문단을 넣을 수 없다', async () => {
      const { error } = await svc.from('class_assignments').insert({
        class_id: classId,
        created_by: ownerId,
        title: '뜻 우회',
        words: [{ w: 'memory', m: '가'.repeat(201) }],
      })
      expect(error).not.toBeNull()
    })

    it('정상 낱말 목록은 통과한다 — 제약이 기능을 막지는 않는다', async () => {
      const { data, error } = await svc
        .from('class_assignments')
        .insert({
          class_id: classId,
          created_by: ownerId,
          title: '_rls_probe_ok',
          words: [{ w: 'retrieval', m: '인출', v: 9 }],
        })
        .select('id')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
    })
  })
})
