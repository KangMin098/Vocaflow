// apps/web/src/components/pairflip/PairFlipResultScreen.tsx
// 결과 화면 통합

'use client'

import { Flame, Target, Timer } from 'lucide-react'
import { useEffect } from 'react'

import { saveLearningRecords } from '@/lib/pairflip/learning-records'

import { getResultCopy, PAIRFLIP_LEVELS } from './constants'
import { PairFlipMascot } from './PairFlipMascot'
import { PairFlipNextActionCard } from './PairFlipNextActionCard'
import { PairFlipPairsList } from './PairFlipPairsList'
import { PairFlipScoreRing } from './PairFlipScoreRing'
import type { PairFlipResultData } from './types'

interface ResultScreenProps {
  result: PairFlipResultData
}

export function PairFlipResultScreen({ result }: ResultScreenProps) {
  const accuracy = Math.round((result.matchedPairs / result.totalPairs) * 100)
  const copy = getResultCopy(accuracy)
  const levelMeta = PAIRFLIP_LEVELS.find((l) => l.id === result.level)
  const mascotMood = accuracy >= 90 ? 'clap' : accuracy >= 70 ? 'happy' : 'cheer'

  const minutes = Math.floor(result.durationMs / 60000)
  const seconds = Math.floor((result.durationMs % 60000) / 1000)
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

  useEffect(() => {
    void saveLearningRecords(result)
  }, [result])

  return (
    <div
      className="relative min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, #FFFBF5 0%, #FEF6E1 55%, #FDE9C2 100%)',
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10 md:px-6 md:py-14">
        {/* Hero */}
        <header className="flex flex-col items-center gap-4 rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-md)] md:p-8">
          <PairFlipMascot mood={mascotMood} size={96} />
          <PairFlipScoreRing accuracy={accuracy} score={result.score} />
          <div className="text-center">
            <h1 className="font-display text-[24px] font-[800] text-[var(--t1)]">
              {copy.title}
            </h1>
            <p className="mt-1 font-body text-[14px] text-[var(--t2)]">{copy.sub}</p>
          </div>
        </header>

        {/* 통계 3분할 */}
        <section
          aria-label="게임 통계"
          className="grid grid-cols-3 gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 md:p-4"
        >
          <Stat
            icon={<Timer size={16} aria-hidden className="text-[var(--p)]" />}
            label="시간"
            value={timeLabel}
          />
          <Stat
            icon={<Target size={16} aria-hidden className="text-[#EC4899]" />}
            label="매칭"
            value={`${result.matchedPairs}/${result.totalPairs}`}
          />
          <Stat
            icon={<Flame size={16} aria-hidden className="text-[#F59E0B]" />}
            label="최고 콤보"
            value={`×${result.maxCombo}`}
          />
        </section>

        {/* 학습 단어 리스트 */}
        <PairFlipPairsList pairs={result.pairResults} />

        {/* 다음 액션 */}
        <PairFlipNextActionCard accuracy={accuracy} />

        {levelMeta && (
          <p className="text-center font-body text-[11px] text-[var(--t3)]">
            난이도: {levelMeta.label} · {levelMeta.cardCount}장 · 시도 {result.totalAttempts}회
            {result.hintsUsed > 0 && ` · 힌트 ${result.hintsUsed}회`}
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] py-2">
      <div className="flex items-center gap-1">
        {icon}
        <span className="font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
          {label}
        </span>
      </div>
      <span className="font-display text-[18px] font-[800] tabular-nums text-[var(--t1)]">
        {value}
      </span>
    </div>
  )
}
