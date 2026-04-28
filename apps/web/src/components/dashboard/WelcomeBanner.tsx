// apps/web/src/components/dashboard/WelcomeBanner.tsx
// 대시보드 환영 배너

'use client'

import { Calendar, Sparkles } from 'lucide-react'

export interface WelcomeBannerProps {
  /** 사용자 이름 */
  userName?: string
  /** 이번 주 학습 일수 */
  weekDays?: number
  /** 학습한 단어 수 (이번 주) */
  weekWords?: number
}

export function WelcomeBanner({
  userName = '사용자',
  weekDays = 5,
  weekWords = 47,
}: WelcomeBannerProps) {
  // 시간대별 인사말
  const hour = new Date().getHours()
  const greeting =
    hour < 6
      ? '이른 아침이에요'
      : hour < 12
        ? '좋은 아침입니다'
        : hour < 18
          ? '안녕하세요'
          : hour < 22
            ? '좋은 저녁이에요'
            : '늦은 시간이네요'

  // 오늘 날짜
  const today = new Date()
  const dateStr = today.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div
      className="relative mb-s-6 overflow-hidden rounded-2xl p-s-6 sm:p-s-8"
      style={{
        background: 'linear-gradient(135deg, var(--p-light) 0%, var(--bg2) 60%, var(--bg) 100%)',
        border: '1px solid var(--bd)',
      }}
    >
      {/* 우측 데코 글로우들 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--combo), transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-32 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--p), transparent)',
        }}
      />

      <div className="relative flex flex-col gap-s-6 sm:flex-row sm:items-center sm:justify-between">
        {/* 좌측 — 인사말 */}
        <div className="min-w-0 flex-1">
          <div className="mb-s-2 flex items-center gap-s-2">
            <Calendar size={12} className="text-t3" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
              {dateStr}
            </span>
          </div>

          <h1 className="mb-s-2 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] text-t1 sm:text-3xl">
            {greeting}, <span className="text-p">{userName}</span> 님 👋
          </h1>

          <p className="font-body text-sm leading-relaxed text-t2 sm:text-base">
            오늘도 꾸준히 영어 학습을 이어가볼까요?
          </p>
        </div>

        {/* 우측 — 미니 통계 (이번 주) */}
        <div className="flex flex-shrink-0 items-center gap-s-4 sm:gap-s-6">
          <div className="text-center sm:text-right">
            <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
              이번 주
            </div>
            <div className="font-display text-xl font-extrabold tabular-nums leading-none text-t1 sm:text-2xl">
              {weekDays}
              <span className="ml-[2px] text-base font-semibold text-t2">일</span>
            </div>
          </div>

          <div className="h-10 w-px bg-bd" />

          <div className="text-center sm:text-right">
            <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
              학습한 단어
            </div>
            <div className="font-display text-xl font-extrabold tabular-nums leading-none text-t1 sm:text-2xl">
              {weekWords}
              <span className="ml-[2px] text-base font-semibold text-t2">개</span>
            </div>
          </div>

          {/* 데코 아이콘 (데스크톱만) */}
          <div
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl lg:flex"
            style={{
              background: 'linear-gradient(135deg, var(--p) 0%, var(--combo) 100%)',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
            }}
          >
            <Sparkles size={20} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
