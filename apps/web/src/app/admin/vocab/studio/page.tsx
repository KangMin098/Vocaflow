// apps/web/src/app/admin/vocab/studio/page.tsx
// 단어장 Studio — blueprint 하나를 골라 미리보기·채점하고 발행한다.
//
// 기존 위저드(/admin/vocab/runs/new)와의 차이: 위저드는 평면 필터 → 정렬 → 개수 뿐이라
// 목차가 필터로 표현되지 않는 유형(어원 챕터·의미장·짝 대조·N일 완성)을 만들 수 없었다.
// Studio 는 레시피 4단(모집단 → 선별 → 조직 → 표현)을 blueprint 로 들고 있다.

import { LayoutTemplate } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { StudioClient } from '@/components/admin/vcb/studio/StudioClient'
import { fetchStudioCatalog, fetchStudioOptions } from '@/lib/vcb/server/compose-studio'

export const dynamic = 'force-dynamic'

export default async function VcbStudioPage() {
  const [catalog, options] = await Promise.all([fetchStudioCatalog(), fetchStudioOptions()])

  return (
    <div>
      <AdminPageHeader
        icon={LayoutTemplate}
        title="단어장 Studio"
        description={`유형 ${catalog.summary.total}종 — 지금 만들 수 있는 것 ${catalog.summary.buildable}종`}
      />

      <AdminScreenHelp screen="vocab-studio" className="mb-6" />

      <StudioClient catalog={catalog} options={options} />
    </div>
  )
}
