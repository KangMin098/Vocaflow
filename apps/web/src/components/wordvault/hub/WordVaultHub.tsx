// apps/web/src/components/wordvault/hub/WordVaultHub.tsx
//
// WordVault 허브 v06.35 — iOS/iPadOS 감성 + 단어 관점 종합 포트폴리오.
//
// iOS HIG 핵심:
//   · 그레이 캔버스 (bg2) 위에 떠있는 흰 카드 (24px radius + soft shadow)
//   · 거대한 hero 숫자 + Activity Ring + 캡슐
//   · iOS Settings 인셋 그룹 list (탭 segment control)
//   · App Store 카드 가로 스크롤
//
// 6 Section 구조:
//   1. VaultIdentity        — Activity Ring + 거대 숫자 + 4 bucket + CTA
//   2. VocabularyLevelMap   — V-Level 캡슐 막대 + 트랙별 인셋 list
//   3. ResourcePortfolio    — 도서/스크립트/단어장 (세그먼트 + 인셋 list)
//   4. RecommendedBooks     — App Store 가로 스크롤 카드
//   5. NextStepList         — 추천 단어장 인셋 list + 컬러 type 캡슐
//   6. FlowStripe           — Stats 캡슐 + 28일 캡슐 막대

'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import type { HubStatsState } from '../hooks/useHubStats'
import { useFacetSummary } from '../hooks/useFacetSummary'
import { FacetProgressSection } from './FacetProgressSection'
import { FlowStripe } from './FlowStripe'
import { NextStepList } from './NextStepList'
import { RecommendedBooks } from './RecommendedBooks'
import { ResourcePortfolio } from './ResourcePortfolio'
import { VaultIdentity } from './VaultIdentity'
import { VocabularyLevelMap } from './VocabularyLevelMap'
import { WordVaultEmptyState } from './WordVaultEmptyState'

interface WordVaultHubProps {
  /**
   * 통계 상태 **전체**를 받는다 — 값만 받으면 "아직 못 셌다" 와 "세어보니 0" 을 구별할 수
   * 없고, 그 구별이 없어서 목업이 실수치 자리에 앉아 있었다.
   */
  stats: HubStatsState
}

const DEFAULT_DAILY_GOAL = 12

export function WordVaultHub({ stats }: WordVaultHubProps) {
  const [weekly, setWeekly] = useState<{ done: number; target: number } | null>(null)
  const facets = useFacetSummary()

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('daily_word_goal')
        .eq('user_id', user.id)
        .maybeSingle()
      const dailyGoal =
        (profile as { daily_word_goal: number | null } | null)?.daily_word_goal ?? DEFAULT_DAILY_GOAL
      const target = dailyGoal * 7

      const now = new Date()
      const day = now.getDay()
      const offset = day === 0 ? 6 : day - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - offset)
      monday.setHours(0, 0, 0, 0)
      const mondayStr = monday.toISOString().slice(0, 10)

      const { data: activity } = await supabase
        .from('daily_activity')
        .select('total_words')
        .eq('user_id', user.id)
        .gte('date', mondayStr)

      const done = (activity ?? []).reduce(
        (s: number, r: { total_words: number | null }) => s + (r.total_words ?? 0),
        0,
      )
      if (cancelled) return
      setWeekly({ done, target })
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ⚠️ 여기서 목업으로 폴백하지 않는다.
  //
  // 예전에는 `realStats?.total ?? words.length` 였고 `words` 의 초기값이 `MOCK_WORDS` 였다.
  // 그래서 통계 조회가 'ready' 에 닿지 못하면 **목업 13개가 학습자 본인의 수치처럼** 남았다
  // (실측 2026-08-15: 실제 252개인 계정이 "13 단어 · 확실2 익숙1 회복2 신규8" 을 보고 있었다).
  // 주석은 "FOUC 회피" 라고만 적혀 있었고 실패를 말하지 않았다 — 이 프로젝트가 처방
  // `unavailable` 플래그로 이미 한 번 싸운 **조용한 실패**와 같은 계열이다.
  //
  // 규칙: 못 세었으면 못 세었다고 말한다. 그럴듯한 숫자를 지어내지 않는다.
  if (stats.status === 'loading') {
    return (
      <div
        aria-busy="true"
        className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 py-6 md:px-6 md:py-8"
      >
        <div className="h-[188px] animate-pulse rounded-ios-2xl bg-[var(--bg)] shadow-ios-1" />
        <div className="h-[112px] animate-pulse rounded-ios-2xl bg-[var(--bg)] shadow-ios-1" />
        <span className="sr-only">단어장 통계를 불러오는 중</span>
      </div>
    )
  }

  if (stats.status !== 'ready') {
    // 실패를 침묵하지 않는다. Empathetic Feedback — 학습자 잘못이 아니라는 것과
    // 지금 무엇을 해도 되는지를 말한다.
    return (
      <div className="mx-auto max-w-[820px] px-4 py-10 md:px-6">
        <p
          role="status"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 text-center font-body text-[13.5px] leading-[1.7] text-[var(--t2)] shadow-ios-1 [word-break:keep-all]"
        >
          {stats.status === 'unauthenticated'
            ? '로그인하면 내 단어장이 여기 나타나요.'
            : '지금 단어장을 세지 못했어요. 잠시 뒤 다시 열어 주세요 — 단어가 사라진 건 아니에요.'}
        </p>
      </div>
    )
  }

  const { buckets, total, collectionsCount: collections, accumulatedDays } = stats.data

  if (total === 0) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 md:px-6 md:py-14">
        <WordVaultEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      {/* Section 1 — Identity Hero: 자산 + V-Level + 4 bucket + 주간 목표 + 단일 CTA */}
      <VaultIdentity
        total={total}
        buckets={buckets}
        collections={collections}
        accumulatedDays={accumulatedDays}
        weeklyDone={weekly?.done ?? 0}
        weeklyTarget={weekly?.target ?? DEFAULT_DAILY_GOAL * 7}
      />

      {/* Section 2 — Vocabulary Level Map: V-Level 분포 + i+1 zone + 트랙 */}
      <VocabularyLevelMap />

      {/* Section 3 — 면(facet) 상태 + 가장 뒤처진 면 하나 (설계안 §2.3).
          레벨 맵이 "어디까지 왔나" 라면 이쪽은 "어느 쪽으로 아는가" 다.
          준비 전/실패 시에는 렌더하지 않는다 — 빈 카드가 자리만 차지하는 것보다 낫다. */}
      {facets.status === 'ready' && facets.data.total > 0 && (
        <FacetProgressSection summary={facets.data} />
      )}

      {/* Section 3 — Resource Portfolio: 도서 / 스크립트 / 공용 단어장 학습 이력 */}
      <ResourcePortfolio />

      {/* Section 4 — Recommended Books: i+1 권장 도서 4권 */}
      <RecommendedBooks />

      {/* Section 5 — Next Step (단어장 추천): recommend_word_sets_for_user */}
      <NextStepList />

      {/* Section 6 — Flow: 28일 sparkline + 마지막 활동 */}
      <FlowStripe />
    </div>
  )
}
