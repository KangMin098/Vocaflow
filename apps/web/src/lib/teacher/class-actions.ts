// apps/web/src/lib/teacher/class-actions.ts
//
// L3 B2B 교사 허브 server actions (P4.2). classes/class_members(P4.1 데이터 모델) 소비.
// 클래스카드 모델: 교사가 클래스 개설 → 초대코드 → 학생 가입. 화면 = /teacher.
// (테이블은 생성 타입 미반영 → loose 캐스팅)

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { recordFunnel } from '@/lib/analytics/funnel'
import { createClient } from '@/lib/supabase/server'

export interface TeacherClass {
  id: string
  name: string
  invite_code: string
  created_at: string
  member_count: number
}

export interface MyMembership {
  class_id: string
  class_name: string
  joined_at: string
}

function loose(c: unknown): SupabaseClient {
  return c as SupabaseClient
}

// 혼동 문자(0/O/1/I) 제외 6자리 초대코드
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

/** 클래스 개설 — 개설자가 teacher_id. 초대코드 자동 생성(UNIQUE 충돌 시 재시도). */
export async function createClass(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return { ok: false, error: '클래스 이름을 입력해 주세요.' }

  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const lc = loose(client)
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await lc
      .from('classes')
      .insert({ teacher_id: user.id, name: trimmed, invite_code: genCode() })
    // 개설은 `classes.created_at` 에 남는다 — 파생되는 것을 두 번 세지 않는다
    // (`lib/admin/retention-math.ts` 의 결정과 같은 원칙).
    if (!error) return { ok: true }
    if (error.code !== '23505') return { ok: false, error: error.message } // UNIQUE 외 즉시 반환
  }
  return { ok: false, error: '초대코드 생성 충돌 — 다시 시도해 주세요.' }
}

/**
 * 초대코드를 복사·공유했다는 기록만 남긴다(교사 왕복 4.5단계).
 *
 * 왜 별도 액션인가: 복사는 클라이언트에서 일어나는데(`navigator.clipboard`),
 * 기록은 서버가 `auth.uid()` 로 찍어야 위조가 안 된다. 실패해도 복사는 이미 됐으므로
 * 화면에 아무 영향이 없어야 한다.
 */
export async function noteInviteShared(): Promise<void> {
  const client = await createClient()
  await recordFunnel(client as unknown as SupabaseClient, 'invite_shared', { surface: '/teacher' })
}

export interface ClassPeek {
  name: string
  memberCount: number
}

/**
 * 초대코드가 **가리키는 학급**을 보여준다 — 가입 전에, 익명으로.
 *
 * 왜 필요한가: 코드가 틀렸거나 오래됐을 때 가입을 마친 뒤에 알려 주면 그 사람은
 * 계정만 하나 만들고 떠난다. 초대의 진위를 먼저 보여주는 것이 전환의 문제이자 정직함의 문제다.
 *
 * `classes` 의 RLS 는 비멤버에게 닫혀 있으므로 SECURITY DEFINER 함수를 쓴다
 * (`join_class_by_code` 와 같은 이유). 돌려주는 것은 **이름과 인원뿐** —
 * 교사의 신원은 담기지 않는다. 코드를 아는 사람은 어차피 그 학급에 들어갈 수 있으므로
 * 노출 범위는 코드가 이미 주는 권한보다 좁다.
 *
 * 없는 코드면 `null`. 조회 실패도 `null` 이다 — 화면은 어느 쪽이든 "확인할 수 없다" 로
 * 말하고 가입을 권하지 않는다.
 */
export async function peekClassByCode(code: string): Promise<ClassPeek | null> {
  const c = (code ?? '').trim().toUpperCase()
  if (c.length < 4) return null

  const client = await createClient()
  const { data, error } = await loose(client).rpc('peek_class_by_code', { p_code: c })
  if (error) {
    console.error('[peekClassByCode] 조회 실패', error.message)
    return null
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { class_name?: string; member_count?: number }
    | undefined
  if (!row?.class_name) return null

  return { name: row.class_name, memberCount: row.member_count ?? 0 }
}

/** 초대코드로 클래스 참여 (학생). */
export async function joinClassByCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const c = (code ?? '').trim().toUpperCase()
  if (c.length < 4) return { ok: false, error: '초대코드를 확인해 주세요.' }

  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  // 비멤버는 RLS상 classes SELECT 불가 → SECURITY DEFINER 함수가 lookup + 가입 처리.
  const { data, error } = await loose(client).rpc('join_class_by_code', { p_code: c })
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '해당 초대코드의 클래스를 찾을 수 없어요.' }
  // 참여는 `class_members.joined_at` 에 남는다 — 파생되므로 따로 기록하지 않는다.
  return { ok: true }
}

/** 내가 개설한 클래스 + 멤버 수. `unavailable` 이면 목록이 아니라 조회 실패다. */
export async function fetchTeacherClasses(): Promise<{
  classes: TeacherClass[]
  unavailable: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { classes: [], unavailable: false }

  // ⚠️ error 를 버리지 않는다. 이전에는 `const { data } = ...` 였고, 그래서 테이블이
  // 사라진 동안(20260719 → 20260812) 교사에게 **"개설한 클래스가 없어요"** 로 보였다 —
  // 조회 실패와 "정말 클래스가 없음" 이 화면에서 구별되지 않았다.
  const { data, error } = await loose(client)
    .from('classes')
    .select('id, name, invite_code, created_at, class_members(count)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[teacher] 개설 클래스 조회 실패: ${error.message}`)
    // 던지지 않는다 — 페이지 전체를 에러 화면으로 바꾸는 것보다, 화면을 살리고
    // "지금 못 불러왔다" 를 말하는 편이 낫다(hub 처방과 같은 원칙).
    return { classes: [], unavailable: true }
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    invite_code: r.invite_code as string,
    created_at: r.created_at as string,
    member_count: Array.isArray(r.class_members)
      ? ((r.class_members[0] as { count?: number } | undefined)?.count ?? 0)
      : 0,
  }))

  return { classes: rows, unavailable: false }
}

/** 내가 학생으로 참여한 클래스. `unavailable` 이면 목록이 아니라 조회 실패다. */
export async function fetchMyMemberships(): Promise<{
  memberships: MyMembership[]
  unavailable: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { memberships: [], unavailable: false }

  // fetchTeacherClasses 와 같은 이유로 error 를 버리지 않는다.
  const { data, error } = await loose(client)
    .from('class_members')
    .select('class_id, joined_at, classes(name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error(`[teacher] 참여 클래스 조회 실패: ${error.message}`)
    return { memberships: [], unavailable: true }
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    class_id: r.class_id as string,
    class_name: ((r.classes as { name?: string } | null)?.name) ?? '클래스',
    joined_at: r.joined_at as string,
  }))

  return { memberships: rows, unavailable: false }
}
