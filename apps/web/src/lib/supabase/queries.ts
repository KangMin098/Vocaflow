// apps/web/src/lib/supabase/queries.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export interface HubData {
  userName: string
  streak: number
  reviewCount: number
  todayCount: number
  accuracy: number
  lastStudied: Record<ModuleKey, Date | null>
  recentText: RecentText | null
  activities: Activity[]
}

export interface RecentText {
  id: string
  title: string
  preview: string
  progressPercent: number
  relativeTime: string
  moduleLabel: string
}

export interface Activity {
  id: string
  module: 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz'
  textTitle: string
  score: number
  relativeTime: string
}

type ModuleKey =
  | 'text'
  | 'wordvault'
  | 'flashcard'
  | 'spellforge'
  | 'wordblitz'
  | 'scriptquiz'
  | 'dashboard'

export async function fetchHubData(supabase: SupabaseClient, userId: string): Promise<HubData> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // 사용자 이름
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userName =
    (user?.user_metadata?.name as string | undefined) ?? user?.email?.split('@')[0] ?? '학습자'

  // 병렬 조회
  const [
    todayRes,
    streakRes,
    accuracyRes,
    reviewRes,
    lastStudiedRes,
    recentTextRes,
    activitiesRes,
  ] = await Promise.all([
    // 오늘 학습 단어 수
    supabase
      .from('learning_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('attempted_at', todayStart.toISOString()),

    // 연속 학습 일수 (날짜만 추출하여 계산)
    supabase
      .from('learning_records')
      .select('attempted_at')
      .eq('user_id', userId)
      .gte('attempted_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order('attempted_at', { ascending: false }),

    // 전체 정확도
    supabase.from('learning_records').select('is_correct').eq('user_id', userId),

    // 오늘 복습 대기 (난이도 1~3 — SRS 복습 대상)
    supabase
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('difficulty', 1)
      .lte('difficulty', 3),

    // 모듈별 마지막 학습 시간
    supabase
      .from('learning_records')
      .select('module, attempted_at')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(50),

    // 최근 학습 스크립트
    supabase
      .from('texts')
      .select('id, title, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),

    // 최근 학습 활동 (최대 5개)
    supabase
      .from('learning_records')
      .select(
        `
        id, module, attempted_at, is_correct,
        vocabularies (
          texts ( title )
        )
      `
      )
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(5),
  ])

  // 연속 일수 계산
  const streak = calculateStreak(
    (streakRes.data ?? []).map((r) => new Date(r.attempted_at as string))
  )

  // 정확도 계산
  const accuracyData = accuracyRes.data ?? []
  const accuracy =
    accuracyData.length > 0
      ? Math.round((accuracyData.filter((r) => r.is_correct).length / accuracyData.length) * 100)
      : 0

  // 모듈별 마지막 학습 시간 매핑
  const lastStudied: Record<ModuleKey, Date | null> = {
    text: null,
    wordvault: null,
    flashcard: null,
    spellforge: null,
    wordblitz: null,
    scriptquiz: null,
    dashboard: null,
  }
  for (const record of lastStudiedRes.data ?? []) {
    const mod = record.module as ModuleKey
    if (mod in lastStudied && !lastStudied[mod]) {
      lastStudied[mod] = new Date(record.attempted_at as string)
    }
  }

  // 최근 스크립트 처리
  const recentTextData = recentTextRes.data?.[0]
  const recentText: RecentText | null = recentTextData
    ? {
        id: recentTextData.id as string,
        title: recentTextData.title as string,
        preview: ((recentTextData.content as string) ?? '').slice(0, 200).trim(),
        progressPercent: 0, // TODO: 별도 progress 테이블 도입 시 갱신
        relativeTime: relativeTimeKo(new Date(recentTextData.created_at as string)),
        moduleLabel: '스크립트',
      }
    : null

  // 활동 매핑
  const activities: Activity[] = (activitiesRes.data ?? []).map((r) => ({
    id: r.id as string,
    module: r.module as Activity['module'],
    textTitle:
      (r.vocabularies as { texts?: { title?: string } } | null)?.texts?.title ?? '단어 학습',
    score: (r.is_correct ? 100 : 0) as number,
    relativeTime: relativeTimeKo(new Date(r.attempted_at as string)),
  }))

  return {
    userName,
    streak,
    reviewCount: reviewRes.count ?? 0,
    todayCount: todayRes.count ?? 0,
    accuracy,
    lastStudied,
    recentText,
    activities,
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────

function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0

  const dayKeys = new Set<string>()
  for (const d of dates) {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    dayKeys.add(key)
  }

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    if (dayKeys.has(key)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function relativeTimeKo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`
  return `${Math.floor(diffDay / 30)}달 전`
}
