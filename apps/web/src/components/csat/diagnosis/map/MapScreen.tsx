// apps/web/src/components/csat/diagnosis/map/MapScreen.tsx
//
// 학습 지도 화면 — 첫 화면은 학습자 학습 지도(?tab=map · 읽기 길 · 지금 먼저 확인할 것), 기출 상세 분석은 ?tab=map&view=full(기존 54라인 · 왜 이런 판단이 나왔는가).
// 목표 점수는 상단 줄이 아니라 최종 목표 자리(핵심 요약의 목표 카드 · 상세 지도의 최종 목표 노드)에서 정한다(2026-10-07).

import { ArrowLeft, Columns3, FileBarChart2 } from 'lucide-react'
import Link from 'next/link'

import { LEGACY_DETAIL_NOTE } from '@/lib/csat/map/core'
import type { MapPageData } from '@/lib/csat/map/load'

import c from './core.module.css'
import { InfoTip } from './PopupParts'
import { LearnerMap } from './LearnerMap'
import { LearningMap } from './LearningMap'
import s from './map.module.css'

export type MapView = 'core' | 'full'
export const parseMapView = (v?: string): MapView => (v === 'full' ? 'full' : 'core')

export function MapScreen({ data, view, base }: { data: MapPageData; view: MapView; base: string }) {
  const coreHref = `${base}?tab=map`
  return (
    <div className={s.root} data-testid="csat-map-screen" data-view={view}>
      {view === 'full' ? (
        <>
          <div className={c.viewBar}>
            <Link href={coreHref} className={c.backLink} data-testid="map-core-link">
              <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
              학습 지도로
            </Link>
            <span className={c.viewChips} data-testid="map-legacy-note">
              <InfoTip label="기출 상세 분석" icon={<FileBarChart2 size={13} strokeWidth={1.9} aria-hidden="true" />} align="end">
                {LEGACY_DETAIL_NOTE}
              </InfoTip>
              <InfoTip label="능력 열은 하나" icon={<Columns3 size={13} strokeWidth={1.9} aria-hidden="true" />} align="end">
                역량(A) 막대는 규칙 기반 관찰값이에요. 측정 정보 · 문항 특성 · 학습 · 행동 · 실전 · 상황 열은 능력이 아니라서 목표율을 두지 않아요.
              </InfoTip>
            </span>
          </div>
          <LearningMap data={data} />
        </>
      ) : (
        <LearnerMap data={data} detailHref={`${base}?tab=map&view=full`} recordHref={`${base}?tab=records&modal=new`} recordsHref={`${base}?tab=records`} />
      )}
    </div>
  )
}
