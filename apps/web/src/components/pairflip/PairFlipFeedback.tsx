// apps/web/src/components/pairflip/PairFlipFeedback.tsx
// 매칭 성공/실패 오버레이 — 1초간 표시 후 자동 소멸
// 색맹 대응: 색 + 형태(아이콘) + 모양 3중 표현

'use client'

import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { COMBO_TIERS } from './constants'

type FeedbackType = 'success' | 'fail' | null

interface FeedbackProps {
  type: FeedbackType
  combo?: number
}

const COMBO_TEXT: Record<keyof typeof COMBO_TIERS, string> = {
  3: 'GREAT!',
  5: 'AMAZING!',
  7: 'INCREDIBLE!',
}

export function PairFlipFeedback({ type, combo = 0 }: FeedbackProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (type) {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 1000)
      return () => clearTimeout(t)
    }
  }, [type])

  if (!visible || !type) return null

  // 콤보 단계 텍스트
  let comboText: string | null = null
  if (type === 'success') {
    if (combo >= 7) comboText = COMBO_TEXT[7]
    else if (combo >= 5) comboText = COMBO_TEXT[5]
    else if (combo >= 3) comboText = COMBO_TEXT[3]
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="motion-safe:animate-pf-fb-pop flex h-32 w-32 items-center justify-center rounded-full shadow-xl backdrop-blur"
        style={{
          background:
            type === 'success'
              ? 'linear-gradient(135deg, #10B981 0%, #047857 100%)'
              : 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          border: '4px solid rgba(255,255,255,0.95)',
          boxShadow:
            type === 'success'
              ? '0 0 0 1px rgba(245, 158, 11, 0.4), 0 18px 40px rgba(16, 185, 129, 0.4)'
              : '0 0 0 1px rgba(245, 158, 11, 0.4), 0 18px 40px rgba(220, 38, 38, 0.4)',
        }}
        role="img"
        aria-label={type === 'success' ? '매칭 성공' : '매칭 실패'}
      >
        {type === 'success' ? (
          <Check size={64} strokeWidth={3} className="text-white" aria-hidden />
        ) : (
          <X size={64} strokeWidth={3} className="text-white" aria-hidden />
        )}
      </div>

      {comboText && (
        <span
          className="motion-safe:animate-pf-fb-text font-display text-[32px] font-[900] uppercase tracking-[0.05em]"
          style={{
            background:
              combo >= 7
                ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #B45309 100%)'
                : combo >= 5
                  ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
                  : 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 4px 12px rgba(15, 23, 42, 0.4))',
          }}
        >
          {comboText}
        </span>
      )}

      {type === 'success' && combo >= 3 && <SparkleParticles />}

      <style jsx global>{`
        @keyframes pf-fb-pop {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pf-fb-text {
          0% {
            transform: translateY(20px) scale(0.8);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-pf-fb-pop {
          animation: pf-fb-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-pf-fb-text {
          animation: pf-fb-text 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}

function SparkleParticles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <span
          key={i}
          className="motion-safe:animate-pf-particle absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#FBBF24]"
          style={{
            animationDelay: `${i * 50}ms`,
            // @ts-expect-error CSS custom property
            '--angle': `${deg}deg`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes pf-particle {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateX(120px);
            opacity: 0;
          }
        }
        .animate-pf-particle {
          animation: pf-particle 0.7s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
