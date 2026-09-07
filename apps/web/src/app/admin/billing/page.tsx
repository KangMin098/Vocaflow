// apps/web/src/app/admin/billing/page.tsx
// 결제/구독 — PG 미연동. 수치가 아니라 "셀 곳이 없다" 를 그린다.
//
// v06.35 이전 이 화면은 MRR ₩1.84M · 활성 구독 184 · 트랜잭션 6건을 코드 상수로 그렸다.
// `subscriptions` · `payments` · `transactions` 세 테이블 모두 to_regclass NULL 이다
// (2026-09-05 실측). 결제 화면의 숫자는 곧 매출 보고가 되므로 상수를 남겨 두면 안 된다.
// 기존에도 경고 문단이 있었지만 화면마다 문구·모양이 달라, 공용 MockDataBanner 로 통일했다.
//
// 지운 것: KPI 4개 상수 · MRR 7일 막대(1.62~1.84 상수) · 요금제 분포(Pro 162 / Team 22) ·
//          트랜잭션 6건(2026-04-29~30 상수 날짜) · 검색/필터 칩 · 동작하지 않던 CSV 버튼.

import { ArrowDownRight, CreditCard, DollarSign, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'

export const metadata = {
  title: '결제/구독 — Vocaflow Admin',
  description: '결제 PG 미연동 고지',
}

const KPIS: AdminKpi[] = [
  {
    label: 'MRR',
    value: '—',
    icon: DollarSign,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 결제 테이블 없음',
  },
  {
    label: '활성 구독',
    value: '—',
    icon: Users,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 구독 테이블 없음',
  },
  {
    label: '신규 (이번 주)',
    value: '—',
    icon: TrendingUp,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 구독 테이블 없음',
  },
  {
    label: '이탈 (이번 주)',
    value: '—',
    icon: ArrowDownRight,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 구독 테이블 없음',
  },
]

export default function AdminBillingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={CreditCard}
        title="결제/구독"
        description="결제 PG 가 아직 연동되지 않았습니다"
      />

      <MockDataBanner
        className="mb-6"
        what="MRR·활성 구독·신규·이탈이 모두 값이 아니라 — 이고, 결제 내역도 비어 있습니다."
        why="subscriptions · payments · transactions 세 테이블이 모두 존재하지 않습니다(to_regclass NULL · 2026-09-05 실측). 결제 PG 연동 자체가 없어 받은 돈도, 환불한 돈도 없습니다."
        instead={[{ label: '파이프라인 실측 대시보드', href: '/admin' }]}
        plan="PG 연동 전까지 이 화면에는 어떤 금액도 표시되지 않습니다 — 일정 미정."
      />

      <AdminScreenHelp screen="billing" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <section
        aria-label="결제 내역"
        className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-6 py-10 text-center"
      >
        <span
          className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]"
          aria-hidden
        >
          <CreditCard size={18} />
        </span>
        <h2 className="mt-3 font-display text-[14px] font-[700] text-[var(--t1)]">
          결제 내역이 없습니다 — 결제를 받은 적이 없습니다
        </h2>
        <p className="mx-auto mt-1 max-w-[54ch] break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
          이 자리에 있던 6건(₩9,900 · ₩29,900)과 MRR 곡선은 코드에 박힌 예시였습니다. 환불이
          필요한 건이 실제로 생기면 이 화면이 아니라 결제사 콘솔에서 처리해야 합니다.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          대시보드에서 실측 보기
        </Link>
      </section>
    </div>
  )
}
