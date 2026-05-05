// apps/web/src/components/hub/ModuleHero.tsx
// 모듈 hub 공통 헤로 — 슬림 baseline (v06.12)
//
// 디자인 원칙:
//   - Title 22~28px (이전 32~40px) — 본문 위계 정합
//   - Stats 18~20px font-[700] (이전 24~36 font-[800]) — 차분한 표현
//   - 장식적 글로우 제거 (subtle 우상단 highlight 1개만 유지)
//   - 영문 인용문 tagline 권장 X — 모듈별 functional `note` 사용 권장
//   - Padding 축소: py-5 md:py-6
//
// 학습 과학 매핑:
//   - Calm UI — 시각 자극 최소화
//   - Implicit Progress — Stats/Streak 노출 (단, emphasis 1개로 제한)
//   - Empathetic Feedback — note 는 격려형 1줄

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface HeroStat {
  label: string
  value: string | number
  /** 보조: "/30" 같은 단위 */
  unit?: string
  /** 강조 (오늘의 핵심 큐) — 한 hub 당 1개 권장 */
  emphasis?: boolean
}

export interface ModuleHeroProps {
  /** 좌측 라벨 — "Module · 한국어 부제목" */
  eyebrow: string
  /** 큰 제목 — 기능적·간결 (예: "오늘의 카드", "내 라이브러리") */
  title: string
  /**
   * 기능적 1줄 메모 (권장) — "진행 중 4권 · 정복 2권" 같이 즉시 정보가치 있는 텍스트.
   * tagline 보다 우선 렌더되며, italic·serif 아닌 본문 폰트.
   */
  note?: string
  /**
   * 영문 부제 (deprecated — 신규 hub 는 `note` 사용 권장).
   * note 미지정 시에만 렌더되며, 기존 hub 와의 호환성 유지용.
   */
  tagline?: string
  /** 그라디언트 시작/끝 색 — Tailwind safe class */
  gradient: { from: string; to: string }
  /** 우측 장식 아이콘 */
  icon?: LucideIcon
  /** 하단 inline stats 3분할 */
  stats?: HeroStat[]
  /** 우측 CTA */
  primaryAction?: ReactNode
  /**
   * note 아래 / stats 위(border-top 위)에 렌더되는 자유 슬롯.
   * VaultBar 같은 시각화 컴포넌트 임베드용. 미지정 시 렌더하지 않음.
   * v06.18 신규.
   */
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
  return (
    <header
      className="relative overflow-hidden rounded-[var(--r-xl)] shadow-[var(--sh-sm)]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
    >
      {/* Subtle 우상단 highlight — 224→128 축소, opacity 20→12 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.12] blur-2xl"
        style={{ background: 'radial-gradient(circle, #FFFFFF, transparent)' }}
      />

      <div className="relative px-5 py-5 text-[var(--ti)] md:px-7 md:py-6">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          {/* 좌: eyebrow + title + note/tagline */}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ti)]/15 px-2.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--ti)] backdrop-blur">
              {Icon && <Icon size={11} aria-hidden />}
              {eyebrow}
            </span>
            <h1 className="mt-2 font-display text-[22px] font-[700] leading-[1.15] tracking-tight md:text-[28px]">
              {title}
            </h1>
            {note ? (
              <p className="mt-1 max-w-md font-body text-[13px] leading-snug text-[var(--ti)]/85 md:text-[14px]">
                {note}
              </p>
            ) : tagline ? (
              <p className="mt-1 max-w-md font-body text-[12px] leading-snug text-[var(--ti)]/75 md:text-[13px]">
                {tagline}
              </p>
            ) : null}
          </div>

          {/* 우: Primary action */}
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {/* bottomSlot — note 아래·stats 위 자유 슬롯 (VaultBar 등) */}
        {bottomSlot && <div className="mt-3">{bottomSlot}</div>}

        {/* 하단 inline stats — 압축 */}
        {stats && stats.length > 0 && (
          <ul
            className="mt-4 grid border-t border-[var(--ti)]/15 pt-3"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s, i) => (
              <li
                key={i}
                className={i > 0 ? 'border-l border-[var(--ti)]/10 px-3' : 'pr-3'}
              >
                <p className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] opacity-75">
                  {s.label}
                </p>
                <p
                  className={`mt-0.5 font-display tabular-nums leading-none ${
                    s.emphasis
                      ? 'text-[22px] font-[800] md:text-[26px]'
                      : 'text-[18px] font-[700]'
                  }`}
                >
                  {s.value}
                  {s.unit && (
                    <span className="ml-1 font-display text-[11px] font-[600] opacity-75">
                      {s.unit}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}
