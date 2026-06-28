// apps/web/src/lib/teacher/class-actions.ts
//
// L3 B2B 교사 허브 server actions (P4.2). classes/class_members(P4.1 데이터 모델) 소비.
// 클래스카드 모델: 교사가 클래스 개설 → 초대코드 → 학생 가입. 화면 = /teacher.
// (테이블은 생성 타입 미반영 → loose 캐스팅)

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

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
    if (!error) return { ok: true }
    if (error.code !== '23505') return { ok: false, error: error.message } // UNIQUE 외 즉시 반환
  }
  return { ok: false, error: '초대코드 생성 충돌 — 다시 시도해 주세요.' }
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
  return { ok: true }
}

/** 내가 개설한 클래스 + 멤버 수. */
export async function fetchTeacherClasses(): Promise<TeacherClass[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []

  const { data } = await loose(client)
    .from('classes')
    .select('id, name, invite_code, created_at, class_members(count)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    invite_code: r.invite_code as string,
    created_at: r.created_at as string,
    member_count: Array.isArray(r.class_members)
      ? ((r.class_members[0] as { count?: number } | undefined)?.count ?? 0)
      : 0,
  }))
}

/** 내가 학생으로 참여한 클래스. */
export async function fetchMyMemberships(): Promise<MyMembership[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []

  const { data } = await loose(client)
    .from('class_members')
    .select('class_id, joined_at, classes(name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    class_id: r.class_id as string,
    class_name: ((r.classes as { name?: string } | null)?.name) ?? '클래스',
    joined_at: r.joined_at as string,
  }))
}
