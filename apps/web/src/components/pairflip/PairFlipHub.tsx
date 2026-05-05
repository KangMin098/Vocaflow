// apps/web/src/components/pairflip/PairFlipHub.tsx
// PairFlip Hub — ModuleHero (Best 통계) + StartScreen 통합
// Flashcard Hub 패턴 정합 (한 페이지에 통계 + 시작 카드)

'use client'

import { Shuffle } from 'lucide-react'

import { ModuleHero } from '@/components/hub/ModuleHero'

import { PairFlipStartScreen } from './PairFlipStartScreen'

// Phase 2: Supabase scores 테이블에서 fetch
const MOCK_STATS = {
  bestScore: 0,
  maxCombo: 0,
  gamesPlayed: 0,
}

export function PairFlipHub() {
  const isCold = MOCK_STATS.gamesPlayed === 0
  const note = isCold
    ? '첫 게임을 시작해 보세요'
    : `Best ${MOCK_STATS.bestScore.toLocaleString()} · 최고 콤보 ×${MOCK_STATS.maxCombo}`

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
        <ModuleHero
          eyebrow="익히기 · 짝맞추기"
          title="🎴 PairFlip"
          note={note}
          gradient={{ from: '#1E3A8A', to: '#1E1B4B' }}
          icon={Shuffle}
          stats={[
            {
              label: 'Best',
              value: MOCK_STATS.bestScore,
              unit: '점',
              emphasis: true,
            },
            {
              label: '최고 콤보',
              value: MOCK_STATS.maxCombo > 0 ? `×${MOCK_STATS.maxCombo}` : '—',
            },
            {
              label: '게임',
              value: MOCK_STATS.gamesPlayed,
              unit: '회',
            },
          ]}
        />
      </div>

      <PairFlipStartScreen />
    </div>
  )
}
