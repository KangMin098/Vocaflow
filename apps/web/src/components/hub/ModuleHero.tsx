// apps/web/src/components/hub/ModuleHero.tsx
// 모듈 hub 공통 헤로 — Minimal (v06.30)
//
// v06.30 슬림화 — 9개 hub 페이지 상단 영역이 너무 무겁다는 사용자 피드백 반영.
// 이전 (v06.27 Editorial premium) 의 6개 장식 layer (conic accent · soft orbs · ghost icon
// · grain · iridescent border · aurora edge) 와 거대한 폰트 (24-32px title) / padding
// (py-6 md:py-7) / bento stats grid 를 모두 제거 — 최소 표현으로 회귀.
//
// 목표:
//   · py-3 md:py-4 (이전 py-6 md:py-7) 약 50% 축소
//   · title 16-18px (이전 24-32px) 약 40% 축소
//   · stats: 인라인 가로 pill row (이전 bento 그리드)
//   · 단일 그라디언트만, 장식 layer 0
//
// API 100% 호환 — 9 hub 페이지 caller 변경 없음.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface HeroStat {
  label: string
  value: string | number
  unit?: string
  emphasis?: boolean
}

export interface ModuleHeroProps {
  eyebrow: string
  title: string
  note?: string
  tagline?: string
  gradient: { from: string; to: string }
  icon?: LucideIcon
  stats?: HeroStat[]
  primaryAction?: ReactNode
  bottomSlot?: ReactNode
}

export function ModuleHero({
  eyebrow,
  title,
  note,
  tagline,
  gradient,
  icon: Icon,
  stats,
  primaryAction,
  bottomSlot,
}: ModuleHeroProps) {
  const subText = note ?? tagline ?? null

  return (
    <header
      className="relative overflow-hidden rounded-[var(--r-md)] px-4 py-3 text-[var(--ti)] shadow-[var(--sh-xs)] md:px-5 md:py-3.5"
      style={{
        // Reading Room v06.40 — navy ink 통일 (caller gradient prop 무시).
        // 6 hub 페이지 (flashcard/scriptquiz/spellforge/pairflip/dictation/text) 동시 효과.
        // gradient prop 은 API 호환을 위해 받지만 본문에선 사용 안 함 (의도된 deprecation).
        backgroundImage: `linear-gradient(rgba(255,255,255,0.16), rgba(255,255,255,0.16)), linear-gradient(135deg, var(--p-dark) 0%, var(--p) 100%)`,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Eyebrow + title 한 줄 (좁은 화면에선 wrap) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && (
            <Icon
              size={14}
              aria-hidden
              strokeWidth={2.25}
              className="shrink-0 opacity-80"
            />
          )}
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] opacity-80">
            {eyebrow}
          </span>
          <span className="opacity-30" aria-hidden>·</span>
          <h1 className="font-display text-[15px] font-[700] leading-tight md:text-[16px]">
            {title}
          </h1>
          {subText && (
            <>
              <span className="hidden opacity-30 sm:inline" aria-hidden>·</span>
              <p className="hidden truncate font-body text-[12px] opacity-80 sm:block">
                {subText}
              </p>
            </>
          )}
        </div>

        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </div>

      {/* 좁은 화면 — subText 줄바꿈 */}
      {subText && (
        <p className="mt-1 truncate font-body text-[11.5px] opacity-80 sm:hidden">
          {subText}
        </p>
      )}

      {bottomSlot && <div className="mt-2">{bottomSlot}</div>}

      {/* Stats — 인라인 가로 pill row */}
      {stats && stats.length > 0 && (
        <ul
          className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/15 pt-2"
          aria-label="hub stats"
        >
          {stats.map((s, i) => (
            <li
              key={i}
              className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight"
            >
              <span
                className={`text-[11px] font-[700] ${
                  s.emphasis ? 'text-white' : 'text-white/75'
                }`}
              >
                {s.label}
              </span>
              <span
                className={`${
                  s.emphasis ? 'text-[15px] font-[800]' : 'text-[13px] font-[700]'
                }`}
              >
                {s.value}
                {s.unit && (
                  <span className="ml-0.5 text-[10px] font-[600] opacity-70">
                    {s.unit}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
