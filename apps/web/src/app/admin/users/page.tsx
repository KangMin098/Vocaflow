// apps/web/src/app/admin/users/page.tsx
// 사용자 관리 — 가입자 실측 KPI + 미구현 영역 고지
//
// v06.35 이전 이 화면은 DB 를 한 번도 읽지 않고 "총 사용자 1,247" 을 그렸다.
// 실제 user_profiles 는 3 행이다(2026-09-05 실측) — 415 배. 운영 화면 첫 장의 숫자는
// 그대로 판단 근거가 되므로, 이 화면은 이제 상수를 두지 않는다:
//   · 셀 수 있는 것(가입자 · 오늘 활성)은 lib/admin/dashboard-stats.ts 가 센 값만 쓴다.
//   · 셀 곳이 없는 것(구독 · 제재)은 0 이 아니라 — 로 두고 "집계할 곳이 없음" 을 적는다.
//     0 으로 뭉개면 "제재 0건" 이라는 거짓 안심이 남는다.
// 목록(7명)·검색·필터·초대·⋯ 는 전부 가짜 행 위에서만 동작하던 장치라 함께 걷어냈다.

import { Crown, TrendingUp, UserX, Users } from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'
import { fmt, getAdminDashboardStats } from '@/lib/admin/dashboard-stats'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: '사용자 관리 — Vocaflow Admin',
  description: '가입자 실측 · 미구현 영역 고지',
}

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  await requireAdmin('/admin/users')
  const stats = await getAdminDashboardStats(createAdminClient())

  const kpis: AdminKpi[] = [
    {
      label: '총 사용자',
      value: fmt(stats.learners.total),
      icon: Users,
      accent: 'var(--p)',
      bg: 'var(--p-light)',
      hint: 'user_profiles 행 수 · 요청 시점 실측',
    },
    {
      label: '오늘 활성',
      value: fmt(stats.learners.activeToday),
      icon: TrendingUp,
      accent: 'var(--info)',
      bg: 'var(--info-light)',
      hint: 'daily_activity 의 KST 오늘 행 수',
    },
    {
      label: 'Pro 구독',
      value: '—',
      icon: Crown,
      accent: 'var(--t2)',
      bg: 'var(--bg3)',
      hint: '집계할 곳이 없습니다 — 구독 테이블 미구현',
    },
    {
      label: '제재 계정',
      value: '—',
      icon: UserX,
      accent: 'var(--t2)',
      bg: 'var(--bg3)',
      hint: '집계할 곳이 없습니다 — 제재 처리 미구현',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Users}
        title="사용자 관리"
        description="가입자 실측 · 계정별 조치는 아직 없음"
      />

      <MockDataBanner
        className="mb-6"
        what="가입자·오늘 활성 두 칸만 DB 실측이고, 구독·제재는 값이 아니라 — 입니다."
        why="구독(subscriptions)·결제·제재 이력 테이블이 존재하지 않아 셀 대상이 없습니다. 계정별 조치(제재·플랜 변경·초대)도 아직 구현돼 있지 않습니다."
        instead={[
          { label: '파이프라인 실측 대시보드', href: '/admin' },
          { label: '품질 지표', href: '/admin/quality' },
        ]}
        plan="연동 일정 미정 — 결제 PG 연동이 선행 조건입니다."
      />

      <AdminScreenHelp screen="users" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={kpis} />

      <section
        aria-label="계정별 관리"
        className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-6 py-10 text-center"
      >
        <span
          className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]"
          aria-hidden
        >
          <Users size={18} />
        </span>
        <h2 className="mt-3 font-display text-[14px] font-[700] text-[var(--t1)]">
          계정별 목록·조치는 아직 없습니다
        </h2>
        <p className="mx-auto mt-1 max-w-[52ch] break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
          이 자리에 있던 7명은 코드에 박힌 예시였습니다. 실제 가입자는 위 KPI 의 수가 전부이고,
          계정을 열어 보거나 제재하는 경로는 만들지 않았습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/admin"
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            대시보드에서 실측 보기
          </Link>
          <Link
            href="/admin/quality"
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            품질 지표
          </Link>
        </div>
      </section>
    </div>
  )
}
