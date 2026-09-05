// apps/web/src/app/admin/csat/layout.tsx
//
// **교재 공장 레일** — `/admin/csat/*` 전체가 공유하는 2차 메뉴.
//
// 왼쪽 사이드바에 공정 8칸을 다 세우면 다른 파이프라인 12개가 밀려난다. 그래서 공장 안에서만
// 보이는 레일을 여기 둔다 — 관리자는 어느 화면에 있든 **공정 순서와 자기 위치**를 본다.
//
// 레인을 둘로 가르는 이유: 연구소는 **무엇을 만들지 정하고**, 라인은 **정한 대로 찍는다.**
// 한 줄에 섞으면 "재고가 많다" 가 "잘 만들고 있다" 처럼 읽히는데, 규격이 낡으면 재고 전체가
// 낡은 것이라 정반대다.

import Link from 'next/link'

import { FACTORY_STAGES } from '@/lib/csat/factory-model'

import { FactoryRail } from './FactoryRail'

export default function AdminCsatLayout({ children }: { children: React.ReactNode }) {
  const lab = FACTORY_STAGES.filter((s) => s.lane === 'lab')
  const line = FACTORY_STAGES.filter((s) => s.lane === 'line')

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href="/admin/csat"
          className="font-display text-[22px] font-[800] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
        >
          교재 공장
        </Link>
        <p className="font-body text-[13px] text-[var(--t2)]">
          기획 → 설계 → 소재 → 집필 → 해설 → 검수 → 조판. 시중 공정을 그대로 밟되, 각 칸을 채우는
          것은 Claude Code 배치다.
        </p>
      </header>

      <FactoryRail lab={[...lab]} line={[...line]} />

      {children}
    </div>
  )
}
