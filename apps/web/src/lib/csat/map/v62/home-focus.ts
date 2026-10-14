// apps/web/src/lib/csat/map/v62/home-focus.ts
//
// v6.2 §9.1 — `/csat` 홈 첫 제안은 지도와 같은 판정 출처(composeV4 → ActionRank)에서 고른다. 옛 읽기 7단계(learnerPath.focus)로
// 두 번째 판정을 하지 않는다. 홈은 「무엇을 제안할지 종류」만 받고, 실제 행동 링크는 지도 Inspector(첫 ActionRank)가 보인다.

import type { HomeFocusKind } from '../../home-suggestion'
import type { MapPageData } from '../load'
import { composeV4 } from '../v4/compose'

import { ranksOf } from './rank'

export interface HomeFocus {
  kind: HomeFocusKind
  /** 지도가 처음 고르는 TASK(ActionRank 1위) — 없으면 null */
  task: string | null
}

export function homeFocusOf(data: MapPageData): HomeFocus {
  // 목표를 정하기 전에는 목표 정하기가 첫 제안(지도 탐색 · 자율 연습은 그대로 열려 있다)
  if (!data.model.goalSet) return { kind: 'goal', task: null }
  const v = composeV4(data, { score: data.model.goal, set: true })
  if (!v) return { kind: 'none', task: null }
  if (v.asIs.sessions.length === 0) return { kind: 'record', task: null }
  const first = ranksOf(v).actionRank[0] ?? null
  return first ? { kind: 'step', task: first.task } : { kind: 'none', task: null }
}
