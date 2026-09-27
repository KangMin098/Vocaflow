// apps/web/src/app/admin/csat/page.tsx
//
// 교재 공장 — **공장 지도.**
//
// 영어 글감이 문제집 한 권이 되기까지를 여덟 걸음으로 편다. 코드를 모르는 사람이 이 화면만 보고
// 「지금 어디가 막혔고 · 무엇을 먼저 하고 · 그 화면이 어디인가」를 알 수 있어야 한다.
//
// 숫자와 상태는 운영자용 현황판(`details/`)과 **같은 조회**(`loadFactoryLine`)에서 온다 — 두 화면이
// 같은 걸음을 다른 수로 말하지 않게. 눈금 · 실행 줄 · 자유도는 그 화면에 그대로 있다.

import { BookOpenText, Gauge } from 'lucide-react'
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { FactoryMap } from '@/components/admin/factory/FactoryMap'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadFactoryLine } from '@/lib/csat/factory'
import { loadPickSnapshot } from '@/lib/csat/factory-pick'

export const dynamic = 'force-dynamic'

const linkCls =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--admin)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

export default async function AdminCsatPage() {
  await requireAdmin('/admin/csat')
  const line = await loadFactoryLine()
  const pick = loadPickSnapshot()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[720px] flex-col gap-1">
          <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">공장 지도</h2>
          <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">
            영어 글감이 문제집 한 권이 되기까지의 여덟 걸음을 한눈에 봐요. 맨 위 카드가 지금 가장 먼저 할 일이고, 칸을 누르면 그 걸음 화면으로 가요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/csat/help" className={linkCls}>
            <BookOpenText size={15} strokeWidth={1.9} aria-hidden />
            용어집
          </Link>
          <AdminScreenHelp screen="csat-map" />
        </div>
      </div>

      <FactoryMap stages={line.stages} pick={pick} loadError={line.loadError} />

      <Link href="/admin/csat/details" className={`${linkCls} w-fit`}>
        <Gauge size={15} strokeWidth={1.9} aria-hidden />
        숫자로 자세히 보기 — 운영자용 현황판
      </Link>
    </div>
  )
}
