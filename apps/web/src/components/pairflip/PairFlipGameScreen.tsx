// apps/web/src/components/pairflip/PairFlipGameScreen.tsx
// 게임 화면 통합 — HUD + Grid + Feedback + Mascot + Progress
// 라우트가 */play 패턴이라 SessionFrame 의 isFullScreenRoute 도 적용됨 (사이드바·FlowNav 자동 숨김).

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useSessionProgress } from '@/components/layout/SessionFrame'
import { usePairFlipSession } from '@/hooks/usePairFlipSession'

import { PAIRFLIP_LEVELS, STORAGE_KEYS } from './constants'
import { PairFlipFeedback } from './PairFlipFeedback'
import { PairFlipGrid } from './PairFlipGrid'
import { PairFlipHUD } from './PairFlipHUD'
import { PairFlipMascot } from './PairFlipMascot'
import { PairFlipProgress } from './PairFlipProgress'
import type {
  PairFlipConfig,
  PairFlipResultData,
} from './types'

interface GameScreenProps {
  config: PairFlipConfig
}

export function PairFlipGameScreen({ config }: GameScreenProps) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'fail' | null; combo: number }>({
    type: null,
    combo: 0,
  })

  const onComplete = useRef((result: PairFlipResultData) => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.result, JSON.stringify(result))
    } catch {
      /* noop */
    }
    // 약간의 지연으로 마지막 매칭 애니메이션 완료 후 이동
    setTimeout(() => {
      router.replace('/pairflip/results')
    }, 1400)
  }).current

  const { session, config: levelConfig, remainingTime, handleCardClick, useHint } =
    usePairFlipSession({
      level: config.level,
      mode: config.mode,
      onComplete,
    })

  // ── 리소스 컨텍스트 + 진행도를 SessionFrame 셸에 주입 ─────────
  // Phase 2: WordVault 컬렉션 연동 시 resource label/position 동적 반영
  const { setProgress } = useSessionProgress()
  useEffect(() => {
    const lvl = PAIRFLIP_LEVELS.find((l) => l.id === config.level)
    setProgress({
      current: session.matchedPairs,
      total: levelConfig.pairCount,
      resource: {
        type: 'vocab',
        label: '내 단어 자산',
        position: lvl ? `${lvl.label} · ${lvl.cardCount}장` : undefined,
        href: '/wordvault',
      },
    })
    return () => setProgress(null)
  }, [config.level, session.matchedPairs, levelConfig.pairCount, setProgress])

  // phase 변화에 따른 feedback 트리거
  const prevPhaseRef = useRef(session.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (prev !== 'matched' && session.phase === 'matched') {
      setFeedback({ type: 'success', combo: session.combo })
    } else if (prev !== 'mismatched' && session.phase === 'mismatched') {
      setFeedback({ type: 'fail', combo: 0 })
    }
    prevPhaseRef.current = session.phase
  }, [session.phase, session.combo])

  // feedback 자동 reset
  useEffect(() => {
    if (feedback.type) {
      const t = setTimeout(() => setFeedback({ type: null, combo: 0 }), 1100)
      return () => clearTimeout(t)
    }
  }, [feedback.type])

  const mascotMood = useMemo(() => {
    if (session.phase === 'matched' && session.combo >= 5) return 'cheer' as const
    if (session.phase === 'matched') return 'happy' as const
    return 'idle' as const
  }, [session.phase, session.combo])

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          'linear-gradient(180deg, #FFFBF5 0%, #FEF6E1 55%, #FDE9C2 100%)',
      }}
    >
      <PairFlipHUD
        remainingTime={remainingTime}
        totalTime={levelConfig.timeLimit}
        score={session.score}
        combo={session.combo}
        hintsUsed={session.hintsUsed}
        onUseHint={useHint}
      />

      <main className="flex-1 px-3 py-6 md:px-6 md:py-10">
        <PairFlipGrid
          cards={session.cards}
          gridCols={levelConfig.gridCols}
          onCardClick={handleCardClick}
        />
      </main>

      {/* 우하단 마스코트 */}
      <div className="pointer-events-none fixed bottom-16 right-4 z-20">
        <PairFlipMascot mood={mascotMood} size={72} />
      </div>

      <PairFlipFeedback type={feedback.type} combo={feedback.combo} />

      <PairFlipProgress
        matchedPairs={session.matchedPairs}
        totalPairs={levelConfig.pairCount}
      />
    </div>
  )
}
