// apps/web/src/lib/scores/recent.ts
//
// 모듈 허브의 "최근 기록" 실데이터.
//
// 왜 생겼나:
//   /wordblitz · /spellforge 허브가 최근 기록을 상수로 갖고 있었다
//   (오늘 1240점 콤보 8 · 어제 980점 …). 학습자가 한 번도 해보지 않아도 그 숫자가 보였다.
//   실측(2026-08-12): scores 에 spellforge **0행** · wordblitz **1행**. 즉 화면이 보여주던
//   "최근 4회" 는 만들어진 적조차 없는 기록이었다.
//
// **combo 를 넣지 않는 이유**: scores.metadata 실측 키는 {demo, scope, wrong, captured} 뿐이다.
//   콤보는 어디에도 저장되지 않으므로 표시할 방법이 없다 — 넣으려면 먼저 기록해야 한다.
//   (허브에서 콤보 열을 지운 것은 디자인 축소가 아니라, 없는 데이터를 지우는 것이다.)

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

export interface RecentScore {
  /** '오늘' · '어제' · 'N일 전' — KST 날짜 경계 기준 */
  date: string
  score: number
  /** 0~100. NULL 이면 null (실측 48행 모두 채워져 있었지만 스키마는 nullable) */
  accuracy: number | null
}

const KST_OFFSET_MS = 9 * 3_600_000

/** UTC ISO → KST 기준 일수 (1970-01-01 KST = 0). 날짜 경계를 KST 로 맞추기 위한 정수화. */
function kstDayIndex(iso: string): number {
  return Math.floor((new Date(iso).getTime() + KST_OFFSET_MS) / 86_400_000)
}

/**
 * 상대 날짜 라벨. `now` 는 테스트 주입용 — 인자 없이 쓰면 실제 현재.
 * 시각 차가 아니라 **KST 날짜 경계** 로 센다: 23:50 과 다음날 00:10 은 "20분 전" 이 아니라 "어제" 다.
 */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const days = kstDayIndex(now.toISOString()) - kstDayIndex(iso)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  return `${days}일 전`
}

/**
 * 이 모듈의 최근 세션 기록 — 최신순.
 * 조회 실패는 빈 배열로 삼키지 않고 throw 한다. "기록 없음" 과 "못 불러옴" 은 다른 사실이고,
 * 전자로 위장하면 처음 온 학습자와 장애를 구별할 수 없다.
 */
export async function fetchRecentScores(
  client: SupabaseClient<Database>,
  userId: string,
  module: Database['public']['Enums']['module_id'],
  limit = 4,
): Promise<RecentScore[]> {
  const { data, error } = await client
    .from('scores')
    .select('score, accuracy, created_at')
    .eq('user_id', userId)
    .eq('module', module)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  const now = new Date()
  return ((data ?? []) as Array<{ score: number; accuracy: number | null; created_at: string | null }>).map(
    (r) => ({
      // created_at 은 스키마상 nullable — 없으면 날짜를 지어내지 않고 '기록' 으로 둔다.
      date: r.created_at ? relativeDayLabel(r.created_at, now) : '기록',
      score: r.score,
      accuracy: r.accuracy,
    }),
  )
}

/**
 * 이 모듈 최고 점수 — 기록이 없으면 null.
 * null 을 0 으로 바꾸지 않는다: "0점을 받았다" 와 "아직 안 해봤다" 는 다른 사실이고,
 * 허브가 `best ?? 0` 으로 뭉개면 처음 온 학습자에게 0점 기록이 있다고 말하게 된다.
 */
export async function fetchBestScore(
  client: SupabaseClient<Database>,
  userId: string,
  module: Database['public']['Enums']['module_id'],
): Promise<number | null> {
  const { data, error } = await client
    .from('scores')
    .select('score')
    .eq('user_id', userId)
    .eq('module', module)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as { score: number } | null)?.score ?? null
}
