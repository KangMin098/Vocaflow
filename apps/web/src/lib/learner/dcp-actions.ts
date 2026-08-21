// apps/web/src/lib/learner/dcp-actions.ts
//
// CTP DCP(구문 연습) 서버 액션 — Phase 2.
//   fetchDcpPracticeItems : 오늘 처방(prescribe_today) practice 블록 문항(payload 포함) 조회. S3+ 에서만 active.
//   gradeDcpItem          : grade_dcp_item RPC(서버 answer_key 채점) → {correct, attemptId, answerKey}. attempt 기록.
//   recordDcpErrorCause   : 오답 attempt 에 error_cause 부착(RLS owner + CHECK 5원인).

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type { DcpErrorCause, DcpGradeResult, DcpItem } from './dcp'
import { isPlayableDcpType } from './dcp-types'

const ALLOWED_CAUSES: readonly DcpErrorCause[] = ['vocab', 'parsing', 'structure', 'inference', 'timing']

/**
 * prescribe_today practice 블록의 raw 문항 하나를 DcpItem 으로 검증·정규화. 부적격이면 null.
 *
 * ⚠️ `csat_dcp_items` 에는 **교재(인쇄물)에만 쓰는 유형도 함께 저장된다**
 *   (`irrelevant`·`word_order`·`vocab_choice`). 처방이 그것을 뽑아 오면 여기서 `null` 이
 *   되어 학습자가 조용히 문항을 잃는다 — 2026-08-21 에 실제로 그랬다(발행 카탈로그 안
 *   42.5%). 막는 쪽은 `prescribe_today` 의 허용 목록이고, 여기서는 **어느 갈래인지 먼저
 *   확인해** 의도를 코드에 남긴다.
 */
function parseItem(raw: unknown): DcpItem | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r.id !== 'string') return null
  const type = r.type
  // 교재용 유형은 화면이 그리지 못한다 — 여기서 걸러 낸 것이 곧 처방이 새고 있다는 뜻이다.
  if (!isPlayableDcpType(type)) return null
  const payload = r.payload as Record<string, unknown> | null
  if (!payload) return null

  if (type === 'order') {
    const presented = (payload as { presented?: unknown }).presented
    if (!Array.isArray(presented) || presented.length < 2) return null
    return {
      id: r.id,
      type: 'order',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: { presented: presented.map((s) => String(s)) },
    }
  }
  if (type === 'insert') {
    const remaining = (payload as { remaining?: unknown }).remaining
    const insertSentence = (payload as { insert_sentence?: unknown }).insert_sentence
    const gapCount = (payload as { gap_count?: unknown }).gap_count
    if (!Array.isArray(remaining) || typeof insertSentence !== 'string') return null
    return {
      id: r.id,
      type: 'insert',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: {
        remaining: remaining.map((s) => String(s)),
        insert_sentence: insertSentence,
        gap_count: typeof gapCount === 'number' ? gapCount : remaining.length + 1,
      },
    }
  }
  return null
}

/** 오늘 처방의 구문 연습(DCP) 문항. S3 미만이거나 문항 없으면 active=false. */
export async function fetchDcpPracticeItems(): Promise<{ active: boolean; items: DcpItem[] }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { active: false, items: [] }

  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('prescribe_today', { p_user_id: user.id })
  if (error || !data) return { active: false, items: [] }

  const blocks = (data as { blocks?: unknown }).blocks
  const practice = Array.isArray(blocks)
    ? (blocks.find((b) => (b as { kind?: string } | null)?.kind === 'practice') as Record<string, unknown> | undefined)
    : undefined
  if (!practice || practice.active !== true) return { active: false, items: [] }

  const raw = practice.items
  const items = Array.isArray(raw) ? raw.map(parseItem).filter((x): x is DcpItem => x !== null) : []
  return { active: items.length > 0, items }
}

/** 서버 answer_key 로 채점(grade_dcp_item). attempt 를 기록하고 attempt_id 반환. */
export async function gradeDcpItem(
  itemId: string,
  answer: Record<string, unknown>,
): Promise<DcpGradeResult> {
  const client = await createClient()
  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('grade_dcp_item', { p_item_id: itemId, p_answer: answer })
  if (error || !data) return { correct: false, attemptId: null, answerKey: null }
  const d = data as { correct?: boolean; attempt_id?: string; answer_key?: Record<string, unknown> | null }
  return {
    correct: d.correct === true,
    attemptId: d.attempt_id ?? null,
    answerKey: d.answer_key ?? null,
  }
}

/** 오답 attempt 에 error_cause 를 부착(자기보고 1-tap). RLS owner + DB CHECK(5원인) 이중 방어. */
export async function recordDcpErrorCause(attemptId: string, cause: DcpErrorCause): Promise<{ ok: boolean }> {
  if (!attemptId || !ALLOWED_CAUSES.includes(cause)) return { ok: false }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false }

  const loose = client as unknown as SupabaseClient
  const { error } = await loose
    .from('csat_item_attempts')
    .update({ error_cause: cause })
    .eq('id', attemptId)
    .eq('user_id', user.id)
  return { ok: !error }
}
