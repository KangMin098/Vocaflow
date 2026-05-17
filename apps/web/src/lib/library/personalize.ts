// apps/web/src/lib/library/personalize.ts
// LCP v2.0 Phase 9 — 사용자별 reading_sessions 동적 분할
//
// 호출 시점: 사용자가 chapter workspace 진입 시 1회 (RSC 또는 API Route 권장)
// 멱등성: 이미 sessions 있으면 return early
//
// 분할 정책:
//   - target_minutes by mastery: cold=8 / warm=15 / hot=25
//   - WPM by user CEFR: A1=80, A2=100, B1=120, B2=150, C1=180, C2=220
//   - target_words = target_minutes × WPM
//   - paragraph 단위 packing (paragraph 중간 분할 금지)

import type { SupabaseClient } from '@supabase/supabase-js'

export type UserMastery = 'cold' | 'warm' | 'hot'
export type UserCefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface PersonalizeContext {
  userMastery: UserMastery
  /** user_profiles.cefr_level이 NULL일 수 있어 호출자가 fallback 처리 */
  userCefr: UserCefr
}

const SESSION_TARGET_MINUTES: Record<UserMastery, number> = {
  cold: 8,
  warm: 15,
  hot: 25,
}

const WPM_BY_CEFR: Record<UserCefr, number> = {
  A1: 80,
  A2: 100,
  B1: 120,
  B2: 150,
  C1: 180,
  C2: 220,
}

/**
 * chapter 진입 시 1회 호출 — reading_sessions N개 생성.
 * 이미 생성됐으면 return early (멱등).
 */
export async function personalizeChapter(
  client: SupabaseClient,
  textId: string,
  ctx: PersonalizeContext,
): Promise<void> {
  // 1. 이미 생성됐는지 확인 (멱등)
  const { data: existing, error: existingError } = await client
    .from('reading_sessions')
    .select('id')
    .eq('text_id', textId)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw new Error(`reading_sessions check failed: ${existingError.message}`)
  }
  if (existing) {
    return //          이미 생성됨
  }

  // 2. text + paragraph_offsets 조회 (v_text_content view 활용)
  const { data: text, error: textError } = await client
    .from('v_text_content')
    .select('id, content, paragraph_offsets, chapter_word_count, user_id')
    .eq('id', textId)
    .single()

  if (textError) {
    throw new Error(`v_text_content fetch failed: ${textError.message}`)
  }
  if (!text) {
    throw new Error(`Text not found: ${textId}`)
  }
  if (!text.content) {
    throw new Error(
      `Text has no content (chapter master not joined?): ${textId}`,
    )
  }
  if (!text.paragraph_offsets || (text.paragraph_offsets as number[]).length === 0) {
    throw new Error(`Text has no paragraph_offsets: ${textId}`)
  }

  // 3. target 계산
  const targetMinutes = SESSION_TARGET_MINUTES[ctx.userMastery]
  const wpm = WPM_BY_CEFR[ctx.userCefr]
  const targetWords = targetMinutes * wpm

  // 4. paragraph 단위 packing
  const sessions = packIntoSessions(
    text.content as string,
    text.paragraph_offsets as number[],
    targetWords,
    targetMinutes,
  )

  if (sessions.length === 0) {
    // chapter가 너무 짧아 1 session도 생성 못함 → 전체 chapter를 1 session으로
    sessions.push({
      startPara: 0,
      endPara: (text.paragraph_offsets as number[]).length - 1,
      minutes: Math.max(1, targetMinutes),
    })
  }

  // 5. INSERT — 모든 session 'pending' 으로 시작 (RULE 8 — 무의미한 i===0 분기 제거)
  const rows = sessions.map((s, i) => ({
    text_id: textId,
    user_id: text.user_id as string,
    session_idx: i + 1,
    start_paragraph_idx: s.startPara,
    end_paragraph_idx: s.endPara,
    estimated_minutes: s.minutes,
    status: 'pending' as const,
  }))

  const { error: insertError } = await client
    .from('reading_sessions')
    .insert(rows)
  if (insertError) {
    throw new Error(`reading_sessions INSERT failed: ${insertError.message}`)
  }
}

interface PackedSession {
  startPara: number
  endPara: number
  minutes: number
}

function packIntoSessions(
  content: string,
  paragraphOffsets: number[],
  targetWords: number,
  targetMinutes: number,
): PackedSession[] {
  const sessions: PackedSession[] = []
  let bufferStart = 0
  let bufferWords = 0

  for (let i = 0; i < paragraphOffsets.length; i++) {
    const start = paragraphOffsets[i]!
    const end =
      i + 1 < paragraphOffsets.length
        ? paragraphOffsets[i + 1]!
        : content.length

    const wordCount = (content.slice(start, end).match(/\b\w+\b/g) ?? []).length
    bufferWords += wordCount

    const isLast = i === paragraphOffsets.length - 1

    if (bufferWords >= targetWords || isLast) {
      sessions.push({
        startPara: bufferStart,
        endPara: i,
        minutes: Math.max(
          1,
          Math.round(bufferWords / (targetWords / targetMinutes)),
        ),
      })
      bufferStart = i + 1
      bufferWords = 0
    }
  }

  return sessions
}
