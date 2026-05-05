// apps/web/src/components/pairflip/PairFlipHUD.tsx
// 상단 sticky bar — 타이머 / 점수 / 콤보 / 힌트

'use client'

import { Lightbulb, Sparkles, Timer, Trophy } from 'lucide-react'

interface HUDProps {
  remainingTime: number
  totalTime: number
  score: number
  combo: number
  hintsUsed: number
  hintLimit?: number
  onUseHint: () => void
}

export function PairFlipHUD({
  remainingTime,
  totalTime: _totalTime,
  score,
  combo,
  hintsUsed,
  hintLimit = 2,
  onUseHint,
}: HUDProps) {
  const isUrgent = remainingTime < 10
  const minutes = Math.floor(remainingTime / 60)
  const seconds = remainingTime % 60
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

  const comboTier =
    combo >= 7 ? 'rainbow' : combo >= 5 ? 'purple' : combo >= 2 ? 'pink' : 'none'

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[var(--bd)] bg-[var(--bg)]/95 px-4 backdrop-blur md:px-6"
    >
      {/* 좌: 타이머 */}
      <div
        className={`flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5 ${
          isUrgent
            ? 'animate-pf-pulse bg-[var(--error-light)] text-[var(--error)]'
            : 'bg-[var(--bg2)] text-[var(--t1)]'
        }`}
        aria-label={`남은 시간 ${minutes}분 ${seconds}초`}
        aria-live="polite"
      >
        <Timer size={16} aria-hidden />
        <span className="font-mono text-[18px] font-[700] tabular-nums">{timeLabel}</span>
      </div>

      {/* 중: 점수 — 네이비 베이스 + 골드 텍스트 */}
      <div
        className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-1.5"
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1E1B4B 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.3)',
        }}
        aria-label={`현재 점수 ${score}점`}
        aria-live="polite"
      >
        <Trophy size={15} style={{ color: '#FCD34D' }} aria-hidden />
        <span
          className="font-display text-[20px] font-[800] tabular-nums"
          style={{ color: '#FCD34D' }}
        >
          {score.toLocaleString()}
        </span>
      </div>

      {/* 우: 콤보 + 힌트 */}
      <div className="flex shrink-0 items-center gap-1.5">
        <ComboBadge combo={combo} tier={comboTier} />

        <button
          type="button"
          onClick={onUseHint}
          disabled={hintsUsed >= hintLimit}
          aria-label={`힌트 사용 — 남은 ${hintLimit - hintsUsed}회`}
          className="inline-flex h-9 min-h-[36px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--warning-light)] hover:text-[#92400E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Lightbulb size={14} aria-hidden />
          <span className="font-mono tabular-nums">{hintLimit - hintsUsed}</span>
        </button>
      </div>

      <style jsx global>{`
        @keyframes pf-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.03);
          }
        }
        .animate-pf-pulse {
          animation: pf-pulse 1s ease-in-out infinite;
        }
      `}</style>
    </header>
  )
}

function ComboBadge({
  combo,
  tier,
}: {
  combo: number
  tier: 'none' | 'pink' | 'purple' | 'rainbow'
}) {
  if (combo < 2) return null

  // editorial: 단계별 골드 강도 변화 (성숙)
  const cls = 'text-[#FCD34D]'
  const style =
    tier === 'rainbow'
      ? {
          background:
            'linear-gradient(135deg, #B45309 0%, #F59E0B 50%, #FCD34D 100%)',
          boxShadow: '0 0 0 1px rgba(252, 211, 77, 0.6), 0 4px 12px rgba(180, 83, 9, 0.4)',
        }
      : tier === 'purple'
        ? {
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(252, 211, 77, 0.5)',
          }
        : {
            background: 'linear-gradient(135deg, #1E3A8A 0%, #1E1B4B 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(252, 211, 77, 0.35)',
          }

  return (
    <span
      aria-label={`콤보 ${combo}배`}
      className={`inline-flex h-8 items-center gap-1 rounded-[var(--r-full)] px-2.5 font-display text-[13px] font-[800] shadow-sm ${cls}`}
      style={style}
    >
      {tier === 'rainbow' && <Sparkles size={12} aria-hidden />}
      <span className="font-mono tabular-nums">×{combo}</span>
    </span>
  )
}
