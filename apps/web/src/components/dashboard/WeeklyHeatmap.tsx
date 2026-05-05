// apps/web/src/components/dashboard/WeeklyHeatmap.tsx
//
// 학습 활동 v2 (v06.21.2) — 모던·심플 sparkline 위젯
//
// 이전: 7×7 GitHub 스타일 히트맵 + 3 stats summary + 범례 (~300px)
// 이후: 28일 가로 sparkline + 인라인 stat row + Streak 배지 (~120px)
//
// 디자인 원칙:
//   - Cognitive Load ↓ — 49칸 → 28바 한 행
//   - Implicit Progress — 막대 높이로 학습량 환경 시각화
//   - Calm UI — 단일 액센트색 (--p) + 밝기 변조만
//   - Modern — SVG 정밀 렌더, 부드러운 gradient, 오늘 강조 ring
//   - 정서적 부호화 — Streak 배지 inline 강조 (신기록 시 amber)

'use client'

import { Flame, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'

// ── 데이터 ───────────────────────────────────────────────────────
export interface ActivityDay {
  date: Date
  minutes: number
  words: number
}

const DAYS = 28

function generateMockData(): ActivityDay[] {
  const days: ActivityDay[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const seed = date.getDate() + date.getMonth() * 31
    const random = Math.sin(seed) * 10000
    const intensity = Math.abs(random - Math.floor(random))
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const baseMinutes = isWeekend ? 5 : 18
    const minutes = intensity < 0.18 ? 0 : Math.floor(baseMinutes + intensity * 55)
    const words = Math.floor(minutes * 1.5)
    days.push({ date, minutes, words })
  }
  return days
}

// ── Streak 계산 ──────────────────────────────────────────────────
function calcStreak(days: ActivityDay[]): { current: number; isRecord: boolean } {
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].minutes > 0) streak++
    else break
  }
  // 신기록 판정: 28일 내 streak 가 가장 길면 record
  let maxStreak = 0
  let cur = 0
  for (const d of days) {
    if (d.minutes > 0) {
      cur++
      if (cur > maxStreak) maxStreak = cur
    } else {
      cur = 0
    }
  }
  return { current: streak, isRecord: streak > 0 && streak >= maxStreak }
}

// ── 포맷 ─────────────────────────────────────────────────────────
function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── 메인 ─────────────────────────────────────────────────────────
export function WeeklyHeatmap() {
  const days = useMemo(() => generateMockData(), [])
  const streak = useMemo(() => calcStreak(days), [days])

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0)
  const totalWords = days.reduce((s, d) => s + d.words, 0)
  const studiedDays = days.filter((d) => d.minutes > 0).length

  // SVG sparkline 디멘션
  const BAR_W = 8
  const BAR_GAP = 4
  const MAX_H = 36
  const BASELINE_PAD = 2
  const totalW = days.length * BAR_W + (days.length - 1) * BAR_GAP
  const totalH = MAX_H + BASELINE_PAD

  // 정규화 — 최대 학습량 기준
  const peakMinutes = Math.max(...days.map((d) => d.minutes), 1)

  return (
    <section
      aria-label="학습 활동 — 지난 28일"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-4"
    >
      {/* Header — 제목 + Streak 배지 */}
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[14px] font-[700] tracking-tight text-[var(--t1)]">
            학습 활동
          </h2>
          <span className="font-mono text-[10px] font-[600] uppercase tracking-[0.1em] text-[var(--t3)]">
            지난 28일
          </span>
        </div>

        {streak.current > 0 && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[11px] font-[700] ${
              streak.isRecord
                ? 'bg-[var(--warning-light)] text-[#92400E]'
                : 'bg-[var(--bg2)] text-[var(--t1)]'
            }`}
            aria-label={`${streak.current}일 연속 학습 ${streak.isRecord ? '신기록' : ''}`}
          >
            {streak.isRecord ? (
              <TrendingUp size={12} strokeWidth={2.5} aria-hidden />
            ) : (
              <Flame size={12} strokeWidth={2.5} aria-hidden className="text-[#EC4899]" />
            )}
            <span className="tabular-nums">{streak.current}일 연속</span>
            {streak.isRecord && (
              <span className="font-mono text-[9px] font-[700] uppercase tracking-wider opacity-80">
                신기록
              </span>
            )}
          </span>
        )}
      </header>

      {/* Sparkline 28일 */}
      <div
        className="relative w-full overflow-x-auto pb-1 [scrollbar-width:thin]"
        role="img"
        aria-label={`최근 28일 중 ${studiedDays}일 학습, 총 ${formatHM(totalMinutes)}, ${totalWords}단어`}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${totalW} ${totalH}`}
          height={totalH}
          preserveAspectRatio="none"
          className="block"
        >
          <defs>
            <linearGradient id="dash-bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--p)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--p)" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* 베이스라인 */}
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
            const isStudied = day.minutes > 0

            if (!isStudied) {
              // 학습 없는 날 — 베이스라인 위 작은 점
              return (
                <circle
                  key={i}
                  cx={x + BAR_W / 2}
                  cy={totalH - 1.5}
                  r="1"
                  fill="var(--t4)"
                  aria-hidden
                >
                  <title>{`${formatDateShort(day.date)} · 학습 없음`}</title>
                </circle>
              )
            }

            const norm = day.minutes / peakMinutes
            const h = Math.max(2, Math.round(norm * MAX_H))
            const y = MAX_H - h + BASELINE_PAD

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={h}
                  rx={1.5}
                  fill="url(#dash-bar-grad)"
                  className="transition-opacity duration-[var(--dur-normal)] hover:opacity-100"
                  opacity={isToday ? 1 : 0.85}
                >
                  <title>{`${formatDateShort(day.date)} · ${day.minutes}분 · ${day.words}단어`}</title>
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

      {/* 인라인 stat row */}
      <dl className="mt-3 flex items-center gap-1 border-t border-[var(--bd)] pt-3 font-display">
        <Stat label="학습일" value={`${studiedDays}/${days.length}일`} emphasis />
        <Divider />
        <Stat label="시간" value={formatHM(totalMinutes)} />
        <Divider />
        <Stat label="단어" value={`${totalWords.toLocaleString()}개`} />
      </dl>
    </section>
  )
}

// ── 헬퍼 ─────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <dt className="font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-[var(--t3)]">
        {label}
      </dt>
      <dd
        className={`tabular-nums leading-none ${
          emphasis
            ? 'font-display text-[16px] font-[800] text-[var(--t1)]'
            : 'font-display text-[14px] font-[700] text-[var(--t1)]'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="h-6 w-px bg-[var(--bd)]" />
}
