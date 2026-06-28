// apps/web/src/lib/learner/manage-overview.ts
//
// "내 학습 관리" 통합 overview (리틀팍스 MY 학습 참고) — P0~P3 데이터를 한 화면에 모음.
// 진단(V-Level) · 계획(Study Plan) · 실행(known-word/streak/오늘) · 최근 리포트.
// 각 카드는 상세(/diagnostic·/onboarding·/reports)로 연결만 — 관리 overview 는 read-only.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { fetchStudyPlan, type StudyPlanResult } from './goal-actions'

export interface ManageOverview {
  /** current_v_level — 0/null 이면 미진단 */
  vLevel: number | null
  knownWordCount: number
  currentStreak: number
  todayWords: number
  /** P1 Study Plan (목표 미설정이면 null) */
  plan: StudyPlanResult | null
  /** 최근 주간 리포트 요약 (없으면 null) */
  latestReport: { week_start: string; total_words: number; empathetic_note: string | null } | null
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

export async function fetchManageOverview(): Promise<ManageOverview | null> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const lc = client as unknown as SupabaseClient
  const [{ data: profile }, { data: stats }, { data: today }, { data: report }, plan] =
    await Promise.all([
      lc.from('user_profiles').select('current_v_level').eq('user_id', user.id).maybeSingle(),
      lc.from('user_stats').select('known_word_count, current_streak').eq('user_id', user.id).maybeSingle(),
      lc.from('daily_activity').select('total_words').eq('user_id', user.id).eq('date', kstToday()).maybeSingle(),
      lc
        .from('weekly_reports')
        .select('week_start, total_words, empathetic_note')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchStudyPlan(),
    ])

  const rawV = (profile?.current_v_level as number | undefined) ?? null
  return {
    vLevel: rawV && rawV > 0 ? rawV : null, // V0 = 미진단(메모리 규칙)
    knownWordCount: (stats?.known_word_count as number | undefined) ?? 0,
    currentStreak: (stats?.current_streak as number | undefined) ?? 0,
    todayWords: (today?.total_words as number | undefined) ?? 0,
    plan,
    latestReport: report
      ? {
          week_start: report.week_start as string,
          total_words: (report.total_words as number | undefined) ?? 0,
          empathetic_note: (report.empathetic_note as string | undefined) ?? null,
        }
      : null,
  }
}
