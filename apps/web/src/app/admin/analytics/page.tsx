// apps/web/src/app/admin/analytics/page.tsx
// 플랫폼 분석 — 실측 가능한 두 칸 + 나머지는 "집계 경로 없음"
//
// v06.35 이전 이 화면은 DAU 348 · MAU 1,124 · 코호트 리텐션 · 모듈 사용량 · 가입 퍼널을
// 전부 코드 상수로 그렸다. 실제 가입자는 3명이다. 분석 화면의 숫자는 정의상 "판단 근거" 라서,
// 상수가 남아 있으면 이 화면을 여는 것만으로 잘못된 결론이 나온다.
//
// 남긴 것: daily_activity·user_profiles 로 셀 수 있는 오늘 활성 · 누적 가입자.
// 지운 것: WAU/MAU/mastery(집계 경로 없음) · 7일 DAU 상수 시계열 · 코호트 4행(연도 없는
//          11/24~12/21 라벨) · 모듈 사용량 5행 · 퍼널 5단.
// 리텐션과 교사 퍼널은 이미 /admin 대시보드에 실측 패널(RetentionPanel · TeacherFunnelPanel)이
// 있으므로, 여기서 가짜로 다시 그리지 않고 그쪽으로 보낸다.
//
// 'use client' 였지만 훅도 핸들러도 0개였다 — 서버 컴포넌트로 되돌리면서 requireAdmin 게이트를
// 붙였다(클라이언트 컴포넌트에서는 부를 수 없어 이 화면만 가드가 비어 있었다).

import { Activity, BarChart3, Repeat2, Target, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'
import { fmt, getAdminDashboardStats } from '@/lib/admin/dashboard-stats'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: '플랫폼 분석 — Vocaflow Admin',
  description: '오늘 활성 · 누적 가입자 실측 · 미구현 지표 고지',
}

export const dynamic = 'force-dynamic'

interface MissingPanelProps {
  title: string
  reason: string
  href: string
  hrefLabel: string
  span2?: boolean
}

/** 지표가 없다는 사실을 그리는 자리. 막다른 화면이 되지 않도록 항상 다음 한 걸음을 준다. */
function MissingPanel({ title, reason, href, hrefLabel, span2 }: MissingPanelProps) {
  return (
    <section
      aria-label={title}
      className={`rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] p-5 ${
        span2 ? 'lg:col-span-2' : ''
      }`}
    >
      <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</h2>
      <p className="mt-1 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
        {reason}
      </p>
      <Link
        href={href}
        className="mt-3 inline-flex min-h-[44px] items-center font-display text-[12px] font-[700] text-[var(--p)] underline decoration-[var(--p)]/40 underline-offset-2 transition-colors duration-[var(--dur-normal)] hover:decoration-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        {hrefLabel}
      </Link>
    </section>
  )
}

export default async function AdminAnalyticsPage() {
  await requireAdmin('/admin/analytics')
  const stats = await getAdminDashboardStats(createAdminClient())

  const kpis: AdminKpi[] = [
    {
      label: '오늘 활성 (DAU)',
      value: fmt(stats.learners.activeToday),
      icon: Activity,
      accent: 'var(--info)',
      bg: 'var(--info-light)',
      hint: 'daily_activity 의 KST 오늘 행 수',
    },
    {
      label: '누적 가입자',
      value: fmt(stats.learners.total),
      icon: Users,
      accent: 'var(--p)',
      bg: 'var(--p-light)',
      hint: 'user_profiles 행 수 · 요청 시점 실측',
    },
    {
      label: 'WAU',
      value: '—',
      icon: TrendingUp,
      accent: 'var(--t2)',
      bg: 'var(--bg3)',
      hint: '집계할 곳이 없습니다 — 주간 활성 집계 미구현',
    },
    {
      label: '평균 mastery',
      value: '—',
      icon: Target,
      accent: 'var(--t2)',
      bg: 'var(--bg3)',
      hint: '집계할 곳이 없습니다 — 단어별 정답률 집계 미구현',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={BarChart3}
        title="플랫폼 분석"
        description="오늘 활성 · 누적 가입자 실측 · 나머지 지표는 미구현"
      />

      <MockDataBanner
        className="mb-6"
        what="오늘 활성·누적 가입자 두 칸만 DB 실측입니다. WAU·평균 mastery·코호트 리텐션·모듈 사용량·가입 퍼널은 값이 아니라 — 입니다."
        why="이 화면에 있던 DAU 시계열·코호트·퍼널 숫자는 모두 코드 상수였고, 집계 쿼리도 저장 테이블도 없습니다. 리텐션과 교사 퍼널만 대시보드에 실측 패널이 있습니다."
        instead={[
          { label: '리텐션 · 교사 퍼널 (대시보드)', href: '/admin' },
          { label: '품질 지표', href: '/admin/quality' },
        ]}
        plan="계측 이벤트(lib/analytics/events.ts) 적재량이 쌓인 뒤 집계를 붙입니다 — 일정 미정."
      />

      <AdminScreenHelp screen="analytics" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MissingPanel
          span2
          title="DAU 추이"
          reason="요일별 시계열을 집계하는 경로가 없습니다. 이 자리에 있던 7일 곡선은 코드 상수였습니다. 오늘 하루 값은 위 KPI 에 실측으로 있습니다."
          href="/admin"
          hrefLabel="대시보드에서 오늘 학습자 보기"
        />
        <MissingPanel
          title="모듈 사용 빈도"
          reason="모듈별 세션 집계가 없습니다. 이 자리에 있던 5개 막대는 코드 상수였고 9모듈 중 4개는 애초에 빠져 있었습니다."
          href="/admin/quality"
          hrefLabel="품질 지표 보기"
        />
        <MissingPanel
          span2
          title="Retention 코호트"
          reason="여기 있던 4개 코호트(연도 없는 11/24~12/21 라벨)는 코드 상수였습니다. 실측 리텐션은 대시보드의 리텐션 패널이 daily_activity 에서 파생합니다."
          href="/admin"
          hrefLabel="실측 리텐션 패널 열기"
        />
        <MissingPanel
          title="가입 funnel"
          reason="여기 있던 5단(가입 487 → 30일 활성 83)은 코드 상수였습니다. 실제로 기록되는 퍼널은 교사 채널(funnel_events) 뿐입니다."
          href="/admin"
          hrefLabel="교사 퍼널 격차 보기"
        />
      </div>

      <p className="mt-4 flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
        <Repeat2 size={13} aria-hidden />
        지표를 다시 붙일 때는 이 화면이 아니라 집계 함수부터 만듭니다 — 상수를 되돌리면 같은 사고가
        반복됩니다.
      </p>
    </div>
  )
}
