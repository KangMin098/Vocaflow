// apps/web/src/components/pairflip/PairFlipGameScreen.tsx
// 게임 화면 통합 — HUD + Grid + Feedback + Mascot + Progress
// 라우트가 */play 패턴이라 SessionFrame 의 isFullScreenRoute 도 적용됨 (사이드바·FlowNav 자동 숨김).

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useSessionProgress } from '@/components/layout/SessionFrame'
import { usePairFlipSession } from '@/hooks/usePairFlipSession'
import type { ContentRef } from '@/lib/content/content-ref'
import { recordGameScore } from '@/lib/scores/record-score'
import { flushPendingSession } from '@/lib/srs/flush-session'
import { useSrsFlushOnLeave } from '@/hooks/useSrsFlushOnLeave'
import { pushPendingResult } from '@/lib/srs/session-storage'

import type { PairFlipMockWord } from './mock-data'
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
  /** 실 단어 페어 (SRS 큐). 부족하면 hook 이 mock 폴백 — 그 경우 영속화 skip. */
  pairs?: PairFlipMockWord[]
  /**
   * 무엇으로 학습했나 — `?set=`/`?text=` 계획 launch 면 그 자료, 없으면 내 복습 큐.
   * mock 폴백 판에는 실리지 않는다(아래 onComplete 참조).
   */
  content?: ContentRef
}

export function PairFlipGameScreen({ config, pairs, content }: GameScreenProps) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'fail' | null; combo: number }>({
    type: null,
    combo: 0,
  })

  // 판을 다 못 맞추고 떠나도 그때까지 맞춘 짝의 평가는 남는다 — 서버가 멱등하다.
  useSrsFlushOnLeave()

  const onComplete = useRef((result: PairFlipResultData) => {
    // 실 페어(레벨 pairCount 이상) 사용 시에만 매칭 결과를 FSRS 큐에 적재 → flush(서버 권위 재계산).
    // mock 폴백이면 word lookup 이 사용자 vocab 과 매칭되지 않아 skip 되므로 push 자체를 생략.
    const levelPairCount = PAIRFLIP_LEVELS.find((l) => l.id === config.level)?.pairCount ?? 0
    const usingReal = !!pairs && pairs.length >= levelPairCount
    if (usingReal) {
      for (const pr of result.pairResults) {
        pushPendingResult({
          cardId: pr.pairId, // = vocabularies.id
          word: pr.word,
          cardUpdate: {}, // flush 가 서버에서 재계산 — cardUpdate 미사용
          rating: pr.fsrsRating,
          reviewedAt: new Date(pr.matchedAt).toISOString(),
          module: 'pairflip',
        })
      }
      void flushPendingSession()
    }

    // 게임 점수 기록 (scores) — 실/mock 페어 무관 게임 성과. fire-and-forget(흐름 비차단).
    //
    // 예전엔 여기서 supabase 로 **직접 INSERT** 했다. 그래서 recordGameScore 가 중앙에서 붙여주는
    // content_ref 3컬럼을 못 받았고, PairFlip 세션은 "어떤 자료로 했는지 모르는 기록" 으로만
    // 남았다(실측: pairflip 2행 모두 content_type NULL). 다른 6개 경로가 다 중앙 헬퍼를
    // 쓰는데 이 하나만 우회하고 있었다 — 새 컬럼이 생길 때 조용히 빠지는 건 언제나 이 경로다.
    void recordGameScore({
      module: 'pairflip',
      score: result.score,
      totalQuestions: result.totalPairs,
      correctCount: result.matchedPairs,
      accuracy:
        result.totalPairs > 0 ? Math.round((result.matchedPairs / result.totalPairs) * 100) : 0,
      durationSeconds: Math.round(result.durationMs / 1000),
      // mock 폴백이면 귀속시키지 않는다 — 그 판은 그 자료의 단어로 한 것이 아니다.
      // (아케이드가 demo 스코프를 귀속에서 빼는 것과 같은 규칙. 귀속시키면 "이 도서로
      //  학습했다" 는 집계가 실제로 만난 적 없는 단어까지 세게 된다.)
      ...(usingReal && content ? { content } : {}),
      metadata: {
        maxCombo: result.maxCombo,
        hintsUsed: result.hintsUsed,
        totalAttempts: result.totalAttempts,
        level: result.level,
        mode: result.mode,
        phase: result.phase,
        // 귀속을 뺀 이유를 남긴다 — 나중에 "왜 이 행만 자료 미상인가" 를 답할 수 있게.
        mockFallback: !usingReal,
      },
    })

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
      pairs,
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
