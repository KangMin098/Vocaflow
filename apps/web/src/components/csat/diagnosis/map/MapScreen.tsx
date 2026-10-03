// apps/web/src/components/csat/diagnosis/map/MapScreen.tsx
//
// 학습 지도 화면 — 첫 화면은 핵심 지도 요약(?tab=map), 기존 영역 · 라인 지도는 상세 보기(?tab=map&view=full).
// 목표 점수 줄은 두 보기가 함께 쓴다.

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import type { MapPageData } from '@/lib/csat/map/load'

import c from './core.module.css'
import { CoreSummary } from './CoreSummary'
import { GoalBar } from './GoalBar'
import { LearningMap } from './LearningMap'
import s from './map.module.css'

export type MapView = 'core' | 'full'
export const parseMapView = (v?: string): MapView => (v === 'full' ? 'full' : 'core')

export function MapScreen({ data, view, base }: { data: MapPageData; view: MapView; base: string }) {
  const coreHref = `${base}?tab=map`
  return (
    <div className={s.root} data-testid="csat-map-screen" data-view={view}>
      <GoalBar data={data} />
      {view === 'full' ? (
        <>
          <div className={c.viewBar}>
            <Link href={coreHref} className={c.backLink} data-testid="map-core-link">
              <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
              핵심 지도로
            </Link>
            <span>전체 지도 — 역량(A) 막대만 규칙 기반 관찰값이에요. 문항유형 · 오답 원인 · 행동 · 방법은 목표율을 두지 않아요.</span>
          </div>
          <LearningMap data={data} />
        </>
      ) : (
        <CoreSummary data={data} fullHref={`${base}?tab=map&view=full`} />
      )}
    </div>
  )
}
