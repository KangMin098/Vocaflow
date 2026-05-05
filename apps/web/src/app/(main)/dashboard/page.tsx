// apps/web/src/app/(main)/dashboard/page.tsx
// 대시보드 — CLAUDE.md §13 + §"디자인 철학" 적용
//   · 암묵적 진행 (Implicit Progress) — 숫자보다 환경 변화로 성장 시각화
//   · 정서적 부호화 — Streak·신기록을 자기효능감으로 연결
//   · 인지 부하 관리 — 4 KPI + 4 위젯 (한 화면에 8 항목 한계)
//
// 'use client' — KPIS 배열에 LucideIcon (함수 참조) 를 담아 client-only StatCard 로
// 전달하므로 페이지 자체가 Client Component 여야 함. metadata 는 layout.tsx 로 분리.

'use client'

import { BookMarked, Flame, Sparkles, Target, type LucideIcon } from 'lucide-react'

import { ModuleAccuracyRing } from '@/components/dashboard/ModuleAccuracyRing'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'

interface KPI {
  label: string
  value: string | number
  unit?: string
  icon: LucideIcon
  accent: string
  trend: 'up' | 'down' | 'flat' | 'record'
  trendText: string
  subtext: string
}

const KPIS: KPI[] = [
  {
    label: '오늘 학습',
    value: 23,
    unit: '단어',
    icon: BookMarked,
    accent: 'var(--p)',
    trend: 'up',
    trendText: '+5',
    subtext: '/30 단어 목표',
  },
  {
    label: '연속 학습',
    value: 12,
    unit: '일',
    icon: Flame,
    accent: '#EC4899',
    trend: 'record',
    trendText: '신기록',
    subtext: '이번 달 최장',
  },
  {
    label: '누적 단어',
    value: '847',
    icon: Sparkles,
    accent: '#8B5CF6',
    trend: 'up',
    trendText: '+47',
    subtext: '이번 주',
  },
  {
    label: '평균 정확도',
    value: 87,
    unit: '%',
    icon: Target,
    accent: 'var(--success)',
    trend: 'up',
    trendText: '+3%',
    subtext: '지난 주 대비',
  },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      {/* ── Welcome ── */}
      <WelcomeBanner userName="학습자" weekDays={5} weekWords={47} />

      {/* ── KPI 4종 ── (헤더 생략 — WelcomeBanner 가 충분한 컨텍스트 제공) */}
      <section aria-label="핵심 지표" className="mb-6">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPIS.map((k) => (
            <li key={k.label}>
              <StatCard
                variant="card"
                label={k.label}
                value={k.value}
                unit={k.unit}
                icon={k.icon}
                accentColor={k.accent}
                trend={k.trend}
                trendText={k.trendText}
                subtext={k.subtext}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Weekly heatmap (full width) ── */}
      <section aria-label="주간 학습 히트맵" className="mb-6">
        <WeeklyHeatmap />
      </section>

      {/* ── Module Accuracy + Score Trend (2 cols) ── */}
      <section
        aria-label="모듈 정확도 및 점수 추이"
        className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <ModuleAccuracyRing />
        <ScoreTrendChart />
      </section>

      {/* ── Recent Activity (compact pill row) ── */}
      <RecentActivity />

      {/* ── Calm closing message — 정서적 부호화 ── */}
      <footer className="mt-12 text-center">
        <p className="font-english text-[14px] italic leading-relaxed text-[var(--t3)]">
          “Slow is smooth, smooth is fast.”
        </p>
        <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
          오늘도 차분한 페이스로 잘 해내고 있어요.
        </p>
      </footer>
    </div>
  )
}
