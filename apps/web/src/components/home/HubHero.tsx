// apps/web/src/components/home/HubHero.tsx
//
// Hub 페이지 최상단 영웅 헤더.
//
// Phase 3-2: useHubData() 훅으로부터 실데이터 자가 페치 — props 없음.
//   - displayName : user_profiles.display_name (한글 안전)
//   - streak      : user_stats.current_streak
//   - stats 3분할 : 오늘 학습 / 총 단어 / 정확도
//   - Today CTA   : reviewDueCount > 0 → /flashcard / 0 → /text/new (첫 학습)
//
// §17.3 추천 축 — Today CTA 1곳 (Hub Today CTA / FloatingSparkle / 세션 종료 후 3곳 중 1곳)

'use client'

import { ArrowRight, Compass, Flame, Sparkles, Sprout } from 'lucide-react'
import Link from 'next/link'

import { useHubData } from '@/hooks/useHubData'

// ────────────────────────────────────────────────────────────
// streak 메시지 (Empathetic Feedback — 0/1/2+ 격려형 분기)
// ────────────────────────────────────────────────────────────
function getStreakMessage(streak: number): { text: string; icon: typeof Flame } {
  if (streak === 0) return { text: '첫 학습을 시작해보세요', icon: Sprout }
  if (streak === 1) return { text: '학습을 시작했어요!', icon: Flame }
  return { text: `${streak}일 연속 학습 중이에요`, icon: Flame }
}

// ────────────────────────────────────────────────────────────
// Today CTA 분기
// ────────────────────────────────────────────────────────────
function getTodayCta(reviewDueCount: number): {
  href: string
  label: string
  badge: number | null
  ariaLabel: string
} {
  if (reviewDueCount > 0) {
    return {
      href: '/flashcard',
      label: '오늘의 복습',
      badge: reviewDueCount,
      ariaLabel: `오늘의 복습 ${reviewDueCount}개`,
    }
  }
  return {
    href: '/text/new',
    label: '첫 학습 시작하기',
    badge: null,
    ariaLabel: '첫 학습 시작하기',
  }
}

// ════════════════════════════════════════════════════════════
// HubHero
// ════════════════════════════════════════════════════════════
export function HubHero() {
  const { data, isLoading } = useHubData()

  // 빈 상태 — 데이터 도착 전에도 레이아웃 유지 (깜빡임 방지)
  const displayName = data?.user.displayName?.trim() ?? ''
  const streak = data?.stats.streak ?? 0
  const todayCount = data?.stats.todayWordCount ?? 0
  const totalWords = data?.stats.totalWords ?? 0
  const accuracy = data?.stats.accuracy ?? 0
  const reviewDueCount = data?.stats.reviewDueCount ?? 0
  const vLevel = data?.vrl.currentVLevel ?? null
  const isDiagnosed = data?.vrl.isDiagnosed ?? false

  const greeting = displayName ? `안녕하세요, ${displayName}님 👋` : '안녕하세요 👋'
  const { text: streakText, icon: StreakIcon } = getStreakMessage(streak)
  const cta = getTodayCta(reviewDueCount)

  return (
    <header
      className="relative overflow-hidden rounded-ios-2xl px-6 py-7 text-[var(--ti)] shadow-ios-3 md:px-8 md:py-9"
      style={{
        // v06.40 Contemporary Editorial — 더 깊은 ink + 절제된 금빛 light leak
        // Apple Books × Linear: 깊이감 ↑, 채도 ↓, 시그니처 모먼트는 우측 상단에만
        backgroundImage:
          'linear-gradient(135deg, #051428 0%, #0F2540 55%, #1F3B66 100%), radial-gradient(circle at 100% 0%, rgba(176,132,58,0.16), transparent 55%)',
        backgroundBlendMode: 'normal, soft-light',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* 인사 + Streak + V-Level — 좌측 column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {isLoading ? (
            <span aria-hidden className="h-[28px] w-[260px] animate-pulse rounded bg-white/20" />
          ) : (
            // Reading Room — Lora editorial 승격: 인사가 hero 의 hero
            <h1 className="truncate font-editorial text-[26px] font-[500] leading-[1.05] tracking-[-0.012em] md:text-[30px]">
              {greeting}
            </h1>
          )}

          {/* 캡슐 row — Streak + V-Level */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-ios-pill px-3 py-1 font-display text-[12px] font-[600] backdrop-blur-md"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <StreakIcon size={12} className="shrink-0 text-[var(--active)]" aria-hidden />
              <span className="tabular-nums">{streak > 0 ? `${streak}일 연속` : '시작'}</span>
            </span>

            {!isLoading && isDiagnosed && vLevel !== null && (
              <span
                className="inline-flex items-baseline gap-1.5 rounded-ios-pill px-3 py-1 backdrop-blur-md"
                style={{ background: 'rgba(255,255,255,0.18)' }}
                aria-label={`현재 V-Level ${vLevel}`}
              >
                <span className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.14em] opacity-80">수준</span>
                <span className="font-display text-[12.5px] font-[700] tabular-nums">V{vLevel}</span>
              </span>
            )}
            {!isLoading && !isDiagnosed && (
              <Link
                href="/diagnostic"
                aria-label="V-Level 진단 받기"
                className="inline-flex items-center gap-1.5 rounded-ios-pill px-3 py-1 font-display text-[12px] font-[600] backdrop-blur-md transition-all duration-[var(--dur-ios-fast)] hover:bg-white/25 active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                <Compass size={11} aria-hidden />
                <span>진단</span>
              </Link>
            )}
          </div>

          {!isLoading && (
            <span className="font-body text-[12.5px] leading-snug opacity-85">
              {streakText}
            </span>
          )}
        </div>

        {/* 우측 CTA — Reading Room 시그니처 골드 (금고에서 꺼낸 보상) */}
        <Link
          href={cta.href}
          aria-label={cta.ariaLabel}
          className="motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:ease-ios-standard motion-safe:active:scale-[0.97] motion-safe:hover:brightness-110 focus-visible:ring-[var(--active)]/60 inline-flex shrink-0 items-center gap-2 rounded-ios-pill px-4 py-2.5 font-display text-[13px] font-[600] shadow-[0_4px_16px_rgba(184,137,59,0.30)] focus-visible:outline-none focus-visible:ring-2"
          style={{ background: '#D4A856', color: '#0F1E33' }}
        >
          <Sparkles size={13} aria-hidden />
          <span>{cta.label}</span>
          {cta.badge !== null && (
            <span
              className="inline-flex min-w-[20px] items-center justify-center rounded-ios-pill px-1.5 py-0.5 font-mono text-[10.5px] font-[700] tabular-nums"
              style={{ background: 'rgba(15, 30, 51, 0.18)', color: '#0F1E33' }}
            >
              {cta.badge}
            </span>
          )}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>

      {/* Stats — 큰 수치 row (iOS Health Categories 정합) */}
      <ul
        className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4"
        aria-label="hub stats"
      >
        <BigStat label="오늘" value={todayCount} unit="개" />
        <BigStat label="총 단어" value={totalWords} unit="개" />
        <BigStat label="정확도" value={accuracy} unit="%" />
      </ul>
    </header>
  )
}

function BigStat({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit?: string
}) {
  return (
    <li className="flex flex-col gap-1">
      <span className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.14em] text-white/70">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-editorial text-[30px] font-[500] leading-none tracking-[-0.015em] tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[10.5px] text-white/65">{unit}</span>
        )}
      </div>
    </li>
  )
}
