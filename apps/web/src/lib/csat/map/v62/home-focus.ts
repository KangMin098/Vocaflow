// apps/web/src/lib/csat/map/v62/home-focus.ts
//
// v6.2 §9.1 — `/csat` 홈 첫 제안은 지도와 같은 판정 출처(composeV4 → ActionRank)에서 고른다. 옛 읽기 7단계(learnerPath.focus)로
// 두 번째 판정을 하지 않는다. 홈은 「무엇을 제안할지 종류」만 받고, 실제 행동 링크는 지도 Inspector(첫 ActionRank)가 보인다.

import type { HomeFocusKind, MapLoadState } from '../../home-suggestion'
import type { MapPageData } from '../load'
import { composeV4 } from '../v4/compose'

import { evidenceReadOf } from './evidence-read'
import { ranksOf } from './rank'

export interface HomeFocus {
  kind: HomeFocusKind
  /** 지도가 처음 고르는 TASK(ActionRank 1위) — 없으면 null */
  task: string | null
}

/**
 * T-0079 — 홈의 지도 읽기 상태. 없음 = 준비 중 · 보류 판정 실패 = 오류 · 현대 DTO(v4 · now)인데 필수 원장(T-0078 evidenceReadOf)을 못 읽음 = 오류
 *   (기록 없음 · 기록만으로 안내하지 않는다) · 보류 = withheld · 그 밖 ok(읽힌 빈 [] 는 정상 첫 진입)
 */
export function homeMapStateOf(data: MapPageData | null): MapLoadState {
  if (!data) return 'preparing'
  if (data.heldGate === 'failed') return 'error'
  if (data.v4 && data.now && evidenceReadOf(data) !== 'ok') return 'error'
  return data.heldGate === 'held' ? 'withheld' : 'ok'
}

export function homeFocusOf(data: MapPageData): HomeFocus {
  // 목표를 정하기 전에는 목표 정하기가 첫 제안(지도 탐색 · 자율 연습은 그대로 열려 있다)
  if (!data.model.goalSet) return { kind: 'goal', task: null }
  const v = composeV4(data, { score: data.model.goal, set: true })
  if (!v) return { kind: 'none', task: null }
  // T-0079 — 시험 기록 0 이어도 As-Is 가 이미 직접 확인(basis direct_check)을 갖고 있으면 「기록 없음」으로 되돌리지 않고 지도의 다음 행동을 쓴다.
  //   직접 근거를 새로 계산 · 승격하지 않는다(축 관찰 · 안내 연습 · 자기평가는 direct_check 가 아니다 — As-Is 판정 그대로)
  const direct = Object.values(v.asIs.tasks).some((t) => t?.basis === 'direct_check')
  if (v.asIs.sessions.length === 0 && !direct) return { kind: 'record', task: null }
  const first = ranksOf(v).actionRank[0] ?? null
  // 직접 근거는 있는데 지금 행동이 없다 = 자료 · 단계 대기(「처음 시작 전」이 아니다) → pending
  return first ? { kind: 'step', task: first.task } : { kind: direct ? 'pending' : 'none', task: null }
}
