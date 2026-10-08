// apps/web/src/components/csat/diagnosis/map/MapPreparing.tsx
//
// 학습 지도 데이터가 아직 없을 때(테이블 미설치 · 시드 전) — 오류가 아니라 준비 중임을 알린다.

import s from './map.module.css'

export function MapPreparing() {
  return (
    <div className={s.root} data-testid="csat-learning-map-preparing" style={{ padding: 28 }}>
      <div className={s.title}>학습 지도를 준비하고 있어요</div>
      <p className={s.p}>어휘 · 표현 · 문장 이해 · 글 이해 · 근거 · 선지 판단 · 듣기와 실전 수행을 기출 관찰로 보여 주는 지도예요. 데이터를 채우는 중이라 곧 열려요.</p>
    </div>
  )
}
