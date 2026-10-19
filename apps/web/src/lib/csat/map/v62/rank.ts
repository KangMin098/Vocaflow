// apps/web/src/lib/csat/map/v62/rank.ts
//
// v6.2 §6.2 · D-08 — NeedRank(교육적으로 중요 · 확인이 필요한 순서)와 ActionRank(지금 실제로 할 수 있는 순서)를 나눈다.
//   NeedRank = composeV4 의 To-Be 요구 순서 그대로 + 관련성 미확인 TASK 를 「판단 보류」로 덧붙인다. **콘텐츠가 없다고 빼지 않는다.**
//   ActionRank = NeedRank 중 지금 열 수 있는 활동 링크가 있는 것만(계획 TaskPlan.next). 못 하는 이유는 따로 남긴다.
// 새 판정을 하지 않는다 — V4View 의 결과만 읽는다(판정은 v4/* 한 곳).
// 정렬 금지(§6.2): 점수 상승 추정 · TASK 가중합 0~100 · 미검증 관계의 선수 강제 · 자료 수량.

import type { V4View } from '../v4/compose'
import { taskOf, type TaskId } from '../v4/definition'
import type { Need } from '../v4/to-be'

export interface NeedRankEntry {
  rank: number
  task: TaskId
  /** 학습 요구 — 관련성 미확인은 'RELEVANCE_UNKNOWN'(요구 확정 아님 · 판단 보류) */
  need: Need['type'] | 'RELEVANCE_UNKNOWN'
  evidence: V4View['asIs']['tasks'][string]['status']
  /** 근거 부족을 약점 확정으로 보이지 않기 위한 표지 */
  confirmed: boolean
}

export interface ActionRankEntry {
  rank: number
  task: TaskId
  href: string
  label: string
  needRank: number
}

export type NotActionableReason = 'content_gap' | 'stage_locked' | 'repair_material_needed' | 'canon_hold' | 'relevance_unknown' | 'no_next_activity'

export interface Ranks {
  needRank: NeedRankEntry[]
  actionRank: ActionRankEntry[]
  /** NeedRank 에 있지만 지금 할 수 없는 것 — 이유와 함께(학생 결손이 아니라 플랫폼 · 단계 상태) */
  notActionable: { task: TaskId; reason: NotActionableReason }[]
}

export function ranksOf(view: V4View): Ranks {
  const toBe = view.toBe
  const needRank: NeedRankEntry[] = []
  if (toBe) {
    for (const n of toBe.needs) needRank.push({ rank: needRank.length + 1, task: n.task, need: n.type, evidence: n.evidence, confirmed: n.evidence === 'verified_need' || n.evidence === 'resolved' })
    for (const id of toBe.relevanceUnknown) needRank.push({ rank: needRank.length + 1, task: id, need: 'RELEVANCE_UNKNOWN', evidence: view.asIs.tasks[id].status, confirmed: false })
  }
  const plans = new Map(view.taskPlans.map((p) => [p.task, p]))
  const actionRank: ActionRankEntry[] = []
  const notActionable: Ranks['notActionable'] = []
  for (const e of needRank) {
    const p = plans.get(e.task)
    if (e.need === 'RELEVANCE_UNKNOWN') {
      notActionable.push({ task: e.task, reason: 'relevance_unknown' })
      continue
    }
    if (p?.next) {
      actionRank.push({ rank: actionRank.length + 1, task: e.task, href: p.next.href, label: p.next.label, needRank: e.rank })
      continue
    }
    const u = p?.unresolved ?? []
    const reason: NotActionableReason = taskOf(e.task).status === 'hold' || u.includes('canon_hold') ? 'canon_hold' : u.includes('no_content') ? 'content_gap' : u.includes('repair_material_needed') ? 'repair_material_needed' : u.includes('stage_locked') ? 'stage_locked' : 'no_next_activity'
    notActionable.push({ task: e.task, reason })
  }
  return { needRank, actionRank, notActionable }
}
