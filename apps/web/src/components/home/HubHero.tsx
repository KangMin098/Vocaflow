// apps/web/src/components/home/HubHero.tsx
//
// Hub 페이지 최상단 영웅 헤더 — 인사 + 수준 + 오늘의 한 걸음.
//
// v06.36 (ADR 0006 D2) — **상태 표시를 잃었다.** streak 캡슐과 3 stats(오늘·총 단어·정확도)를
//   제거하고 StatusRibbon 하나로 옮겼다. 이전에는 streak 이 Sidebar·FlowNav·여기 세 곳이었고,
//   신규 학습자에게 이 헤더만으로 0이 네 개(streak·오늘·총 단어·정확도) 찍혔다.
//   정확도(%)는 아예 되살리지 않는다 — 낮으면 압박이고 높으면 무의미하며, 초반에는
//   표본이 작아 변동이 크다(철학 ③). 추세는 Growth 소관이다.
//
// 남은 책임: 인사 · V-Level(또는 진단 유도) · Today CTA 하나.
//
// §17.3 추천 축 — Today CTA 1곳 (Hub Today CTA / FloatingSparkle / 세션 종료 후 3곳 중 1곳)

'use client'

import { ArrowRight, Compass, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { useHubData } from '@/hooks/useHubData'

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
  const reviewDueCount = data?.stats.reviewDueCount ?? 0
  const vLevel = data?.vrl.currentVLevel ?? null
  const isDiagnosed = data?.vrl.isDiagnosed ?? false

  const greeting = displayName ? `안녕하세요, ${displayName}님 👋` : '안녕하세요 👋'
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

          {/* 캡슐 row — V-Level (streak 은 StatusRibbon 소관) */}
          <div className="flex flex-wrap items-center gap-2">
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
    </header>
  )
}
