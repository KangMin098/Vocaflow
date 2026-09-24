// apps/web/src/app/admin/video/actions.ts
//
// 영상 요청 Server Actions — 요청 만들기 · 검토 결정 · 거두기. requireAdmin 게이트.
//
// phase 는 여기서 UPDATE 하지 않는다. 전부 RPC(`video_request_*`)가 옮긴다 — 「승인 없이 적용
// 없음」 같은 전이 규칙은 DB 한 곳에 있고, 로그인한 관리자로 부르므로 결정자(auth.uid)가 남는다.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

const PURPOSES = ['learn', 'buy'] as const
const AUDIENCES = ['student', 'parent', 'teacher', 'adult'] as const
const FORMATS = ['wide', 'vertical', 'square'] as const
const DECISIONS = ['approve', 'revise', 'reject'] as const

export interface CreateRequestInput {
  domainId: string
  targetKey: string
  targetLabel: string
  purpose: string
  audience: string
  formats: string[]
  memo: string
}

export async function createVideoRequestAction(input: CreateRequestInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin('/admin/video')
    if (!(PURPOSES as readonly string[]).includes(input.purpose)) return { ok: false, error: '목적을 고르세요' }
    if (!(AUDIENCES as readonly string[]).includes(input.audience)) return { ok: false, error: '수요자를 고르세요' }
    const formats = input.formats.filter((f) => (FORMATS as readonly string[]).includes(f))
    if (formats.length === 0) return { ok: false, error: '규격을 하나 이상 고르세요' }
    if (!input.targetKey.trim() || !input.targetLabel.trim()) return { ok: false, error: '대상을 고르세요' }

    const db = (await createClient()) as unknown as SupabaseClient
    const { data, error } = await db.rpc('video_request_create', {
      p_domain: input.domainId,
      p_target_key: input.targetKey.trim(),
      p_target_label: input.targetLabel.trim(),
      p_purpose: input.purpose,
      p_audience: input.audience,
      p_formats: formats,
      p_memo: input.memo.slice(0, 2000),
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/video')
    return { ok: true, data: { id: (data as { id: string }).id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '요청을 만들지 못했습니다' }
  }
}

export async function reviewVideoRequestAction(
  id: string,
  rev: number,
  decision: string,
  comment: string,
): Promise<ActionResult> {
  try {
    await requireAdmin('/admin/video')
    if (!(DECISIONS as readonly string[]).includes(decision)) return { ok: false, error: '결정을 고르세요' }
    if (decision !== 'approve' && !comment.trim()) {
      return { ok: false, error: '수정 요청·반려는 이유를 적어야 다음 설계가 무엇을 고칠지 압니다' }
    }
    const db = (await createClient()) as unknown as SupabaseClient
    const { error } = await db.rpc('video_request_review', {
      p_id: id,
      p_rev: rev,
      p_decision: decision,
      p_comment: comment.slice(0, 4000),
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/video')
    revalidatePath(`/admin/video/requests/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '결정을 기록하지 못했습니다' }
  }
}

export async function cancelVideoRequestAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin('/admin/video')
    const db = (await createClient()) as unknown as SupabaseClient
    const { error } = await db.rpc('video_request_cancel', { p_id: id })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/video')
    revalidatePath(`/admin/video/requests/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '거두지 못했습니다' }
  }
}
