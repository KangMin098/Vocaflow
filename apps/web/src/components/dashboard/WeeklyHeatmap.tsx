// apps/web/src/components/dashboard/WeeklyHeatmap.tsx
// 학습 활동 히트맵 — GitHub contribution 스타일
// 7주 × 7일 그리드, 색상 강도로 학습량 표시

'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useMemo } from 'react'

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface HeatmapDay {
  date: Date
  /** 학습량 (분) */
  minutes: number
  /** 학습 단어 수 */
  words: number
}

// ══════════════════════════════════════════════════════════════
// 목업 데이터 생성 (Phase 2에서 실제 데이터로 교체)
// ══════════════════════════════════════════════════════════════
function generateMockData(weeks: number = 7): HeatmapDay[] {
  const days: HeatmapDay[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 오늘부터 거꾸로 (weeks * 7)일
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // 랜덤 학습 데이터 (씨드 사용 — 동일 결과 위해)
    const seed = date.getDate() + date.getMonth() * 31
    const random = Math.sin(seed) * 10000
    const intensity = Math.abs(random - Math.floor(random))

    // 일요일은 학습 적음, 평일은 많음
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const baseMinutes = isWeekend ? 5 : 15
    const minutes = intensity < 0.2 ? 0 : Math.floor(baseMinutes + intensity * 50)
    const words = Math.floor(minutes * 1.5)

    days.push({ date, minutes, words })
  }

  return days
}

// ══════════════════════════════════════════════════════════════
// 학습 강도 → 색상 매핑 (GitHub 스타일)
// ══════════════════════════════════════════════════════════════
function getIntensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0) return 0
  if (minutes < 10) return 1
  if (minutes < 20) return 2
  if (minutes < 35) return 3
  return 4
}

const intensityColors = [
  'var(--bg3)', // 0 — 학습 없음
  'rgba(59, 130, 246, 0.25)', // 1 — 살짝
  'rgba(59, 130, 246, 0.5)', // 2 — 보통
  'rgba(59, 130, 246, 0.75)', // 3 — 많이
  'rgba(59, 130, 246, 1.0)', // 4 — 매우 많이
]

// ══════════════════════════════════════════════════════════════
// 날짜 포맷
// ══════════════════════════════════════════════════════════════
function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

const dayLabels = ['일', '월', '화', '수', '목', '금', '토']

// ══════════════════════════════════════════════════════════════
// WeeklyHeatmap
// ══════════════════════════════════════════════════════════════
export function WeeklyHeatmap() {
  const days = useMemo(() => generateMockData(7), [])

  // 7주 × 7일 그리드로 재구성
  // 각 컬럼이 1주, 각 행이 1요일 (일~토)
  const weeks = useMemo(() => {
    const result: HeatmapDay[][] = Array.from({ length: 7 }, () => [])
    days.forEach((day) => {
      const weekday = day.date.getDay() // 0=일 ~ 6=토
      result[weekday].push(day)
    })
    return result
  }, [days])

  // 통계 요약
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const totalWords = days.reduce((sum, d) => sum + d.words, 0)
  const studiedDays = days.filter((d) => d.minutes > 0).length
  const totalDays = days.length

  return (
    <Card variant="default" padding="md" className="h-full rounded-xl">
      <CardHeader>
        <CardTitle>학습 활동</CardTitle>
        <CardDescription>최근 7주 동안의 학습 기록</CardDescription>
      </CardHeader>

      {/* 통계 요약 */}
      <div className="mb-s-5 grid grid-cols-3 gap-s-3">
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            총 학습일
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-t1">
            {studiedDays}
            <span className="text-sm font-medium text-t3"> / {totalDays}일</span>
          </div>
        </div>
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            총 학습 시간
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-t1">
            {Math.floor(totalMinutes / 60)}
            <span className="text-sm font-medium text-t3">시간 </span>
            {totalMinutes % 60}
            <span className="text-sm font-medium text-t3">분</span>
          </div>
        </div>
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            학습 단어
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-t1">
            {totalWords}
            <span className="text-sm font-medium text-t3">개</span>
          </div>
        </div>
      </div>

      {/* 히트맵 그리드 */}
      <div className="flex gap-s-2">
        {/* 요일 라벨 */}
        <div className="flex flex-col gap-[3px] pt-[2px]">
          {dayLabels.map((label, i) => (
            <div
              key={label}
              className="flex h-[14px] items-center font-mono text-[9px] font-medium text-t3"
            >
              {/* 일·수·금만 표시 */}
              {i === 0 || i === 3 || i === 5 ? label : ''}
            </div>
          ))}
        </div>

        {/* 주별 컬럼 */}
        <div className="grid flex-1 grid-cols-7 gap-[3px]">
          {dayLabels.map((_, weekday) => (
            <div key={weekday} className="flex flex-col gap-[3px]">
              {weeks[weekday].map((day, idx) => {
                const level = getIntensityLevel(day.minutes)
                return (
                  <div
                    key={idx}
                    className="group relative aspect-square w-full cursor-pointer rounded-[3px] transition-transform duration-normal hover:z-10 hover:scale-110"
                    style={{
                      backgroundColor: intensityColors[level],
                      border: level === 0 ? '1px solid var(--bd)' : 'none',
                    }}
                  >
                    {/* 호버 툴팁 */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-s-1 -translate-x-1/2 opacity-0 transition-opacity duration-normal group-hover:opacity-100">
                      <div className="whitespace-nowrap rounded-md bg-t1 px-s-2 py-s-1 font-mono text-[10px] text-bg shadow-lg">
                        <div className="font-bold">{formatDate(day.date)}</div>
                        <div className="text-bg/80">
                          {day.minutes > 0 ? `${day.minutes}분 · ${day.words}단어` : '학습 없음'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-s-4 flex items-center justify-end gap-s-2 font-mono text-[10px] uppercase tracking-wider text-t3">
        <span>적게</span>
        <div className="flex gap-[3px]">
          {intensityColors.map((color, i) => (
            <div
              key={i}
              className="h-3 w-3 rounded-[2px]"
              style={{
                backgroundColor: color,
                border: i === 0 ? '1px solid var(--bd)' : 'none',
              }}
            />
          ))}
        </div>
        <span>많이</span>
      </div>
    </Card>
  )
}
