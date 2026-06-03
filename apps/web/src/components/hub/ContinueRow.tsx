// apps/web/src/components/hub/ContinueRow.tsx
// 학습 모듈 hub 의 "이어하기" 카드 — Zeigarnik 효과 surface
// 우선순위 1순위 (Hero 바로 아래)

import { ArrowRight, Clock3 } from 'lucide-react'
import Link from 'next/link'

export interface ContinueRowProps {
  /** 미완료 세션 정보 */
  session: {
    /** 진입 시점 한줄 (예: "Day 12 · Gatsby Ch.1") */
    title: string
    /** 짧은 보조 (예: "어제 23/30 멈춤") */
    subtitle?: string
    /** 진행률 0~1 */
    progress: number
    /** 우측 작은 정보 (예: "어제 12:48") */
    hint?: string
  } | null
  /** 시작 라우트 */
  href: string
  /** 색상 (모듈 액센트) */
  accent?: string
  /** 빈 상태 메시지 */
  emptyLabel?: string
  emptyHint?: string
}

export function ContinueRow({
  session,
  href,
  accent = 'var(--p)',
  emptyLabel = '아직 학습 중인 세션이 없어요',
  emptyHint = '아래 \'설정 후 시작\' 으로 첫 라운드를 시작해보세요',
}: ContinueRowProps) {
  if (!session) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] p-5">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t3)]"
          aria-hidden
        >
          <Clock3 size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13px] font-[600] text-[var(--t1)]">{emptyLabel}</p>
          <p className="mt-0.5 font-body text-[12px] text-[var(--t3)]">{emptyHint}</p>
        </div>
      </div>
    )
  }

  const pct = Math.round(session.progress * 100)

  return (
    <Link
      href={href}
      className="group block rounded-[var(--r-lg)] border border-l-[3px] p-4 transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-sm)]"
      style={{
        // accent strip 4px → 3px (slim) + 4% accent wash background (모듈 정체성 + Calm)
        borderColor: 'var(--bd)',
        borderLeftColor: accent,
        background: `linear-gradient(to right, ${accent}0A, var(--bg) 40%)`,
        boxShadow: 'var(--sh-xs)',
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}15`, color: accent }}
          aria-hidden
        >
          <Clock3 size={16} strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)]">
              이어하기
            </span>
            {session.hint && (
              <span className="font-mono text-[10px] text-[var(--t3)]">· {session.hint}</span>
            )}
          </div>
          <p className="mt-0.5 truncate font-display text-[15px] font-[700] text-[var(--t1)]">
            {session.title}
          </p>
          {session.subtitle && (
            <p className="mt-0.5 truncate font-body text-[12px] text-[var(--t3)]">
              {session.subtitle}
            </p>
          )}

          {/* progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
              <div
                className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
                style={{ width: `${pct}%`, backgroundColor: accent }}
              />
            </div>
            <span className="font-mono text-[11px] font-[600] tabular-nums" style={{ color: accent }}>
              {pct}%
            </span>
          </div>
        </div>

        <span
          className="hidden shrink-0 items-center gap-1 rounded-[var(--r-md)] border px-3 py-1.5 font-display text-[12px] font-[700] sm:inline-flex"
          style={{
            background: `${accent}1A`,
            borderColor: accent,
            color: accent,
          }}
        >
          이어하기
          <ArrowRight
            size={12}
            className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  )
}
