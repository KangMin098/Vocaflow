// apps/web/src/components/pairflip/PairFlipEnv.tsx
// 환경 v2 — editorial: warm ivory → champagne 그라디언트 + 미세 골드 폴카·이중 라디얼

'use client'

import { PF_COLORS } from './theme'

export function PairFlipEnv() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* 베이스 그라디언트 */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${PF_COLORS.envTop} 0%, ${PF_COLORS.envMid} 55%, ${PF_COLORS.envBottom} 100%)`,
        }}
        aria-hidden="true"
      />

      {/* 좌상 골드 라디얼 글로우 */}
      <div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${PF_COLORS.goldLight} 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* 우하 로즈 라디얼 글로우 */}
      <div
        className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{
          background: `radial-gradient(circle, #FCA5A5 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* 미세 골드 폴카 도트 패턴 */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(${PF_COLORS.goldDeep} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* 우상 작은 별 4개 (미세 트윙클) */}
      <Star className="absolute right-12 top-10 h-2 w-2 motion-safe:animate-pf-twinkle-1" />
      <Star className="absolute right-32 top-20 h-2.5 w-2.5 motion-safe:animate-pf-twinkle-2" />
      <Star className="absolute right-20 top-40 h-1.5 w-1.5 motion-safe:animate-pf-twinkle-3" />
      <Star className="absolute right-44 top-14 h-2 w-2 motion-safe:animate-pf-twinkle-1" />

      {/* 하단 책상 가장자리 (얇은 골드 하이라이트) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 opacity-50"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${PF_COLORS.gold} 50%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      <style jsx global>{`
        @keyframes pf-twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.4);
          }
        }
        .animate-pf-twinkle-1 {
          animation: pf-twinkle 2.4s ease-in-out infinite;
        }
        .animate-pf-twinkle-2 {
          animation: pf-twinkle 2.8s ease-in-out infinite;
          animation-delay: 0.5s;
        }
        .animate-pf-twinkle-3 {
          animation: pf-twinkle 3.2s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </div>
  )
}

function Star({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="#F59E0B" aria-hidden="true">
      <path d="M6 0 L7.2 4.4 L12 6 L7.2 7.6 L6 12 L4.8 7.6 L0 6 L4.8 4.4 Z" />
    </svg>
  )
}
