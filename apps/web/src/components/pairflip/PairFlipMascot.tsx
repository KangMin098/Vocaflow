// apps/web/src/components/pairflip/PairFlipMascot.tsx
// 부엉이 마스코트 SVG — 4가지 상태 (idle / cheer / happy / clap)
// 성장 학습 상징 (학식의 부엉이 — Athena 정합)

'use client'

export type MascotMood = 'idle' | 'cheer' | 'happy' | 'clap'

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

export function PairFlipMascot({
  mood = 'idle',
  size = 100,
  className = '',
}: MascotProps) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      aria-label={`마스코트 — ${mood}`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={
          mood === 'cheer' || mood === 'happy'
            ? 'motion-safe:animate-pf-mascot-bob'
            : ''
        }
      >
        {/* 몸통 */}
        <ellipse cx="50" cy="62" rx="28" ry="30" fill="#3B5DAB" stroke="#1E1B4B" strokeWidth="2" />
        {/* 가슴 무늬 */}
        <ellipse cx="50" cy="68" rx="18" ry="16" fill="#FEF3C7" />

        {/* 눈 (상태별 분기) */}
        {mood === 'idle' ? (
          // 졸음 — 눈 가늘게
          <>
            <path d="M36 48 Q40 50 44 48" stroke="#1E1B4B" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M56 48 Q60 50 64 48" stroke="#1E1B4B" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        ) : mood === 'happy' ? (
          // 기쁨 — 휘어진 눈
          <>
            <path d="M34 50 Q40 44 46 50" stroke="#1E1B4B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M54 50 Q60 44 66 50" stroke="#1E1B4B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          // cheer / clap — 큰 동그란 눈
          <>
            <circle cx="40" cy="48" r="5" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="1.5" />
            <circle cx="60" cy="48" r="5" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="1.5" />
            <circle cx="41" cy="49" r="2.2" fill="#1E1B4B" />
            <circle cx="61" cy="49" r="2.2" fill="#1E1B4B" />
            <circle cx="42" cy="48" r="0.8" fill="#FFFFFF" />
            <circle cx="62" cy="48" r="0.8" fill="#FFFFFF" />
          </>
        )}

        {/* 부리 */}
        <path
          d="M48 56 L52 56 L50 62 Z"
          fill="#F59E0B"
          stroke="#B45309"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* 입 (mood 별) */}
        {mood === 'happy' && (
          <path d="M44 70 Q50 76 56 70" stroke="#1E1B4B" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {mood === 'cheer' && (
          <ellipse cx="50" cy="72" rx="3" ry="2" fill="#1E1B4B" />
        )}

        {/* 날개 (clap = 박수, 그 외 접힘) */}
        {mood === 'clap' ? (
          <>
            <ellipse
              cx="22"
              cy="62"
              rx="8"
              ry="14"
              fill="#1E1B4B"
              className="motion-safe:[transform-origin:30px_62px] motion-safe:animate-pf-clap-l"
            />
            <ellipse
              cx="78"
              cy="62"
              rx="8"
              ry="14"
              fill="#1E1B4B"
              className="motion-safe:[transform-origin:70px_62px] motion-safe:animate-pf-clap-r"
            />
          </>
        ) : (
          <>
            <ellipse cx="26" cy="64" rx="6" ry="14" fill="#1E1B4B" />
            <ellipse cx="74" cy="64" rx="6" ry="14" fill="#1E1B4B" />
          </>
        )}

        {/* 발 */}
        <ellipse cx="42" cy="92" rx="5" ry="2" fill="#F59E0B" />
        <ellipse cx="58" cy="92" rx="5" ry="2" fill="#F59E0B" />

        {/* 졸음 z 표시 (idle) */}
        {mood === 'idle' && (
          <text
            x="76"
            y="36"
            fill="#3B5DAB"
            fontSize="14"
            fontWeight="700"
            className="motion-safe:animate-pf-zzz"
          >
            z
          </text>
        )}
      </svg>

      <style jsx global>{`
        @keyframes pf-mascot-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes pf-clap-l {
          0%,
          100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(20deg);
          }
        }
        @keyframes pf-clap-r {
          0%,
          100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(-20deg);
          }
        }
        @keyframes pf-zzz {
          0%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
        .animate-pf-mascot-bob {
          animation: pf-mascot-bob 2s ease-in-out infinite;
        }
        .animate-pf-clap-l {
          animation: pf-clap-l 0.4s ease-in-out infinite;
        }
        .animate-pf-clap-r {
          animation: pf-clap-r 0.4s ease-in-out infinite;
        }
        .animate-pf-zzz {
          animation: pf-zzz 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
