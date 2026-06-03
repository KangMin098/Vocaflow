// apps/web/src/lib/echo/save-attempt.ts
//
// EchoMatch 점수 적재 — 세션 ensure + attempt INSERT + 세션 통계 갱신.
// 비로그인 사용자는 silent skip.

'use client'

import { createClient } from '@/lib/supabase/client'

import type { ComparisonScore } from './dtw-comparator'

interface SaveContext {
  textId: string
  libraryBookId?: string | null
  sentenceId: string
  attemptNumber: number
  score: ComparisonScore
  durationMs?: number
}

/** 진행 중 세션 id (per-텍스트 한 세션). null 이면 다음 호출에서 생성. */
const sessionCache = new Map<string, string>()

function clearSessionCache(textId: string) {
  sessionCache.delete(textId)
}

export async function saveEchoAttempt(ctx: SaveContext): Promise<{ ok: boolean; reason?: string }> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return { ok: false, reason: 'unauthenticated' }

  // 세션 ensure
  let sessionId = sessionCache.get(ctx.textId)
  if (!sessionId) {
    const { data: session, error: sErr } = await supabase
      .from('echo_match_sessions')
      .insert({
        user_id: userId,
        text_id: ctx.textId,
        library_book_id: ctx.libraryBookId ?? null,
        total_sentences: null,
        completed_sentences: 0,
      })
      .select('id')
      .single()
    if (sErr || !session) return { ok: false, reason: sErr?.message ?? 'session insert failed' }
    sessionId = (session as { id: string }).id
    sessionCache.set(ctx.textId, sessionId)
  }

  // attempt INSERT
  const { error: aErr } = await supabase.from('echo_match_attempts').insert({
    session_id: sessionId,
    user_id: userId,
    sentence_id: ctx.sentenceId,
    attempt_number: ctx.attemptNumber,
    pitch_score: ctx.score.pitch,
    energy_score: ctx.score.energy,
    timing_score: ctx.score.timing,
    overall_score: ctx.score.overall,
    duration_ms: ctx.durationMs ?? null,
  })
  if (aErr) return { ok: false, reason: aErr.message }

  return { ok: true }
}

/** 세션 종료 — 통계 집계 + ended_at. */
export async function finalizeEchoSession(textId: string): Promise<void> {
  const supabase = createClient()
  const sessionId = sessionCache.get(textId)
  if (!sessionId) return

  // attempts 통계 집계
  const { data: attempts } = await supabase
    .from('echo_match_attempts')
    .select('overall_score, pitch_score, energy_score, timing_score, sentence_id, attempt_number')
    .eq('session_id', sessionId)

  if (attempts && attempts.length > 0) {
    type A = {
      overall_score: number | null
      pitch_score: number | null
      energy_score: number | null
      timing_score: number | null
      sentence_id: string
      attempt_number: number
    }
    const rows = attempts as A[]
    const avg = (key: keyof A) => {
      const vals = rows.map((r) => Number(r[key] ?? 0)).filter((n) => !Number.isNaN(n))
      return vals.length > 0 ? vals.reduce((s, n) => s + n, 0) / vals.length : null
    }
    const overalls = rows.map((r) => Number(r.overall_score ?? 0))
    const retried = rows
      .filter((r) => r.attempt_number > 1)
      .map((r) => r.sentence_id)
    const uniqueSentences = new Set(rows.map((r) => r.sentence_id)).size

    await supabase
      .from('echo_match_sessions')
      .update({
        ended_at: new Date().toISOString(),
        completed_sentences: uniqueSentences,
        avg_pitch_score: avg('pitch_score'),
        avg_energy_score: avg('energy_score'),
        avg_timing_score: avg('timing_score'),
        avg_overall_score: avg('overall_score'),
        best_sentence_score: Math.max(...overalls),
        worst_sentence_score: Math.min(...overalls),
        retried_sentence_ids: retried,
      })
      .eq('id', sessionId)
  }
  clearSessionCache(textId)
}
