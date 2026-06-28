// apps/web/src/lib/learner/dashboard-data.ts
//
// 대시보드 Hero 실데이터 (P3) — TodayHero 하드코딩(todayWords=23·goal=30) 대체.
// 오늘 단어(daily_activity KST today) + 일 목표(user_profiles.daily_word_goal)
// + 이름(display_name) + known-word(P0 user_stats.known_word_count, Implicit Progress).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { createClient } from '@/lib/supabase/server'

export interface DashboardHero {
  userName: string
  todayWords: number
  goal: number
  knownWordCount: number
}

const DEFAULT_HERO: DashboardHero = { userName: '학습자', todayWords: 0, goal: 30, knownWordCount: 0 }

/** KST 오늘 날짜 'YYYY-MM-DD'. */
function kstToday(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

export async function fetchDashboardHero(): Promise<DashboardHero> {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return DEFAULT_HERO

  const lc = client as unknown as SupabaseClient
  const [{ data: profile }, { data: stats }, { data: today }] = await Promise.all([
    lc.from('user_profiles').select('display_name, daily_word_goal').eq('user_id', user.id).maybeSingle(),
    lc.from('user_stats').select('known_word_count').eq('user_id', user.id).maybeSingle(),
    lc.from('daily_activity').select('total_words').eq('user_id', user.id).eq('date', kstToday()).maybeSingle(),
  ])

  return {
    userName: (profile?.display_name as string | undefined)?.trim() || '학습자',
    todayWords: (today?.total_words as number | undefined) ?? 0,
    goal: (profile?.daily_word_goal as number | undefined) ?? 30,
    knownWordCount: (stats?.known_word_count as number | undefined) ?? 0,
  }
}
