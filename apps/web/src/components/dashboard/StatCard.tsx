// apps/web/src/components/dashboard/StatCard.tsx
// Vocaflow StatCard — 대시보드 통계 카드
// CLAUDE.md v06.4 §13 — variant="card" (기본) | "inline" (Hero 내부 임베드)

'use client'

import { cn } from '@/lib/utils/cn'
import { Minus, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type StatTrend = 'up' | 'down' | 'flat' | 'record'
export type StatCardVariant = 'card' | 'inline'

interface StatCardBaseProps {
  /** 좌상단 라벨 */
  label: string
  /** 큰 숫자 (이미 포맷된 문자열) */
  value: string | number
  /** 단위 (% · 일 · 분 등) */
  unit?: string
  /** 보조 텍스트 (예: "/30분 목표") */
  subtext?: string
}

export interface StatCardBoxProps extends StatCardBaseProps {
  /** 기본 카드 변형 */
  variant?: 'card'
  /** 카드 아이콘 */
  icon: LucideIcon
  /** 강조 색상 (hex) */
  accentColor: string
  /** 추세 방향 */
  trend?: StatTrend
  /** 추세 텍스트 (예: "+12", "+3%", "신기록") */
  trendText?: string
  /** 클릭 시 이동 핸들러 */
  onClick?: () => void
}

export interface StatCardInlineProps extends StatCardBaseProps {
  /** Hero 내부 임베드용 — 카드 박스 제거 / 흰색 텍스트 / s2 값 */
  variant: 'inline'
}

export type StatCardProps = StatCardBoxProps | StatCardInlineProps

// ══════════════════════════════════════════════════════════════
// Trend 시각 매핑
// ══════════════════════════════════════════════════════════════
const trendConfig: Record<StatTrend, { icon: LucideIcon; color: string; bg: string }> = {
  up: { icon: TrendingUp, color: 'text-success', bg: 'bg-success-light' },
  down: { icon: TrendingDown, color: 'text-error', bg: 'bg-error-light' },
  flat: { icon: Minus, color: 'text-t3', bg: 'bg-bg3' },
  record: { icon: Sparkles, color: 'text-active', bg: 'bg-warning-light' },
}

// ══════════════════════════════════════════════════════════════
// StatCard — 변형별 분기
// ══════════════════════════════════════════════════════════════
export function StatCard(props: StatCardProps) {
  if (props.variant === 'inline') {
    return <StatCardInline {...props} />
  }
  return <StatCardBox {...props} />
}

// ──────────────────────────────────────────────────────────────
// inline — Hero 내부 임베드
// ──────────────────────────────────────────────────────────────
function StatCardInline({ label, value, unit, subtext }: StatCardInlineProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[11px] font-[700] uppercase tracking-[0.06em] opacity-80">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-[32px] font-[800] leading-none tabular-nums md:text-[40px]">
          {value}
        </span>
        {unit && (
          <span className="font-display text-[14px] font-[600] opacity-80">{unit}</span>
        )}
      </div>
      {subtext && <span className="font-body text-[12px] opacity-70">{subtext}</span>}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// card — 기본 (Dashboard §13)
// ──────────────────────────────────────────────────────────────
function StatCardBox({
  label,
  value,
  unit,
  icon: Icon,
  accentColor,
  trend,
  trendText,
  subtext,
  onClick,
}: StatCardBoxProps) {
  const trendStyle = trend ? trendConfig[trend] : null
  const TrendIcon = trendStyle?.icon
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group relative overflow-hidden',
        'rounded-xl border border-bd bg-bg',
        'p-s-5',
        'transition-all duration-normal',
        isClickable && 'cursor-pointer hover:-translate-y-[2px] hover:border-bdf hover:shadow-md'
      )}
    >
      {/* 우상단 미세 그라데이션 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity duration-normal group-hover:opacity-20"
        style={{
          background: `radial-gradient(circle, ${accentColor}, transparent)`,
        }}
      />

      {/* 상단 — 라벨 + 아이콘 */}
      <div className="relative mb-s-4 flex items-start justify-between">
        <div className="flex min-w-0 flex-col gap-s-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
            {label}
          </span>
        </div>

        {/* 아이콘 칩 — 모듈 색상 */}
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-normal group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <Icon size={16} style={{ color: accentColor }} />
        </div>
      </div>

      {/* 가운데 — 큰 숫자 */}
      <div className="relative mb-s-3 flex items-baseline gap-s-1">
        <span className="font-display text-3xl font-extrabold tabular-nums leading-none tracking-[-0.02em] text-t1 sm:text-4xl">
          {value}
        </span>
        {unit && <span className="font-display text-base font-semibold text-t2">{unit}</span>}
      </div>

      {/* 하단 — 추세 + 보조 */}
      <div className="relative flex items-center justify-between gap-s-2">
        {trend && trendText && TrendIcon && (
          <div
            className={cn(
              'inline-flex items-center gap-s-1 rounded-md px-s-2 py-[2px]',
              'font-mono text-[11px] font-bold tabular-nums',
              trendStyle.bg,
              trendStyle.color
            )}
          >
            <TrendIcon size={11} strokeWidth={2.5} />
            <span>{trendText}</span>
          </div>
        )}
        {subtext && <span className="truncate font-body text-xs text-t3">{subtext}</span>}
      </div>
    </div>
  )
}
