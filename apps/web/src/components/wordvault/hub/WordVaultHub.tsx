// apps/web/src/components/wordvault/hub/WordVaultHub.tsx
//
// WordVault 허브 v6 (v06.20) — Hybrid: v06.19 5 Tier + v06.14 BookShelf/LearningDimension/WordPeek
//
// v5 → v6 변경:
//   - AssetCollectionsRow → BookShelfSection (5 Book Type 으로 확장)
//   - LearningDimensionSection 신규 (Tier 추가)
//   - WordPeekStrip 신규 (데스크톱 전용 푸터)
//   - v06.17 Asset/Learning boundary 보존 — ModeEntryGrid 부활 X
//
// 6 Tier IA:
//   Tier 1: ModuleHero + VaultBar       — Identity (총·컬렉션·누적)
//   Tier 2: BookShelfSection            — Source/Level/Smart pivot (출처·레벨·스마트 큐)
//   Tier 3: CEFRDistribution            — Level facet 6 막대
//   Tier 4: FindAndMore                 — 검색 진입 + 보조 작업
//   Tier 5: LearningDimensionSection    — module_history 3그룹 (어떻게 익혔나)
//   Tier 6: MemoryDecayDistribution + TrendIndicator — State pivot + 추세
//   Footer (md+): WordPeekStrip         — 최근 만난 단어 5개

'use client'

import { Library } from 'lucide-react'
import { useMemo } from 'react'

import { ModuleHero } from '@/components/hub/ModuleHero'
import { getMemoryState } from '@/lib/srs'
import type { MemoryState } from '@/lib/srs'
import { groupByMastery } from '@/lib/wordvault/mastery'
import type { HubStats } from '../hooks/useHubStats'

import {
  MOCK_ACCUMULATED_DAYS,
  MOCK_BOOKS,
  MOCK_RECENT_WORDS,
  MOCK_TREND,
  tallyCEFR,
} from '../mock-data'
import type { WordItem } from '../types'

import { BookShelfSection } from './BookShelfSection'
import { CEFRDistribution } from './CEFRDistribution'
import { FindAndMore } from './FindAndMore'
import { LearningDimensionSection } from './LearningDimensionSection'
import { MemoryDecayDistribution } from './MemoryDecayDistribution'
import { RecommendedSetsSection } from './RecommendedSetsSection'
import { VaultBar } from './VaultBar'
import { WordPeekStrip } from './WordPeekStrip'
import { WordVaultEmptyState } from './WordVaultEmptyState'

interface WordVaultHubProps {
  words: WordItem[]
  /**
   * Phase 2 — Hero/VaultBar 실 데이터 override.
   * 제공 시 총 단어/컬렉션/누적/4-bucket 모두 DB 값으로 표시.
   * 미제공 시 mock(words) 기반으로 계산 (개발용 / 비로그인 fallback).
   */
  realStats?: HubStats | null
}

export function WordVaultHub({ words, realStats }: WordVaultHubProps) {
  const mockCounts = useMemo(() => {
    const c: Record<MemoryState, number> = { stable: 0, shaky: 0, risk: 0, new: 0 }
    for (const w of words) {
      const state = w.srs ? getMemoryState(w.srs) : 'new'
      c[state] += 1
    }
    return c
  }, [words])

  // 실 데이터 있으면 우선 — Hero/VaultBar 만 적용
  const counts = realStats?.buckets ?? mockCounts
  const totalCount = realStats?.total ?? words.length
  const collectionsCount = realStats?.collectionsCount ?? MOCK_BOOKS.filter((b) => !b.isLocked).length
  const accumulatedDays = realStats?.accumulatedDays ?? MOCK_ACCUMULATED_DAYS

  const cefrBuckets = useMemo(() => tallyCEFR(words), [words])

  // mock 단어로 mastery 그룹 산출 (Phase 2: DB module_history 직접 사용)
  const masteryGroups = useMemo(
    () =>
      groupByMastery(
        words.map((w) => ({ moduleHistory: w.srs?.moduleHistory ?? [] })),
      ),
    [words],
  )

  // 실 데이터가 ready 이고 단어 0개 → EmptyState (mock 폴백 X)
  // 실 데이터 미제공(undefined) 인데 mock 도 비어 있으면 EmptyState
  const shouldShowEmpty =
    realStats !== undefined ? (realStats?.total ?? 0) === 0 : words.length === 0
  if (shouldShowEmpty) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
        <WordVaultEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* Tier 1: Hero + VaultBar — Identity */}
      <ModuleHero
        eyebrow="단어장 · 내 어휘 자산"
        title="📖 내 어휘 자산"
        note={
          counts.new > 0
            ? `최근 ${counts.new.toLocaleString()}개 새 단어 · ${accumulatedDays}일 누적`
            : counts.shaky > 0
              ? `흔들리는 단어 ${counts.shaky.toLocaleString()}개 · ${accumulatedDays}일 누적`
              : `${accumulatedDays}일 동안 ${totalCount.toLocaleString()}개를 모았어요`
        }
        gradient={{ from: '#6366F1', to: '#3730A3' }}
        icon={Library}
        stats={[
          { label: '총 단어', value: totalCount, unit: '개', emphasis: true },
          { label: '단어장', value: collectionsCount, unit: '권' },
          { label: '누적', value: accumulatedDays, unit: '일' },
        ]}
        bottomSlot={
          <VaultBar
            stable={counts.stable}
            shaky={counts.shaky}
            risk={counts.risk}
            new={counts.new}
            onDark
          />
        }
      />

      {/* Tier 2 (신규): VRL Placement 추천 — 진단 기반 맞춤 단어장 또는 진단 CTA */}
      <RecommendedSetsSection />

      {/* Tier 3 (기존 Tier 2): BookShelf — 실 데이터 우선 (구독 공용 단어장 + 스크립트), 미제공 시 mock */}
      <BookShelfSection books={realStats?.books ?? MOCK_BOOKS} />

      {/* Tier 3: Level pivot — CEFR 6단계 분포 */}
      <CEFRDistribution buckets={cefrBuckets} />

      {/* Tier 4: Find & More — 검색 진입 + 보조 작업 */}
      <FindAndMore />

      {/* Tier 5: Learning Dimension — module_history 3그룹 */}
      <LearningDimensionSection groups={masteryGroups} />

      {/* Tier 6: State pivot + 추세 — Memory health */}
      <MemoryDecayDistribution words={words} trend={MOCK_TREND} />

      {/* Footer (데스크톱 전용) — Word Peek */}
      <WordPeekStrip words={MOCK_RECENT_WORDS} />
    </div>
  )
}
