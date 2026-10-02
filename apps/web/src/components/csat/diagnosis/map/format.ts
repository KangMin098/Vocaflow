// apps/web/src/components/csat/diagnosis/map/format.ts
//
// 학습 지도 표시용 순수 헬퍼 — 반올림은 표시에서만 한다(계산 · 저장은 원래 값).

import type { MapEdgeRow, MapNodeRow, NodeStatus } from '@/lib/csat/map/model'
import type { MapSourceRow } from '@/lib/csat/map/load'

/** 0~1 → 「73%」. 만점에 못 미치는데 반올림하면 100% 가 되는 값은 소수 한 자리(99.9%)로 — 달성처럼 보이지 않게 */
export function pct(v: number | null): string {
  if (v === null) return '—'
  if (v < 1 && Math.round(v * 100) === 100) return `${(Math.floor(v * 1000) / 10).toFixed(1)}%`
  return `${Math.round(v * 100)}%`
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  met: '달성',
  near: '근접',
  short: '미달',
  hold: '판정 보류',
  needs_diagnosis: '진단 필요',
  no_items: '연결 문항 없음',
  tasks_only: '과제로 봐요',
}

export type Tone = 'met' | 'near' | 'short' | 'muted'

/** 색은 상태의 보조 — 같은 정보를 글자(STATUS_LABEL)로도 항상 보인다 */
export function toneOf(status: NodeStatus): Tone {
  return status === 'met' ? 'met' : status === 'near' ? 'near' : status === 'short' ? 'short' : 'muted'
}

export const KIND_LABEL: Record<MapNodeRow['kind'], string> = {
  goal: '최종 목표',
  axis: '영역',
  line: '학습 라인',
  principle: '근거 원리',
  track: '접근 트랙',
}

export const BASIS_LABEL: Record<MapEdgeRow['basis'], string> = { direct: '직접 근거', inferred: '추론', pending: '보류' }

export const EDGE_KIND_LABEL: Record<MapEdgeRow['kind'], string> = {
  goal: '목표 → 영역',
  member: '영역 → 라인',
  reason: '라인 → 원리',
  route: '원리 → 트랙',
}

export type EvidenceBadge = 'sourced' | 'review' | 'pending'

/**
 * 노드의 근거 상태 배지(원리 노드에 보인다): 출처 없음 = 보류 · 출처가 전부 「검토 필요」 = 검토 필요 · 그 밖 = 근거 있음.
 * 성취 상태와 다른 축이라 따로 보인다.
 */
export function evidenceBadge(nodeSourceIds: string[] | undefined, sources: MapSourceRow[]): EvidenceBadge {
  if (!nodeSourceIds || nodeSourceIds.length === 0) return 'pending'
  const byId = new Map(sources.map((s) => [s.id, s]))
  const rows = nodeSourceIds.map((id) => byId.get(id)).filter((s): s is MapSourceRow => Boolean(s))
  if (rows.length === 0) return 'pending'
  return rows.every((s) => s.status === 'needs_review') ? 'review' : 'sourced'
}

export const BADGE_LABEL: Record<EvidenceBadge, string> = { sourced: '근거 있음', review: '검토 필요', pending: '근거 보류' }

/** 시험 라벨을 줄여서 — 「2027학년도 6월 모의평가」 → 「27학년도 6월 모평」 */
export function shortExam(label: string): string {
  return label.replace(/^20(\d\d)학년도/, '$1학년도').replace('모의평가', '모평').replace('대학수학능력시험', '수능')
}
