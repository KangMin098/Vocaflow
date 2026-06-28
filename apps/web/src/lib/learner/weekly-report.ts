// apps/web/src/lib/learner/weekly-report.ts
//
// 주간 Report Card (리틀팍스 월리포트 이식, LEARNER_MANAGEMENT P2).
// daily_activity(P0) 주간 집계 + Empathetic 격려 코멘트(§철학3 · 템플릿, 압박 X).
// 생성은 on-demand server action (갱신 버튼) — cron 자동화는 후속.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export interface WeeklyReport {
  week_start: string
  total_minutes: number
  total_words: number
  total_reviews: number
  by_module: Record<string, number>
  empathetic_note: string | null
  generated_at: string
}

function loose(c: unknown): SupabaseClient {
  return c as SupabaseClient
}

/** KST 기준 주어진 날짜가 속한 주의 월요일 ISO date. */
function mondayOf(d: Date): string {
  // KST(UTC+9) 보정 후 요일 계산
  const kst = new Date(d.getTime() + 9 * 3_600_000)
  const day = kst.getUTCDay() // 0=일
  const diff = (day + 6) % 7 // 월요일까지 되돌릴 일수
  const monday = new Date(kst.getTime() - diff * 86_400_000)
  return monday.toISOString().slice(0, 10)
}

/** 격려형 코멘트(§철학3 Empathetic · Lora italic 렌더). 압박/비난 금지. */
function composeNote(total_reviews: number, total_minutes: number, total_words: number): string {
  if (total_reviews === 0 && total_minutes === 0) {
    return '이번 주는 잠시 숨을 골랐네요. 다음 주에 다시 가볍게 만나요.'
  }
  if (total_reviews < 20) {
    return `이번 주 ${total_words}개의 단어와 함께했어요. 작은 걸음도 분명한 전진이에요.`
  }
  if (total_minutes >= 90) {
    return `이번 주 ${total_minutes}분, ${total_reviews}번의 복습을 쌓았어요. 꾸준함이 기억을 단단하게 만들고 있어요.`
  }
  return `이번 주 ${total_words}개의 단어를 ${total_reviews}번 만났어요. 이 리듬이 실력이 돼요.`
}

/** 현재(또는 지정) 주의 daily_activity 를 집계 → weekly_reports upsert. 멱등. */
export async function generateWeeklyReport(
  weekStartIso?: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const lc = loose(client)
  const weekStart = weekStartIso ?? mondayOf(new Date())
  const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const { data: rows, error } = await lc
    .from('daily_activity')
    .select('total_minutes, total_words, total_reviews, by_module')
    .eq('user_id', user.id)
    .gte('date', weekStart)
    .lte('date', weekEnd)
  if (error) return { ok: false, error: error.message }

  let mins = 0
  let words = 0
  let reviews = 0
  const byModule: Record<string, number> = {}
  for (const r of (rows ?? []) as Array<{
    total_minutes: number | null
    total_words: number | null
    total_reviews: number | null
    by_module: Record<string, number> | null
  }>) {
    mins += r.total_minutes ?? 0
    words += r.total_words ?? 0
    reviews += r.total_reviews ?? 0
    for (const [k, v] of Object.entries(r.by_module ?? {})) {
      byModule[k] = (byModule[k] ?? 0) + (typeof v === 'number' ? v : 0)
    }
  }

  const { error: upErr } = await lc.from('weekly_reports').upsert(
    {
      user_id: user.id,
      week_start: weekStart,
      total_minutes: mins,
      total_words: words,
      total_reviews: reviews,
      by_module: byModule,
      empathetic_note: composeNote(reviews, mins, words),
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,week_start' },
  )
  if (upErr) return { ok: false, error: upErr.message }
  return { ok: true }
}

/** 최근 주간 리포트 N개 (최신순). */
export async function fetchRecentReports(limit = 8): Promise<WeeklyReport[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []

  const { data } = await loose(client)
    .from('weekly_reports')
    .select('week_start, total_minutes, total_words, total_reviews, by_module, empathetic_note, generated_at')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(limit)
  return (data ?? []) as WeeklyReport[]
}
