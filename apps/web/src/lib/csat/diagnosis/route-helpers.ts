// apps/web/src/lib/csat/diagnosis/route-helpers.ts
//
// 진단 API 라우트 공통 — 로그인 사용자 확인 후 service role 클라이언트를 돌려준다.
// userId 는 언제나 로그인 세션에서 온다(본문에서 받지 않는다 — 남의 기록을 쓰지 못하게).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { SubmissionError } from './server'

export async function learnerContext(): Promise<{ userId: string; db: SupabaseClient } | NextResponse> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  return { userId: user.id, db: createAdminClient() as unknown as SupabaseClient }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export function failure(e: unknown): NextResponse {
  if (e instanceof SubmissionError) return NextResponse.json({ error: e.message }, { status: 400 })
  console.error('[csat-diagnosis]', e)
  return NextResponse.json({ error: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요' }, { status: 500 })
}
