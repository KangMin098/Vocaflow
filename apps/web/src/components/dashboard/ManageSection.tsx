// apps/web/src/components/dashboard/ManageSection.tsx
// Growth(/dashboard) 의 "학습 관리" 섹션 — Level(수준 측정)·Plan(계획)·Report(리포트) 3 카드.
// /manage 라우트 흡수(v06.108). fetchManageOverview 재사용. 미측정 시 Level 카드 1순위 강조.
// 보기(성장)와 이동(관리)을 분리 — 시각 무게 낮춤 (Calm UI · Cognitive Load).

import { ArrowRight, CalendarRange, Compass, Target } from 'lucide-react'
import Link from 'next/link'

import type { ManageOverview } from '@/lib/learner/manage-overview'

function fmtKDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}

export function ManageSection({ overview }: { overview: ManageOverview }) {
  const undiagnosed = overview.vLevel == null
  return (
    <section aria-label="학습 관리" className="flex flex-col gap-2.5">
      <h2 className="font-display text-[13px] font-[800] uppercase tracking-[0.06em] text-[var(--t2)]">
        학습 관리
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {/* Level — 수준 미측정이면 1순위 강조(alert) */}
        <ManageCard
          icon={<Compass size={16} strokeWidth={1.75} />}
          title="Level"
          href="/diagnostic"
          cta={overview.vLevel ? '다시 측정' : '수준 측정'}
          alert={undiagnosed}
        >
          {overview.vLevel ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              현재 수준{' '}
              <span className="font-display text-[16px] font-[800] text-[var(--p)]">
                V{overview.vLevel}
              </span>
            </p>
          ) : (
            <p className="font-body text-[13px] text-[var(--t2)]">
              5분이면 나에게 맞는 단어가 추천돼요.
            </p>
          )}
        </ManageCard>

        {/* Plan */}
        <ManageCard
          icon={<Target size={16} strokeWidth={1.75} />}
          title="Plan"
          href="/plan"
          cta={overview.plan ? '계획 수정' : '계획 세우기'}
        >
          {overview.plan ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              자료 <strong className="font-display text-[var(--t1)]">{overview.plan.itemCount}</strong> · 활동{' '}
              <strong className="font-display text-[var(--p)]">{overview.plan.activityCount}</strong>
            </p>
          ) : (
            <p className="font-body text-[13px] text-[var(--t2)]">
              자료를 골라 요일별 계획을 세워요.
            </p>
          )}
        </ManageCard>

        {/* Report */}
        <ManageCard
          icon={<CalendarRange size={16} strokeWidth={1.75} />}
          title="Report"
          href="/reports"
          cta="전체 보기"
        >
          {overview.latestReport ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              {fmtKDate(overview.latestReport.week_start)} 주 · 단어 {overview.latestReport.total_words}
            </p>
          ) : (
            <p className="font-body text-[13px] text-[var(--t2)]">학습이 쌓이면 주마다 생겨요.</p>
          )}
        </ManageCard>
      </div>
    </section>
  )
}

function ManageCard({
  icon,
  title,
  href,
  cta,
  alert,
  children,
}: {
  icon: React.ReactNode
  title: string
  href: string
  cta: string
  alert?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      data-design-card
      className={`flex flex-col gap-2 rounded-[var(--r-lg)] border bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-colors duration-[var(--dur-normal)] ${
        alert ? 'border-[var(--p)] ring-1 ring-[var(--p)]' : 'border-[var(--bd)]'
      }`}
    >
      <header className="flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden
        >
          {icon}
        </span>
        <h3 className="font-display text-[14px] font-[800] text-[var(--t1)]">{title}</h3>
        <Link
          href={href}
          className="ml-auto inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {cta} <ArrowRight size={12} strokeWidth={2} aria-hidden />
        </Link>
      </header>
      {children}
    </section>
  )
}
