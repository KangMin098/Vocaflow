// apps/web/src/app/admin/vrl/page.tsx
// VRL Pipeline · Dashboard (실 구현)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Brain, AlertTriangle, GraduationCap, History, Users } from 'lucide-react'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { fetchVrlDashboard, type VrlDashboardData } from '@/lib/admin/vrl/queries'

export const metadata = {
  title: 'VRL Pipeline — Vocaflow Admin',
  description: 'VRL 분류 시스템 대시보드',
}

export const revalidate = 60

export default async function VrlDashboardPage() {
  await requireAdmin('/admin/vrl')

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={Brain}
        title="VRL Pipeline"
        description="VRL 분류 시스템 — shared_dictionary v_level 분류 진행, 데이터 정합, 사용자 V-Level 관리"
      />
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data = await fetchVrlDashboard(client)
  return <DashboardView data={data} />
}

function DashboardView({ data }: { data: VrlDashboardData }) {
  const { kpi, byLevel } = data
  return (
    <div className="flex flex-col gap-6">
      {/* Hero: 전체 진행률 */}
      <section
        className="rounded-[var(--r-xl)] border border-[#8B5CF6]/20 bg-gradient-to-br from-[#8B5CF6]/8 via-[var(--bg)] to-[var(--bg)] p-6 shadow-[var(--sh-sm)]"
        aria-label="전체 분류 진행률"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
              전체 분류 진행
            </p>
            <h2 className="mt-1 font-display text-[32px] font-[800] leading-none text-[var(--t1)]">
              {kpi.classified.toLocaleString()}
              <span className="ml-2 font-body text-[16px] font-[500] text-[var(--t3)]">
                / {kpi.totalWords.toLocaleString()}
              </span>
            </h2>
          </div>
          <div className="text-right">
            <p className="font-display text-[28px] font-[800] text-[#8B5CF6]">
              {kpi.classifiedPct}%
            </p>
            <p className="font-body text-[11px] text-[var(--t3)]">shared_dictionary</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] transition-[width] duration-500"
            style={{ width: `${kpi.classifiedPct}%` }}
            aria-hidden
          />
        </div>
      </section>

      {/* KPI 4 grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="KPI">
        <KpiCard
          icon={AlertTriangle}
          label="의심 단어"
          value={kpi.concernsOpen}
          sub={`${kpi.concernsTotal} 총 / ${kpi.concernsTotal - kpi.concernsOpen} resolved`}
          accent="var(--error)"
          bg="var(--error-light)"
          href="/admin/vrl/concerns"
        />
        <KpiCard
          icon={GraduationCap}
          label="진단 테스트"
          value={kpi.diagnosticTests}
          sub="활성 active"
          accent="var(--info)"
          bg="var(--info-light)"
          href="/admin/vrl/diagnostic"
        />
        <KpiCard
          icon={Users}
          label="사용자 프로필"
          value={kpi.userProfiles}
          sub="V-Level 보유"
          accent="#8B5CF6"
          bg="#8B5CF61A"
          href="/admin/vrl/users"
        />
        <KpiCard
          icon={History}
          label="레벨 Snapshot"
          value={kpi.snapshots}
          sub="audit log"
          accent="var(--active)"
          bg="var(--warning-light)"
          href="/admin/vrl/snapshots"
        />
      </section>

      {/* V-Level 12 진행 */}
      <section
        className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)]"
        aria-label="V-Level별 분류 진행"
      >
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
              V-Level 12단 분류 진행
            </h3>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
              각 레벨의 new_words_in_level 대비 shared_dictionary.v_level 채움률
            </p>
          </div>
          <Link
            href="/admin/vrl/taxonomy"
            className="font-display text-[12px] font-[600] text-[#8B5CF6] hover:underline"
          >
            Taxonomy 상세 →
          </Link>
        </header>

        <ul className="flex flex-col gap-2">
          {byLevel.map((l) => (
            <LevelRow key={l.level} row={l} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  bg,
  href,
}: {
  icon: typeof Brain
  label: string
  value: number
  sub: string
  accent: string
  bg: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: bg, color: accent }}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
          {label}
        </span>
      </div>
      <p
        className="mt-1 font-display text-[28px] font-[800] leading-none"
        style={{ color: accent }}
      >
        {value.toLocaleString()}
      </p>
      <p className="font-body text-[11px] text-[var(--t3)]">{sub}</p>
    </Link>
  )
}

const METHOD_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  claude_verified: { label: '검증', color: 'var(--success)', bg: 'var(--success-light)' },
  partially_verified: {
    label: '부분 검증',
    color: 'var(--info)',
    bg: 'var(--info-light)',
  },
  in_progress: { label: '진행 중', color: 'var(--active)', bg: 'var(--warning-light)' },
  system_inferred: { label: '자동', color: 'var(--t3)', bg: 'var(--bg3)' },
  unverified: { label: '미검증', color: 'var(--t3)', bg: 'var(--bg3)' },
}

function LevelRow({ row }: { row: VrlDashboardData['byLevel'][number] }) {
  const badge =
    row.method != null && METHOD_BADGE[row.method]
      ? METHOD_BADGE[row.method]
      : { label: row.method ?? '—', color: 'var(--t3)', bg: 'var(--bg3)' }
  const pct = Math.max(0, Math.min(100, row.pct))
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,180px)_60px_90px] items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6]/10 font-display text-[12px] font-[700] text-[#8B5CF6]">
        L{row.level}
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-[13px] font-[600] text-[var(--t1)]">
          {row.koreanName}
        </p>
        <p className="font-body text-[10px] text-[var(--t3)]">
          {row.classifiedCount.toLocaleString()} / {(row.newWordsInLevel ?? 0).toLocaleString()}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className="text-right font-mono text-[11px] font-[600] text-[var(--t2)]">
        {pct}%
      </span>
      <span
        className="justify-self-end rounded-full px-2 py-0.5 font-display text-[10px] font-[700]"
        style={{ backgroundColor: badge.bg, color: badge.color }}
      >
        {badge.label}
      </span>
    </li>
  )
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-24 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--r-lg)] bg-[var(--bg2)]" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
