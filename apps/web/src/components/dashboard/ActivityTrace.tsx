// apps/web/src/components/dashboard/ActivityTrace.tsx
//
// 28일 실제 흐름 — **리뷰 건수** 기준.
//
// 무엇을 대체했나: `WeeklyHeatmap`(daily_activity.total_minutes 기반).
// 그 컴포넌트는 `minutes > 0` 을 "학습한 날" 로 판정했는데, minutes 를 채우는 트리거가
// `ROUND(duration_seconds/60.0)` 이라 **60초 미만 세션이 0분으로 반올림**된다.
// 실측(2026-08-15): 최근 8일 연속 활동(리뷰 120·142·33·49…)이 있는 계정에
//   · 히트맵          → "28일 중 **1일** 학습"
//   · 그 자신의 streak 계산(minutes 기반) → **0일 연속**
//   · 셸 상태 띠(user_stats.current_streak) → **3일 연속**
//   · 히어로          → **3일 연속**
// 한 화면에 연속일이 세 종류로 떠 있었다. 게다가 통계줄은 "시간 1분 · 단어 301개" 라는
// 자기모순(1분에 301단어)을 그대로 인쇄했다.
//
// 그래서 이 컴포넌트는 **분을 그리지 않는다.** 기록되지 않는 값은 화면에 없는 편이 정직하다.
// 연속일도 자체 계산하지 않고 `memory-horizon` 이 정한 단일 정의를 받아 쓴다.

'use client'

import { useMemo } from 'react'

import { Flame } from 'lucide-react'

import type { TraceDay } from '@/lib/learner/growth-math'

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

export function ActivityTrace({
  days,
  streak,
  activeDays,
}: {
  days: TraceDay[]
  streak: number
  activeDays: number
}) {
  const { totalReviews, totalWords, peak, rhythm, bestWeekday } = useMemo(() => {
    let reviews = 0
    let words = 0
    let max = 1
    // 요일별 리듬 — 월(0)~일(6). 4주치를 요일로 접으면 "나는 언제 하는 사람인가" 가 보인다.
    const byWeekday = Array.from({ length: 7 }, () => 0)
    for (const d of days) {
      reviews += d.reviews
      words += d.words
      if (d.reviews > max) max = d.reviews
      // 'YYYY-MM-DD' 를 KST 자정 기준으로 읽는다. UTC 로 파싱하면 요일이 하루 밀린다.
      const dow = new Date(`${d.date}T00:00:00+09:00`).getUTCDay()
      byWeekday[(dow + 6) % 7] += d.reviews
    }
    const peakWeekday = Math.max(...byWeekday)
    const rhythm = byWeekday.map((v) => (peakWeekday > 0 ? v / peakWeekday : 0))
    const bestWeekday = peakWeekday > 0 ? byWeekday.indexOf(peakWeekday) : -1
    return { totalReviews: reviews, totalWords: words, peak: max, rhythm, bestWeekday }
  }, [days])

  // SVG 치수 — 28개 막대 한 행.
  const BAR_W = 8
  const BAR_GAP = 4
  const MAX_H = 40
  const PAD = 2
  const totalW = days.length * BAR_W + (days.length - 1) * BAR_GAP
  const totalH = MAX_H + PAD

  // ⚠️ 루트에 `min-w-0` 필수 — RescuedWords 와 같은 이유(그 파일 주석 참조).
  return (
    <section
      aria-label="학습 흐름 — 지난 28일"
      data-design-card=""
      className="flex min-w-0 flex-col rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-6"
    >
      <header className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          지난 28일
        </p>
        {/* 0이면 그리지 않는다 — 압박 금지(철학 ③). 신기록 배지도 두지 않는다:
            연속을 기록으로 만들면 끊기는 날이 실패가 된다(streak 불안). */}
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--bg2)] px-3 py-1 font-display text-[11px] font-[700] text-[var(--t1)]"
            aria-label={`${streak}일 연속 학습 중`}
          >
            <Flame size={11} strokeWidth={2.5} className="text-[var(--active)]" aria-hidden />
            <span className="tabular-nums">{streak}일 연속</span>
          </span>
        )}
      </header>

      <div
        className="mt-4 w-full"
        role="img"
        aria-label={`최근 28일 중 ${activeDays}일 학습, 리뷰 ${totalReviews}건, 단어 ${totalWords}개`}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${totalW} ${totalH}`}
          height={totalH}
          preserveAspectRatio="none"
          className="block"
        >
          <line
            x1="0"
            y1={totalH - 0.5}
            x2={totalW}
            y2={totalH - 0.5}
            stroke="var(--bd)"
            strokeWidth="0.5"
            opacity="0.6"
          />
          {days.map((day, i) => {
            const x = i * (BAR_W + BAR_GAP)
            const isToday = i === days.length - 1

            if (day.reviews === 0) {
              return (
                <circle key={day.date} cx={x + BAR_W / 2} cy={totalH - 1.5} r="1" fill="var(--t4)">
                  <title>{`${shortDate(day.date)} · 기록 없음`}</title>
                </circle>
              )
            }

            const h = Math.max(2, Math.round((day.reviews / peak) * MAX_H))
            const y = MAX_H - h + PAD
            return (
              <g key={day.date}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={h}
                  rx={1.5}
                  fill="var(--p)"
                  opacity={isToday ? 1 : 0.7}
                >
                  <title>{`${shortDate(day.date)} · 리뷰 ${day.reviews}건 · 단어 ${day.words}개`}</title>
                </rect>
                {isToday && (
                  <rect
                    x={x - 0.5}
                    y={y - 0.5}
                    width={BAR_W + 1}
                    height={h + 1}
                    rx={2}
                    fill="none"
                    stroke="var(--p-dark)"
                    strokeWidth="1"
                    aria-hidden
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* 분(minutes)은 없다 — 위 주석 참조. 실제로 세는 것만 인쇄한다.
          `8/28일` 로 쓰면 8월 28일로 읽힌다(실측 라운드 1에서 그렇게 읽혔다). */}
      <dl className="mt-4 flex items-center gap-1 border-t border-[var(--bd)] pt-4">
        <Stat label="학습일" value={`${days.length}일 중 ${activeDays}일`} />
        <Divider />
        <Stat label="리뷰" value={`${totalReviews.toLocaleString()}건`} />
        <Divider />
        <Stat label="단어" value={`${totalWords.toLocaleString()}개`} />
      </dl>

      {/* 요일 리듬 — "나는 언제 하는 사람인가".
          점수가 아니라 성향이라 어떤 값이 나와도 학습자를 탓하지 않는다. 빈 카드 아래쪽을
          메우려고 넣은 것이 아니라, 4주치를 요일로 접었을 때만 보이는 것이 실제로 있다. */}
      {bestWeekday >= 0 && (
        <div className="mt-auto border-t border-[var(--bd)] pt-4">
          <div className="flex items-end gap-2">
            {WEEKDAYS.map((label, i) => (
              <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span
                  aria-hidden
                  className="w-full rounded-[var(--r-sm)]"
                  style={{
                    height: `${4 + rhythm[i] * 18}px`,
                    background:
                      rhythm[i] > 0
                        ? `color-mix(in srgb, var(--p) ${25 + rhythm[i] * 75}%, var(--bg3))`
                        : 'var(--bg3)',
                  }}
                />
                <span
                  className={`font-mono text-[10px] ${
                    i === bestWeekday
                      ? 'font-[700] text-[var(--t1)]'
                      : 'font-[600] text-[var(--t3)]'
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 font-body text-[12px] leading-snug text-[var(--t2)] [word-break:keep-all]">
            주로 <strong className="font-display text-[var(--t1)]">{WEEKDAYS[bestWeekday]}요일</strong>에
            하는 편이에요.
          </p>
        </div>
      )}
    </section>
  )
}

/** 월요일 시작 — 한국 달력 관습. */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <dt className="font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
        {label}
      </dt>
      <dd className="font-display text-[15px] font-[700] leading-none tabular-nums text-[var(--t1)]">
        {value}
      </dd>
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="h-6 w-px bg-[var(--bd)]" />
}
