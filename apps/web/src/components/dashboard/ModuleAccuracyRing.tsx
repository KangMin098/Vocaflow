// apps/web/src/components/dashboard/ModuleAccuracyRing.tsx
// 모듈별 정확도 도넛 차트 (recharts PieChart)

'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

// ══════════════════════════════════════════════════════════════
// 데이터
// ══════════════════════════════════════════════════════════════
const moduleData = [
  { name: 'Flashcard', accuracy: 92, color: '#EC4899', attempts: 145 },
  { name: 'SpellForge', accuracy: 78, color: '#F97316', attempts: 89 },
  { name: 'WordBlitz', accuracy: 85, color: '#10B981', attempts: 67 },
  { name: 'ScriptQuiz', accuracy: 89, color: '#EAB308', attempts: 42 },
]

// ══════════════════════════════════════════════════════════════
// ModuleAccuracyRing
// ══════════════════════════════════════════════════════════════
export function ModuleAccuracyRing() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // 평균 정확도 계산
  const totalAttempts = moduleData.reduce((sum, m) => sum + m.attempts, 0)
  const weightedAccuracy = moduleData.reduce((sum, m) => sum + m.accuracy * m.attempts, 0)
  const avgAccuracy = Math.round(weightedAccuracy / totalAttempts)

  // 호버된 항목 또는 평균
  const displayData = hoveredIdx !== null ? moduleData[hoveredIdx] : null

  // 도넛용 데이터: 각 모듈을 동일 비율로 (그러나 색상 강도는 정확도로 표현)
  const chartData = moduleData.map((m) => ({
    name: m.name,
    value: m.attempts, // 시도 횟수 비율
    color: m.color,
    accuracy: m.accuracy,
  }))

  return (
    <Card variant="default" padding="md" className="h-full rounded-xl">
      <CardHeader>
        <CardTitle>모듈별 정확도</CardTitle>
        <CardDescription>최근 30일 학습 결과</CardDescription>
      </CardHeader>

      {/* 차트 + 중앙 텍스트 */}
      <div className="relative mx-auto mb-s-4 aspect-square max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="95%"
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, idx) => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              animationDuration={800}
              animationBegin={0}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.color}
                  stroke="none"
                  style={{
                    filter:
                      hoveredIdx === idx
                        ? 'brightness(1.1)'
                        : hoveredIdx !== null
                          ? 'opacity(0.4)'
                          : 'none',
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* 중앙 텍스트 — 호버 시 모듈 / 평소 평균 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {displayData ? (
            <>
              <div
                className="mb-s-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: displayData.color }}
              >
                {displayData.name}
              </div>
              <div className="font-display text-3xl font-extrabold tabular-nums leading-none text-t1">
                {displayData.accuracy}
                <span className="text-base font-semibold text-t2">%</span>
              </div>
              <div className="mt-s-1 font-body text-[10px] text-t3">
                {displayData.attempts}회 시도
              </div>
            </>
          ) : (
            <>
              <div className="mb-s-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
                평균 정확도
              </div>
              <div className="font-display text-3xl font-extrabold tabular-nums leading-none text-t1">
                {avgAccuracy}
                <span className="text-base font-semibold text-t2">%</span>
              </div>
              <div className="mt-s-1 font-body text-[10px] text-t3">{totalAttempts}회 시도</div>
            </>
          )}
        </div>
      </div>

      {/* 모듈 리스트 (범례) */}
      <div className="space-y-s-2">
        {moduleData.map((m, i) => (
          <div
            key={m.name}
            className="flex cursor-pointer items-center gap-s-2"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
            <span
              className={`flex-1 font-display text-xs transition-colors duration-normal ${
                hoveredIdx === i ? 'font-semibold text-t1' : 'text-t2'
              }`}
            >
              {m.name}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-t1">{m.accuracy}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
