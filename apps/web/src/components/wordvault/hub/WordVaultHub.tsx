// apps/web/src/components/wordvault/hub/WordVaultHub.tsx
//
// WordVault 허브 v06.35 패치 — 학습 진행 정보 "한눈에"
//
// 변경 (이전 v06.35 4 zone → 3 zone):
//   · AssetGrid 제거 (collection grid 불필요 — 사용자는 "학습 정보" 가 알고 싶음)
//   · VaultIdentity 강화 — V-Level 메타 + 4 bucket 가로 막대 + 단일 CTA
//   · FlowStripe / NextStepList 그대로 (각각 추세·다음 단계)
//
// 디자인 톤: Editorial monochrome — 회색 + --p 액센트만.

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
import { VaultIdentity } from './VaultIdentity'
import { WordVaultEmptyState } from './WordVaultEmptyState'

interface WordVaultHubProps {
  /** mock 단어 (개발/비로그인 fallback) */
  words: WordItem[]
  /** Phase 2 실 데이터 — useHubStats 결과 */
  realStats?: HubStats | null
}

const DEFAULT_DAILY_GOAL = 12

export function WordVaultHub({ words, realStats }: WordVaultHubProps) {
  // 주간 목표 + 주간 완료
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
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10 md:px-6 md:py-14">
        <WordVaultEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* Zone 1 — Mastery Hero: 큰 숫자 + V-Level + 4 bucket 가로 비교 + 단일 CTA + 주간 목표 */}
      <VaultIdentity
        total={total}
        buckets={buckets}
        collections={collections}
        accumulatedDays={accumulatedDays}
        weeklyDone={weekly?.done ?? 0}
        weeklyTarget={weekly?.target ?? DEFAULT_DAILY_GOAL * 7}
      />

      {/* Zone 2 — Flow: 28일 sparkline + 평균/활동/총합 + 마지막 학습 */}
      <FlowStripe />

      {/* Zone 3 — Next Step: 진단 기반 추천 (V-Level 다지기 · 한 단계 위 · 복습 · 트랙) */}
      <NextStepList />
    </div>
  )
}
