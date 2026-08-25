// apps/web/src/app/admin/analytics/page.tsx
// 플랫폼 분석 — DAU/MAU · 코호트 · 학습 효과 · funnel

'use client'

import {
  Activity,
  BarChart3,
  Brain,
  Filter,
  Repeat2,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

const KPIS: AdminKpi[] = [
  {
    label: 'DAU',
    value: '348',
    delta: { value: 8, positive: true },
    icon: Activity,
    accent: 'var(--info)',
    bg: 'var(--info-light)',
    hint: '오늘 활성',
  },
  {
    label: 'WAU',
    value: '892',
    delta: { value: 4, positive: true },
    icon: Users,
    accent: 'var(--p)',
    bg: 'var(--p-light)',
  },
  {
    label: 'MAU',
    value: '1,124',
    delta: { value: 12, positive: true },
    icon: TrendingUp,
    accent: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    label: '평균 mastery',
    value: '64%',
    delta: { value: 3, positive: true },
    icon: Target,
    accent: 'var(--success)',
    bg: 'var(--success-light)',
    hint: '단어별 정답률 가중',
  },
]

// ── 7일 DAU 라인 데이터 (mock) ──
const DAU_DATA = [
  { day: '월', value: 312 },
  { day: '화', value: 348 },
  { day: '수', value: 372 },
  { day: '목', value: 410 },
  { day: '금', value: 384 },
  { day: '토', value: 280 },
  { day: '일', value: 298 },
]

// ── Retention 코호트 ──
const COHORTS = [
  { label: '11/24~11/30', size: 84, d1: 76, d7: 52, d30: 31 },
  { label: '12/01~12/07', size: 102, d1: 81, d7: 58, d30: 35 },
  { label: '12/08~12/14', size: 91, d1: 79, d7: 54, d30: 33 },
  { label: '12/15~12/21', size: 110, d1: 84, d7: 60, d30: null },
]

// ── 모듈 사용 빈도 ──
const MODULE_USAGE = [
  { name: 'Flashcard', sessions: 1240, color: '#EC4899' },
  { name: 'WordVault', sessions: 980, color: '#8B5CF6' },
  { name: 'SpellForge', sessions: 712, color: '#F97316' },
  { name: 'ScriptQuiz', sessions: 540, color: '#EAB308' },
  { name: 'WordBlitz', sessions: 488, color: '#10B981' },
]

// ── Funnel ──
const FUNNEL = [
  { label: '가입', value: 100, count: 487 },
  { label: '첫 스크립트 입력', value: 64, count: 312 },
  { label: '첫 학습 시작', value: 51, count: 248 },
  { label: '7일 활성', value: 28, count: 136 },
  { label: '30일 활성', value: 17, count: 83 },
]

const maxDau = Math.max(...DAU_DATA.map((d) => d.value))
const maxModule = Math.max(...MODULE_USAGE.map((m) => m.sessions))

export default function AdminAnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={BarChart3}
        title="플랫폼 분석"
        description="DAU/MAU · retention · 학습 효과 · funnel"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]">
            <Filter size={14} aria-hidden />
            기간 · 7일
          </button>
        }
      />

      <AdminScreenHelp screen="analytics" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* DAU 라인 (2 cols) */}
        <section
          aria-label="DAU 추이"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--info-light)] text-[var(--info)]">
              <Activity size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최근 7일 DAU</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t2)]">
              avg {Math.round(DAU_DATA.reduce((s, d) => s + d.value, 0) / DAU_DATA.length)}
            </span>
          </header>

          {/* SVG 라인 차트 */}
          <svg viewBox="0 0 700 200" className="h-[180px] w-full" preserveAspectRatio="none">
            {/* grid */}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="0"
                x2="700"
                y1={(i * 200) / 3}
                y2={(i * 200) / 3}
                stroke="var(--bg3)"
                strokeDasharray="4 4"
              />
            ))}
            {/* area */}
            <path
              d={`M 0,${200 - (DAU_DATA[0].value / maxDau) * 180} ${DAU_DATA.map(
                (d, i) =>
                  `L ${(i * 700) / (DAU_DATA.length - 1)},${
                    200 - (d.value / maxDau) * 180
                  }`
              ).join(' ')} L 700,200 L 0,200 Z`}
              fill="var(--info)"
              opacity="0.10"
            />
            {/* line */}
            <polyline
              points={DAU_DATA.map(
                (d, i) =>
                  `${(i * 700) / (DAU_DATA.length - 1)},${200 - (d.value / maxDau) * 180}`
              ).join(' ')}
              fill="none"
              stroke="var(--info)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* dots */}
            {DAU_DATA.map((d, i) => (
              <circle
                key={i}
                cx={(i * 700) / (DAU_DATA.length - 1)}
                cy={200 - (d.value / maxDau) * 180}
                r="4"
                fill="var(--info)"
              />
            ))}
          </svg>

          <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--t2)]">
            {DAU_DATA.map((d, i) => (
              <span key={i}>{d.day}</span>
            ))}
          </div>
        </section>

        {/* 모듈 사용 빈도 */}
        <section
          aria-label="모듈 사용 빈도"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]">
              <Brain size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
              모듈 사용 빈도
            </h2>
          </header>
          <ul className="space-y-3">
            {MODULE_USAGE.map((m) => (
              <li key={m.name}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[12px] font-[600] text-[var(--t1)]">
                    {m.name}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {m.sessions.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
                    style={{
                      width: `${(m.sessions / maxModule) * 100}%`,
                      backgroundColor: m.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Retention cohort */}
        <section
          aria-label="Retention 코호트"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[#F5F3FF] text-[#8B5CF6]">
              <Repeat2 size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
              Retention 코호트
            </h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t2)]">D1 · D7 · D30</span>
          </header>
          <table className="w-full text-left">
            <thead>
              <tr>
                {['주차', '신규', 'D1', 'D7', 'D30'].map((h) => (
                  <th
                    key={h}
                    className="pb-2 font-mono text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bd)]">
              {COHORTS.map((c) => (
                <tr key={c.label}>
                  <td className="py-3 font-mono text-[11px] text-[var(--t2)]">{c.label}</td>
                  <td className="py-3 font-display text-[13px] font-[700] tabular-nums text-[var(--t1)]">
                    {c.size}
                  </td>
                  {[c.d1, c.d7, c.d30].map((v, i) => (
                    <td key={i} className="py-3">
                      {v === null ? (
                        <span className="font-mono text-[10px] text-[var(--t2)]">—</span>
                      ) : (
                        <RetentionCell value={v} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Funnel */}
        <section
          aria-label="가입 funnel"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--success-light)] text-[var(--success)]">
              <Target size={13} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">가입 funnel</h2>
          </header>
          <ul className="space-y-2">
            {FUNNEL.map((f, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[11px] font-[600] text-[var(--t2)]">
                    {f.label}
                  </span>
                  <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t1)]">
                    {f.count}{' '}
                    <span className="font-[400] text-[var(--t2)]">({f.value}%)</span>
                  </span>
                </div>
                <div
                  className="mt-1 h-3 rounded-[var(--r-sm)] bg-gradient-to-r from-[var(--p)] to-[#8B5CF6] transition-[width] duration-[var(--dur-slow)]"
                  style={{ width: `${f.value}%` }}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function RetentionCell({ value }: { value: number }) {
  // 회복력 따라 색상 강도 (0~100% mapping)
  const intensity = Math.min(value / 80, 1)
  return (
    <span
      className="inline-flex min-w-[44px] justify-center rounded-[var(--r-sm)] px-2 py-1 font-mono text-[11px] font-[700] tabular-nums"
      style={{
        backgroundColor: `rgba(139, 92, 246, ${0.08 + intensity * 0.18})`,
        color: '#6D28D9',
      }}
    >
      {value}%
    </span>
  )
}
