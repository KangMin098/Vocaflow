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
      className="relative rounded-[var(--r-md)] px-4 py-3 text-[var(--ti)] shadow-[var(--sh-xs)] md:px-5 md:py-3.5"
      style={{
        // Calm UI — gradient 위 16% white overlay 로 자동 톤다운 (ModuleHero 와 동일 패턴)
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.16), rgba(255,255,255,0.16)), linear-gradient(135deg, var(--p-dark) 0%, var(--p) 100%)',
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 인사 + Streak 한 줄 */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isLoading ? (
            <span
              aria-hidden
              className="h-[16px] w-[200px] animate-pulse rounded bg-white/20"
            />
          ) : (
            <h1 className="truncate font-display text-[15px] font-[700] leading-tight md:text-[16px]">
              {greeting}
            </h1>
          )}
          <span className="opacity-30" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-body text-[12px] opacity-90">
            <StreakIcon size={12} className="shrink-0 text-[var(--active)]" aria-hidden="true" />
            <span className="hidden sm:inline">{streakText}</span>
            <span className="sm:hidden">{streak > 0 ? `${streak}일` : '시작'}</span>
          </span>

          {/* V-Level 배지 — 진단 완료 시 V{n}, 미완료 시 "진단" CTA */}
          {!isLoading && (
            <>
              <span className="opacity-30" aria-hidden>·</span>
              {isDiagnosed && vLevel !== null ? (
                <span
                  className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[11px] font-[700] tabular-nums"
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: 'var(--ti)',
                  }}
                  aria-label={`현재 V-Level ${vLevel}`}
                  title={`현재 V-Level: V${vLevel}`}
                >
                  V{vLevel}
                </span>
              ) : (
                <Link
                  href="/diagnostic"
                  className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[11px] font-[600] transition-opacity hover:opacity-100"
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: 'var(--ti)',
                    opacity: 0.92,
                  }}
                  aria-label="V-Level 진단 받기"
                >
                  <Compass size={10} aria-hidden="true" />
                  <span>진단</span>
                </Link>
              )}
            </>
          )}
        </div>

        {/* 우측: Today CTA — 슬림 */}
        <Link
          href={cta.href}
          aria-label={cta.ariaLabel}
          className="focus-visible:ring-[var(--ti)]/60 inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--ti)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--p)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97]"
        >
          <Sparkles size={11} aria-hidden="true" />
          <span>{cta.label}</span>
          {cta.badge !== null && (
            <span
              className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-[700] tabular-nums"
              style={{
                background: 'var(--active-light)',
                color: 'var(--active)',
              }}
            >
              {cta.badge}
            </span>
          )}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      {/* Stats — 인라인 가로 pill row */}
      <ul
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/15 pt-2"
        aria-label="hub stats"
      >
        <InlineStat label="오늘" value={todayCount} unit="개" />
        <InlineStat label="총 단어" value={totalWords} unit="개" />
        <InlineStat label="정확도" value={accuracy} unit="%" />
      </ul>
    </header>
  )
}

function InlineStat({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit?: string
}) {
  return (
    <li className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight">
      <span className="text-[11px] font-[700] text-white/75">{label}</span>
      <span className="text-[13px] font-[700]">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-[600] opacity-70">{unit}</span>}
      </span>
    </li>
  )
}
