// apps/web/src/components/csat/diagnosis/map/MapScreen.tsx
//
// 학습 지도 화면 — 학습지도 v6.2(2026-10-14) 단일 지도. `/csat` 홈 · `?tab=map` · `?tab=map&view=full` 이 모두 UnifiedLearningMap 하나를 그린다.
// view=full 은 다른 교육 지도가 아니라 **같은 그래프의 전체 펼침**(모든 영역 열을 노드 폭으로)이다. 옛 학습자 지도(읽기 7단계) ·
// 옛 상세 지도(54라인 열)를 따로 그리던 분기는 없앴다 — 단계 근거 시트는 Inspector 의 「기출 근거 자세히」로 연다.

import { Maximize2, Minimize2 } from 'lucide-react'
import Link from 'next/link'

import type { MapPageData } from '@/lib/csat/map/load'
import type { MapReturnCtx } from '@/lib/csat/map-return'

import s from './map.module.css'
import { UnifiedLearningMap } from './UnifiedLearningMap'
import u from './unified.module.css'

export type MapView = 'core' | 'full'
export const parseMapView = (v?: string): MapView => (v === 'full' ? 'full' : 'core')

export function MapScreen({ data, view, base, asOf, restore = null, workspaceFirst = false }: { data: MapPageData; view: MapView; base: string; asOf?: string; restore?: MapReturnCtx | null; workspaceFirst?: boolean }) {
  // 정규 전체 주소는 진단 화면의 ?tab=map&view=full — 홈(/csat)에서 펼쳐도 그 주소로 간다
  const diag = base === '/csat' ? '/csat/diagnosis' : base
  const asofQ = asOf ? `&asof=${asOf.slice(0, 10)}` : ''
  return (
    <div className={s.root} data-testid="csat-map-screen" data-view={view}>
      <UnifiedLearningMap
        data={data}
        mode={view}
        recordHref={`${diag}?tab=records&modal=new`}
        asOf={asOf}
        restore={restore}
        workspaceFirst={workspaceFirst}
        viewToggle={
          view === 'full' ? (
            <Link href={`${diag}?tab=map${asofQ}`} className={u.ghost} data-testid="map-core-link">
              <Minimize2 size={14} strokeWidth={1.8} aria-hidden="true" />
              영역 하나씩 보기
            </Link>
          ) : (
            <Link href={`${diag}?tab=map&view=full${asofQ}`} className={u.ghost} data-testid="map-full-link">
              <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" />
              모든 영역 펼치기
            </Link>
          )
        }
      />
    </div>
  )
}
