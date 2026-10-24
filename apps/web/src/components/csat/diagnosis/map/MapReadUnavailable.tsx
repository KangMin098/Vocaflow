// apps/web/src/components/csat/diagnosis/map/MapReadUnavailable.tsx
//
// T-0078 — 개인화 지도의 필수 원장(확인 첫 시도 · 수행 기록)을 읽지 못했을 때의 복구 상태. 0건 · 약점 · 미설치 · 승인 대기로 추정하지 않는다.
//   계획 확정 · 자료 받기 행동과 수행 0 은 내밀지 않는다. 다시 불러오기는 학습자가 누를 때 한 번만(같은 주소 = 고른 TASK · 묶음 문맥 그대로 재조회).
import { RotateCcw, TriangleAlert } from 'lucide-react'

import u from './unified.module.css'

export function MapReadUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <section className={u.wrap} role="status" aria-live="polite" data-testid="map-read-unavailable" data-retrying={retrying ? 'yes' : 'no'}>
      <p><TriangleAlert size={14} aria-hidden="true" /> 학습 기록을 지금 읽지 못했어요.</p>
      <p className={u.fine}>기록이 0건이라거나 부족하다는 뜻이 아니에요 — 읽기가 실패했을 뿐 그동안의 풀이 · 계획은 그대로 남아 있어요. 그래서 지금은 계획 확정 · 자료 받기를 열지 않아요.</p>
      <button type="button" className={u.cta} onClick={onRetry} disabled={retrying} data-testid="map-read-retry">
        <RotateCcw size={14} aria-hidden="true" /> {retrying ? '다시 불러오는 중…' : '다시 불러오기'}
      </button>
    </section>
  )
}
