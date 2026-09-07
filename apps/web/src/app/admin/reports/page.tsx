// apps/web/src/app/admin/reports/page.tsx
// 신고/문의 — 저장할 테이블 자체가 없다는 사실을 그리는 화면
//
// v06.35 이전 이 화면은 "미처리 7 · 처리중 12 · 오늘 해결 8 · 평균 응답 2.4h" 와 신고 6건을
// 코드 상수로 그렸다. `to_regclass('public.reports')` 는 NULL 이다(2026-09-05 실측) —
// 신고를 받는 경로도, 저장하는 표도 없다. "미처리 7건" 은 존재하지 않는 큐를 있는 것처럼 보이게
// 만들고, 반대로 0 으로 적으면 "신고 없음" 이라는 거짓 안심을 준다. 그래서 값은 — 로만 둔다.
//
// 처리 · 상세 버튼은 가짜 행 위에서만 있던 장치라 함께 걷어냈다(핸들러가 없어 눌러도
// 아무 일이 없었고, 그런 버튼은 관리자가 "고장" 으로 신고하게 만든다).

import { CheckCircle2, Clock3, Inbox, MessageSquare, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'

export const metadata = {
  title: '신고/문의 — Vocaflow Admin',
  description: '신고 접수·저장 경로 미구현 고지',
}

const KPIS: AdminKpi[] = [
  {
    label: '미처리',
    value: '—',
    icon: Inbox,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — reports 테이블 없음',
  },
  {
    label: '처리 중',
    value: '—',
    icon: Clock3,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — reports 테이블 없음',
  },
  {
    label: '오늘 해결',
    value: '—',
    icon: CheckCircle2,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 처리 이력 미구현',
  },
  {
    label: '평균 응답',
    value: '—',
    icon: MessageSquare,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — SLA 측정 미구현',
  },
]

export default function AdminReportsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={ShieldAlert}
        title="신고/문의"
        description="접수·저장 경로가 아직 없습니다"
      />

      <MockDataBanner
        className="mb-6"
        what="KPI 4개가 모두 값이 아니라 — 입니다. 신고 목록도 비어 있습니다."
        why="신고를 저장하는 reports 테이블이 존재하지 않습니다(to_regclass NULL · 2026-09-05 실측). 이 화면에 있던 신고 6건과 미처리 7건은 코드 상수였습니다. 사이드바 배지가 보이지 않는 것도 같은 이유이며, 신고가 0건이라는 뜻이 아닙니다."
        instead={[
          { label: '파이프라인 실측 대시보드', href: '/admin' },
          { label: '품질 지표', href: '/admin/quality' },
        ]}
        plan="접수 채널(제보 폼 · 문의 메일)이 정해진 뒤 테이블을 만듭니다 — 일정 미정."
      />

      <AdminScreenHelp screen="reports" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <section
        aria-label="신고 큐"
        className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-6 py-10 text-center"
      >
        <span
          className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]"
          aria-hidden
        >
          <Inbox size={18} />
        </span>
        <h2 className="mt-3 font-display text-[14px] font-[700] text-[var(--t1)]">
          큐가 비어 있는 게 아니라, 큐가 없습니다
        </h2>
        <p className="mx-auto mt-1 max-w-[54ch] break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
          학습자가 신고나 문의를 남길 수 있는 화면도, 그것을 담을 표도 아직 만들지 않았습니다.
          지금 들어오는 제보가 있다면 이 화면이 아니라 다른 경로로 오고 있는 것입니다.
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
            콘텐츠 품질 이상 징후 보기
          </Link>
        </div>
      </section>
    </div>
  )
}
