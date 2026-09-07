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

/**
 * 그 주가 몇 주 전인가 — 0 이면 이번 주.
 *
 * 리포트가 언제 것인지 날짜만 적으면 학습자는 그게 최신인지 알 수 없다. 주차 차이를
 * 함께 말해야 "안 만들어지고 있다" 는 사실이 화면에 드러난다.
 */
export function weeksAgo(weekStartIso: string): number {
  const start = new Date(`${weekStartIso}T00:00:00Z`).getTime()
  if (Number.isNaN(start)) return 0
  const WEEK = 7 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((Date.now() - start) / WEEK))
}

export function ManageSection({ overview }: { overview: ManageOverview }) {
  const undiagnosed = overview.vLevel == null
  return (
    <section aria-label="학습 관리" className="flex flex-col gap-3">
      <h2 className="font-display text-[13px] font-[800] uppercase tracking-[0.06em] text-[var(--t2)]">
        학습 관리
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
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
              자료{' '}
              <strong className="font-display text-[var(--t1)]">{overview.plan.itemCount}</strong> ·
              활동{' '}
              <strong className="font-display text-[var(--p)]">
                {overview.plan.activityCount}
              </strong>
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
          {/* ⚠️ **마지막 리포트를 "이번 리포트" 처럼 보여주지 않는다.**
              실측 2026-08-16: `weekly_reports` 에는 전체 통틀어 한 행(6/29 · 0단어)뿐인데
              이 카드가 그걸 날짜만 적어 내걸고 있었다. 학습자는 6주 전 산출물을 자기
              현재 리포트로 읽는다 — 화면은 멀쩡하고 에러도 없다. 몇 주 전인지 함께
              말하면 낡았다는 사실이 화면에서 드러난다. */}
          {overview.latestReport ? (
            <p className="font-body text-[13px] text-[var(--t2)]">
              {fmtKDate(overview.latestReport.week_start)} 주 · 단어{' '}
              {overview.latestReport.total_words}
              {(() => {
                const weeks = weeksAgo(overview.latestReport.week_start)
                return weeks >= 2 ? <span className="text-[var(--t3)]"> · {weeks}주 전</span> : null
              })()}
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
        {/* 히트 영역 44×44 — 글자는 12px 이지만 누르는 곳은 그것보다 커야 한다.
            실측 2026-08-25: 이 링크가 66×18 이었다(세 카드 전부). `-my-3` 로 세로 여백을
            음수 마진으로 되받아 헤더 높이는 그대로 두면서 히트 영역만 넓힌다 —
            안 그러면 카드가 세 번 두꺼워진다. */}
        <Link
          href={href}
          className="-my-3 ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {cta} <ArrowRight size={12} strokeWidth={2} aria-hidden />
        </Link>
      </header>
      {children}
    </section>
  )
}
