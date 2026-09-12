// apps/web/src/lib/learner/growth-stats.ts
//
// 성장 셸 통계 — Sidebar/FlowNav(전역 셸) + /dashboard(MemoryStatus·WeeklyHeatmap) 공용 실데이터.
// 목업 상수(streak=23·12, 기억상태 612/142/58/35, sin() 가짜 활동) 전면 대체 (런타임 검증 v06.135).
//
// React cache() — 같은 요청 안에서 layout 과 page 가 각각 호출해도 쿼리는 1회.
// 기억 4상태는 SSoT getMemoryState()(R(t) 동적 계산)로 산출 — DB 저장 금지 규칙 준수.

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getMemoryState } from '@/lib/srs/state'
import { pagedSelect } from '@/lib/supabase/paged-select'
import { createClient } from '@/lib/supabase/server'

// 연속일 규칙은 순수 모듈이 소유한다 — 클라이언트·테스트가 서버 코드를 끌어오지 않도록.
import { computeStreak, type ActivityDayDto } from './growth-math'
// 망각 예보 — **추가 쿼리 없이** 아래에서 이미 읽는 vocabularies 행을 한 번 더 접는다.
import { forecastMemory, type MemoryForecast } from './memory-forecast'

export { computeStreak, type ActivityDayDto } from './growth-math'

export interface MemoryDistribution {
  stable: number
  shaky: number
  risk: number
  fresh: number
}

export interface GrowthStats {
  /**
   * 연속 학습일 — **앱 전체의 단일 정의**.
   *
   * ⚠️ `user_stats.current_streak` 을 읽지 않는다. 그 컬럼은 갱신 경로가 불분명해
   * 실제 활동과 어긋난다(실측 2026-08-15: 8일 연속 활동 중인 계정에 **3** 이 들어 있었다).
   * 같은 화면에 연속일이 세 종류로 뜬 원인 중 하나였다 — 띠 3일 / 히어로 3일 / 히트맵 0일.
   * 지금은 `daily_activity` 실적에서 직접 센다. 셸이 어차피 28일치를 이미 읽으므로
   * 추가 쿼리가 없다.
   */
  streak: number
  memory: MemoryDistribution
  /** 오늘 포함 최근 28일 — 빈 날은 0으로 채움 (오름차순) */
  days28: ActivityDayDto[]
  /** 최근 7일 중 학습한 날 수 */
  weekDays: number
  /**
   * 앞으로 7일의 기억 예보 — R(t) 를 **시간축으로** 푼 결과.
   *
   * 같은 `vocabularies` 행에서 나온다(추가 쿼리 0). 4색 분포가 "지금 한 점" 이라면
   * 이것은 그 점이 어디로 가는지다. 학습자가 "왜 내일이 아니라 오늘인가" 를 묻는
   * 유일한 근거이므로 셸이 쓴다(`wayfinder.ts` Q5).
   */
  forecast: MemoryForecast
}

function kstDateIso(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

export const fetchGrowthStats = cache(async (): Promise<GrowthStats | null> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const lc = client as unknown as SupabaseClient
  const since = kstDateIso(-27)

  // `user_stats` 는 더 이상 읽지 않는다 — streak 은 daily_activity 실적에서 센다(computeStreak).
  const [vocabRows, { data: activityRows }] = await Promise.all([
    // ⚠️ 여기 있던 `.limit(10000)` 은 **효과가 없었다** — PostgREST 는 1,000행에서 끊는다
    //    (실측 2026-08-30: 10,000 을 요청해도 1,000행이 온다. 오류가 아니다).
    //    이 분포는 **상태 띠의 "다시 볼"·"새 단어"** 가 되어 모든 화면 최상단에 뜨므로,
    //    잘리면 학습자는 어디를 봐도 적게 세어진 수를 본다. 이미 1,945행인 계정이 있다.
    pagedSelect<{ stability: number | null; last_review_at: string | null }>(
      (from, to) =>
        lc
          .from('vocabularies')
          .select('stability, last_review_at')
          .eq('user_id', user.id)
          .range(from, to),
      'growth-stats vocabularies',
    ),
    lc
      .from('daily_activity')
      // `total_reviews` 를 빼면 학습한 날의 절반이 안 보인다 — `growth-math` 의 DTO 주석 참조
      .select('date, total_minutes, total_words, total_reviews')
      .eq('user_id', user.id)
      .gte('date', since)
      .order('date', { ascending: true }),
  ])

  // ── 기억 4상태 (R(t) 동적 계산 — SSoT) ──
  const memory: MemoryDistribution = { stable: 0, shaky: 0, risk: 0, fresh: 0 }
  const now = new Date()
  const cards = (vocabRows ?? []) as Array<{ stability: number | null; last_review_at: string | null }>
  for (const r of cards) {
    const state = getMemoryState(
      {
        difficulty: 0,
        stability: r.stability ?? 0,
        lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
      } as Parameters<typeof getMemoryState>[0],
      now,
    )
    if (state === 'new') memory.fresh += 1
    else memory[state] += 1
  }

  // ── 28일 활동 (빈 날 0 채움) ──
  const byDate = new Map<string, { minutes: number; words: number; reviews: number }>()
  for (const r of (activityRows ?? []) as Array<{
    date: string
    total_minutes: number | null
    total_words: number | null
    total_reviews: number | null
  }>) {
    byDate.set(r.date, {
      minutes: r.total_minutes ?? 0,
      words: r.total_words ?? 0,
      reviews: r.total_reviews ?? 0,
    })
  }
  const days28: ActivityDayDto[] = []
  for (let i = 27; i >= 0; i--) {
    const d = kstDateIso(-i)
    const row = byDate.get(d)
    days28.push({
      date: d,
      minutes: row?.minutes ?? 0,
      words: row?.words ?? 0,
      reviews: row?.reviews ?? 0,
    })
  }

  // 이번 주 학습일도 같은 자로 센다 — 여기만 빠뜨리면 셸 띠와 연속 배지가 서로 다른 말을 한다
  const weekDays = days28.slice(-7).filter((d) => d.minutes > 0 || d.words > 0 || d.reviews > 0).length

  return {
    streak: computeStreak(days28),
    memory,
    days28,
    weekDays,
    // 같은 `cards` 배열을 8번 더 접을 뿐 — 네트워크 왕복은 늘지 않는다.
    forecast: forecastMemory(cards, now, 7),
  }
})

