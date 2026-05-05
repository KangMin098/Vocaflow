// apps/web/src/components/pairflip/PairFlipCard.tsx
// 단일 카드 v3 (v06.17.2)
//
// 변경:
//   - 매칭 성공 시 카드 사라지지 않음 — 그대로 유지 + 코너 ✓ 배지 + 에메랄드 ring
//   - O/X 마커 우상단 코너 배지로 이동 (단어/뜻 가리지 않음)
//   - 'gone' state 미사용 (hook 측에서도 더 이상 transition X)

'use client'

import { Check, X as XIcon } from 'lucide-react'

import { PF_COLORS, PF_DIMS, PF_BACK_PATTERNS } from './theme'
import type { PairFlipCard as Card } from './types'

interface CardProps {
  card: Card
  onClick: () => void
}

export function PairFlipCardView({ card, onClick }: CardProps) {
  const isFlipped =
    card.state === 'flipped' || card.state === 'matched' || card.state === 'shaking'
  const isMatched = card.state === 'matched'
  const isShaking = card.state === 'shaking'
  const disabled =
    card.state === 'matched' ||
    card.state === 'gone' ||
    card.state === 'flipped' ||
    card.state === 'shaking'

  const ariaLabel = (() => {
    switch (card.state) {
      case 'covered':
        return `${card.position + 1}번째 카드, 뒤집기`
      case 'flipped':
        return `${card.content}, 짝을 찾고 있는 중`
      case 'matched':
        return `${card.content}, 매칭 성공`
      case 'shaking':
        return `${card.content}, 매칭 실패`
      default:
        return card.content
    }
  })()

  const patternIdx = card.patternIndex ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`pf-card group relative ${isShaking ? 'pf-card-shake' : ''} ${
        isMatched ? 'pf-card-matched' : ''
      } ${
        !disabled
          ? 'motion-safe:animate-pf-card-idle hover:-translate-y-1 active:scale-[0.98]'
          : ''
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2`}
      style={{
        aspectRatio: PF_DIMS.cardAspectRatio,
        animationDelay: `${card.position * 100}ms`,
      }}
    >
      <div
        className="pf-card-inner"
        style={{
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── 뒷면 ── */}
        <div
          className="pf-card-face pf-card-back"
          style={{
            background: `linear-gradient(140deg, ${PF_COLORS.coverFrom} 0%, ${PF_COLORS.coverMid} 55%, ${PF_COLORS.coverTo} 100%)`,
            border: `1px solid ${PF_COLORS.gold}`,
            boxShadow: `inset 0 0 0 4px rgba(245, 158, 11, 0.08), 0 8px 20px rgba(15, 23, 42, 0.15)`,
          }}
        >
          <CornerOrnaments />
          <BackPattern pattern={PF_BACK_PATTERNS[patternIdx]} />
        </div>

        {/* ── 앞면 ── */}
        <div
          className="pf-card-face pf-card-front"
          style={{
            background:
              card.type === 'word'
                ? `linear-gradient(140deg, ${PF_COLORS.wordFrom} 0%, ${PF_COLORS.wordMid} 50%, ${PF_COLORS.wordTo} 100%)`
                : `linear-gradient(140deg, ${PF_COLORS.meaningFrom} 0%, ${PF_COLORS.meaningMid} 50%, ${PF_COLORS.meaningTo} 100%)`,
            color: card.type === 'word' ? PF_COLORS.textWord : PF_COLORS.textMeaning,
            border: isMatched
              ? `2px solid ${PF_COLORS.matchedEmerald}`
              : isShaking
                ? `2px solid ${PF_COLORS.shakeCoral}`
                : `1px solid ${
                    card.type === 'word' ? PF_COLORS.wordBorder : PF_COLORS.meaningBorder
                  }`,
            boxShadow: isMatched
              ? `inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 4px ${PF_COLORS.matchedGlow}, 0 8px 20px rgba(15,23,42,0.10)`
              : isShaking
                ? `inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 4px ${PF_COLORS.shakeGlow}, 0 8px 20px rgba(15,23,42,0.10)`
                : 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(15, 23, 42, 0.10)',
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
          }}
        >
          {/* 좌상단 마커: word=★, meaning=품사 배지 */}
          {card.type === 'word' && (
            <span
              aria-hidden="true"
              className="absolute left-2 top-1.5 font-display text-[12px] font-[800]"
              style={{ color: PF_COLORS.gold }}
            >
              ★
            </span>
          )}
          {card.type === 'meaning' && card.partOfSpeech && (
            <span
              aria-hidden="true"
              className="absolute left-2 top-1.5 rounded-[var(--r-sm)] bg-white/70 px-1.5 py-0.5 font-mono text-[9px] font-[700] uppercase tracking-wider"
              style={{ color: PF_COLORS.textMeaning }}
            >
              {card.partOfSpeech}
            </span>
          )}

          {/* 메인 콘텐츠 */}
          <span
            className={
              card.type === 'word'
                ? 'font-english font-[700]'
                : 'font-display font-[700]'
            }
            style={{
              fontSize:
                card.type === 'word'
                  ? 'clamp(18px, 4.5vw, 28px)'
                  : 'clamp(14px, 3.5vw, 20px)',
              lineHeight: 1.2,
              padding: '0 10px',
              textAlign: 'center',
              letterSpacing: card.type === 'word' ? '-0.01em' : '0',
            }}
          >
            {card.content}
          </span>

          {/* 발음 */}
          {card.type === 'word' && card.phonetic && (
            <span
              className="mt-1 font-mono text-[10px] font-[500]"
              style={{ color: PF_COLORS.textMuted, opacity: 0.7 }}
            >
              {card.phonetic}
            </span>
          )}

          {/* O/X 코너 배지 — 단어 가리지 않음 */}
          {(isMatched || isShaking) && (
            <ResultCornerBadge variant={isMatched ? 'success' : 'fail'} />
          )}
        </div>
      </div>

      <style jsx>{`
        .pf-card {
          width: 100%;
          perspective: ${PF_DIMS.perspective}px;
          background: transparent;
          border: none;
          padding: 0;
          cursor: ${disabled ? 'default' : 'pointer'};
        }
        .pf-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform ${PF_DIMS.flipDuration}ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pf-card-face {
          position: absolute;
          inset: 0;
          border-radius: ${PF_DIMS.cardRadius};
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .pf-card-front {
          transform: rotateY(180deg);
        }
      `}</style>
      <style jsx global>{`
        @keyframes pf-card-idle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(2px);
          }
        }
        @keyframes pf-card-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-10px);
          }
          40% {
            transform: translateX(10px);
          }
          60% {
            transform: translateX(-6px);
          }
          80% {
            transform: translateX(6px);
          }
        }
        @keyframes pf-card-matched {
          /* 매칭 후 잠시 축하 — 사라지지 X, opacity 1 유지 */
          0% {
            transform: scale(1) rotate(0deg);
          }
          40% {
            transform: scale(1.08) rotate(2deg);
          }
          70% {
            transform: scale(1.02) rotate(-1deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes pf-badge-pop {
          0% {
            transform: scale(0.4) rotate(-20deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.18) rotate(8deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .animate-pf-card-idle {
          animation: pf-card-idle 4s ease-in-out infinite;
        }
        .pf-card-shake {
          animation: pf-card-shake ${PF_DIMS.shakeDuration}ms ease-in-out;
        }
        .pf-card-matched {
          animation: pf-card-matched 0.7s ease-out;
        }
        .animate-pf-badge-pop {
          animation: pf-badge-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </button>
  )
}

// ── O / X 코너 배지 — 우상단, 단어/뜻 가리지 않음 ────────────────
function ResultCornerBadge({ variant }: { variant: 'success' | 'fail' }) {
  const isOk = variant === 'success'
  return (
    <div
      className="motion-safe:animate-pf-badge-pop pointer-events-none absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full"
      aria-hidden="true"
      style={{
        background: isOk
          ? `linear-gradient(135deg, ${PF_COLORS.matchedEmerald} 0%, ${PF_COLORS.matchedDeep} 100%)`
          : `linear-gradient(135deg, ${PF_COLORS.shakeCoral} 0%, ${PF_COLORS.shakeDeep} 100%)`,
        boxShadow: isOk
          ? `0 0 0 2px rgba(255,255,255,0.95), 0 4px 12px ${PF_COLORS.matchedGlow}`
          : `0 0 0 2px rgba(255,255,255,0.95), 0 4px 12px ${PF_COLORS.shakeGlow}`,
      }}
    >
      {isOk ? (
        <Check size={14} strokeWidth={3.5} className="text-white" aria-hidden />
      ) : (
        <XIcon size={14} strokeWidth={3.5} className="text-white" aria-hidden />
      )}
    </div>
  )
}

// ── 골드 코너 장식 (4 모서리, 뒷면 전용) ─────────────────────────
function CornerOrnaments() {
  const stroke = PF_COLORS.goldLight
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M4 12 L4 4 L12 4" fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
      <path d="M88 4 L96 4 L96 12" fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
      <path d="M4 88 L4 96 L12 96" fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
      <path d="M96 88 L96 96 L88 96" fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

// ── 뒷면 패턴 SVG 5종 ──────────────────────────────────────────────
function BackPattern({ pattern }: { pattern: (typeof PF_BACK_PATTERNS)[number] }) {
  const stroke = PF_COLORS.goldLight
  switch (pattern) {
    case 'diamond':
      return (
        <svg viewBox="0 0 60 80" className="h-3/5 w-3/5 opacity-50" aria-hidden="true">
          <path d="M30 20 L42 40 L30 60 L18 40 Z" fill="none" stroke={stroke} strokeWidth="1.5" />
          <path d="M30 28 L37 40 L30 52 L23 40 Z" fill="none" stroke={stroke} strokeWidth="1" />
          <circle cx="30" cy="40" r="1.5" fill={stroke} />
        </svg>
      )
    case 'wave':
      return (
        <svg viewBox="0 0 60 80" className="h-3/5 w-3/5 opacity-45" aria-hidden="true">
          {[28, 40, 52].map((y) => (
            <path
              key={y}
              d={`M5 ${y} Q15 ${y - 6} 25 ${y} T45 ${y} T55 ${y}`}
              fill="none"
              stroke={stroke}
              strokeWidth="1.2"
            />
          ))}
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 60 80" className="h-1/2 w-1/2 opacity-55" aria-hidden="true">
          <path
            d="M30 18 L34 34 L50 34 L37 44 L42 60 L30 50 L18 60 L23 44 L10 34 L26 34 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
          <circle cx="30" cy="40" r="2" fill={stroke} opacity="0.7" />
        </svg>
      )
    case 'grid':
      return (
        <svg viewBox="0 0 60 80" className="h-4/5 w-4/5 opacity-30" aria-hidden="true">
          {[20, 30, 40, 50, 60].map((y) => (
            <line key={y} x1="8" y1={y} x2="52" y2={y} stroke={stroke} strokeWidth="0.8" />
          ))}
          {[12, 22, 32, 42, 52].map((x) => (
            <line key={x} x1={x} y1="14" x2={x} y2="66" stroke={stroke} strokeWidth="0.8" />
          ))}
        </svg>
      )
    case 'logo':
      return (
        <span
          className="font-display font-[900] tracking-tight"
          style={{
            color: stroke,
            opacity: 0.7,
            fontSize: 'clamp(28px, 5vw, 36px)',
            letterSpacing: '-0.02em',
          }}
          aria-hidden="true"
        >
          PF
        </span>
      )
  }
}
