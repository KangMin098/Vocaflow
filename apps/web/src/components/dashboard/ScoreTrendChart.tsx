// apps/web/src/components/dashboard/ScoreTrendChart.tsx
// 점수 추이 라인 차트 (recharts)

'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// ══════════════════════════════════════════════════════════════
// 목업 데이터 — 30일간 점수 추이
// ══════════════════════════════════════════════════════════════
function generateScoreData() {
  const data = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // 점진적 상승 트렌드 + 약간의 변동
    const seed = date.getDate() + date.getMonth() * 31
    const random = Math.sin(seed) * 10000
    const noise = (Math.abs(random - Math.floor(random)) - 0.5) * 20

    const baseScore = 60 + (29 - i) * 1.2 // 점진적 상승
    const score = Math.max(0, Math.min(100, Math.round(baseScore + noise)))

    data.push({
      date: date.toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      }),
      score,
      fullDate: date,
    })
  }

  return data
}

// ══════════════════════════════════════════════════════════════
// Custom Tooltip
// ══════════════════════════════════════════════════════════════
interface TooltipProps {
  active?: boolean
  payload?: Array<{
    payload: { date: string; score: number; fullDate: Date }
    value: number
  }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  const dateStr = data.fullDate.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="rounded-lg border border-bd bg-bg px-s-3 py-s-2 shadow-lg">
      <div className="mb-s-1 font-mono text-[10px] uppercase tracking-wider text-t3">{dateStr}</div>
      <div className="flex items-baseline gap-s-1">
        <span className="font-display text-lg font-extrabold tabular-nums text-p">
          {data.score}
        </span>
        <span className="font-body text-xs text-t2">점</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ScoreTrendChart
// ══════════════════════════════════════════════════════════════
export function ScoreTrendChart() {
  const data = useMemo(() => generateScoreData(), [])

  // 통계
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length)
  const maxScore = Math.max(...data.map((d) => d.score))
  const lastScore = data[data.length - 1].score
  const firstScore = data[0].score
  const change = lastScore - firstScore
  const changePct = Math.round((change / firstScore) * 100)

  return (
    <Card variant="default" padding="md" className="h-full rounded-xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>점수 추이</CardTitle>
            <CardDescription>최근 30일 게임 평균 점수</CardDescription>
          </div>

          {/* 변화 chip */}
          <div
            className={`inline-flex items-center gap-s-1 rounded-md px-s-2 py-[2px] font-mono text-[11px] font-bold tabular-nums ${
              change >= 0 ? 'bg-success-light text-success' : 'bg-error-light text-error'
            }`}
          >
            <span>
              {change >= 0 ? '↗' : '↘'} {change >= 0 ? '+' : ''}
              {changePct}%
            </span>
          </div>
        </div>
      </CardHeader>

      {/* 통계 요약 */}
      <div className="mb-s-4 grid grid-cols-3 gap-s-3">
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            현재
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-t1">
            {lastScore}
            <span className="text-sm font-medium text-t3">점</span>
          </div>
        </div>
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            30일 평균
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-t1">
            {avgScore}
            <span className="text-sm font-medium text-t3">점</span>
          </div>
        </div>
        <div>
          <div className="mb-s-1 font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            최고 기록
          </div>
          <div className="font-display text-xl font-extrabold tabular-nums text-active">
            {maxScore}
            <span className="text-sm font-medium text-t3">점</span>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="-ml-s-3 -mr-s-2 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--p)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--p)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />

            <XAxis
              dataKey="date"
              tick={{
                fill: 'var(--t3)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              domain={[0, 100]}
              tick={{
                fill: 'var(--t3)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
              tickLine={false}
              axisLine={false}
              width={28}
              ticks={[0, 25, 50, 75, 100]}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--p)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--p)"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: 'var(--p)',
                stroke: 'var(--bg)',
                strokeWidth: 2,
              }}
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
