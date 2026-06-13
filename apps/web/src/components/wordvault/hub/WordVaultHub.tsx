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
import { getMemoryState } from '@/lib/srs'
import type { MemoryState } from '@/lib/srs'

import { MOCK_BOOKS } from '../mock-data'
import type { WordItem } from '../types'

import type { HubStats } from '../hooks/useHubStats'
import { FlowStripe } from './FlowStripe'
import { NextStepList } from './NextStepList'
import { RecommendedBooks } from './RecommendedBooks'
import { ResourcePortfolio } from './ResourcePortfolio'
import { VaultIdentity } from './VaultIdentity'
import { VocabularyLevelMap } from './VocabularyLevelMap'
import { WordVaultEmptyState } from './WordVaultEmptyState'

interface WordVaultHubProps {
  words: WordItem[]
  realStats?: HubStats | null
}

const DEFAULT_DAILY_GOAL = 12

export function WordVaultHub({ words, realStats }: WordVaultHubProps) {
  const [weekly, setWeekly] = useState<{ done: number; target: number } | null>(null)

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

  const mockCounts: Record<MemoryState, number> = { stable: 0, shaky: 0, risk: 0, new: 0 }
  for (const w of words) {
    const state = w.srs ? getMemoryState(w.srs) : 'new'
    mockCounts[state] += 1
  }

  const buckets = realStats?.buckets ?? mockCounts
  const total = realStats?.total ?? words.length
  const collections = realStats?.collectionsCount ?? MOCK_BOOKS.filter((b) => !b.isLocked).length
  const accumulatedDays = realStats?.accumulatedDays ?? 0

  const shouldShowEmpty =
    realStats !== undefined ? (realStats?.total ?? 0) === 0 : words.length === 0

  if (shouldShowEmpty) {
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
