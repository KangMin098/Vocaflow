// apps/web/src/lib/learner/goal-actions.ts
//
// Study Plan 목표 저장 + 조회 (server actions). learning_goals(P1) + known_word_count(P0) 소비.
// 수능생 단일 집중 — goal_type='csat' 고정.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { computeStudyPlan, type StudyPlan } from './study-plan'

export interface LearningGoal {
  target_date: string
  target_v_level: number
  target_word_count: number
  weekly_target_days: number
  weekly_target_minutes: number
}

export interface SaveGoalInput {
  targetDate: string // 'YYYY-MM-DD'
  targetVLevel?: number
  targetWordCount?: number
  weeklyTargetDays?: number
  weeklyTargetMinutes?: number
}

export interface StudyPlanResult {
  goal: LearningGoal
  knownWordCount: number
  plan: StudyPlan
}

export interface OnboardingContext {
  knownWordCount: number
  /** 최근 4주 주당 처리량(단어) — 완료일 예측용 */
  recentWeeklyRate: number
  /** 기존 목표 (있으면 수정 모드) */
  goal: LearningGoal | null
}

/** learning_goals 는 생성 타입 미반영 — 느슨한 client 로 접근. */
function loose(c: unknown): SupabaseClient {
  return c as SupabaseClient
}

/** 수능 목표 저장(upsert) — onboarding 제출. */
export async function saveLearningGoal(
  input: SaveGoalInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input?.targetDate) return { ok: false, error: '목표일(수능 D-day)이 필요합니다.' }

  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const row = {
    user_id: user.id,
    goal_type: 'csat',
    target_date: input.targetDate,
    target_v_level: input.targetVLevel ?? 7,
    target_word_count: input.targetWordCount ?? 4000,
    weekly_target_days: input.weeklyTargetDays ?? 5,
    weekly_target_minutes: input.weeklyTargetMinutes ?? 100,
    updated_at: new Date().toISOString(),
  }
  const { error } = await loose(client)
    .from('learning_goals')
    .upsert(row, { onConflict: 'user_id,goal_type' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** onboarding 입력 화면용 컨텍스트 — 목표 유무와 무관하게 known-word/처리량/기존목표 반환. */
export async function fetchOnboardingContext(): Promise<OnboardingContext> {
  const empty: OnboardingContext = { knownWordCount: 0, recentWeeklyRate: 0, goal: null }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return empty

  const lc = loose(client)
  const [{ data: statsRow }, { data: goalRow }, { data: actRows }] = await Promise.all([
    lc.from('user_stats').select('known_word_count').eq('user_id', user.id).maybeSingle(),
    lc
      .from('learning_goals')
      .select('target_date, target_v_level, target_word_count, weekly_target_days, weekly_target_minutes')
      .eq('user_id', user.id)
      .eq('goal_type', 'csat')
      .maybeSingle(),
    lc
      .from('daily_activity')
      .select('total_words')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)),
  ])

  const recentTotal = ((actRows ?? []) as Array<{ total_words: number | null }>).reduce(
    (s, r) => s + (r.total_words ?? 0),
    0,
  )
  return {
    knownWordCount: (statsRow?.known_word_count as number | undefined) ?? 0,
    recentWeeklyRate: recentTotal / 4,
    goal: (goalRow as LearningGoal | null) ?? null,
  }
}

/** 현재 수능 목표 + known-word + 최근 처리량 → Study Plan. 목표 없으면 null. */
export async function fetchStudyPlan(): Promise<StudyPlanResult | null> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const lc = loose(client)
  const { data: goalRow } = await lc
    .from('learning_goals')
    .select('target_date, target_v_level, target_word_count, weekly_target_days, weekly_target_minutes')
    .eq('user_id', user.id)
    .eq('goal_type', 'csat')
    .maybeSingle()
  if (!goalRow) return null
  const goal = goalRow as LearningGoal

  const { data: statsRow } = await lc
    .from('user_stats')
    .select('known_word_count')
    .eq('user_id', user.id)
    .maybeSingle()
  const knownWordCount = (statsRow?.known_word_count as number | undefined) ?? 0

  // 최근 28일 daily_activity total_words → 주당 처리량 근사
  const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: actRows } = await lc
    .from('daily_activity')
    .select('total_words')
    .eq('user_id', user.id)
    .gte('date', cutoff)
  const recentTotal = ((actRows ?? []) as Array<{ total_words: number | null }>).reduce(
    (s, r) => s + (r.total_words ?? 0),
    0,
  )
  const recentWeeklyRate = recentTotal / 4

  const plan = computeStudyPlan({
    targetDate: goal.target_date,
    targetWordCount: goal.target_word_count,
    knownWordCount,
    weeklyTargetDays: goal.weekly_target_days,
    recentWeeklyRate,
  })

  return { goal, knownWordCount, plan }
}
