// apps/web/src/lib/csat/map/v62/next-action.ts
//
// T-0061 — 전체 지도 첫 화면의 「지금 할 일 · 왜 · 이번 학습량과 확인 조건 · 다음 한 행동」.
// 새 판정을 하지 않는다: ranksOf(순서) · TaskPlan(단계 · 수량 · 성취 조건) · To-Be 요구(이유 · 관련도) · 저장 계획 유무만 읽는다.
// 행동 종류
//   start   — 지금 열 수 있는 활동 링크가 있고 그 묶음 계획이 저장됨 → 그 활동으로
//   plan    — 활동은 있지만 그 묶음 계획이 아직 저장 전 → 같은 묶음의 계획 탭으로(확정 뒤 공급 · 기록이 계획에 묶인다)
//   supply  — 창작 자료가 있는 TASK 인데 지금 받은 자료가 없음 → 같은 묶음 개요의 「자료 받기」(실제 재고 · 승인 · 설치 여부는 서버가 거기서 판정)
//   wait    — 자료 · 단계 · 보류 때문에 지금 할 수 없음 → 이유만, 재요청을 유도하지 않는다
// 수량은 TaskPlan 값 그대로 — planned 가 없으면 만들지 않는다. source 는 저장 계획인지(saved) 제안 계획인지(proposed).

import { AUTHORED_TASKS } from '@/lib/knowledge/authored/tasks'

import type { V4View } from '../v4/compose'
import { applySaved } from '../v4/plan-commit'
import type { SavedPlans, SavedWorkspace } from '../v4/plan-store'
import type { TaskId } from '../v4/definition'
import type { TaskPlan } from '../v4/plan'
import type { Need } from '../v4/to-be'
import type { NotActionableReason, Ranks } from './rank'

export type NextActionKind = 'start' | 'plan' | 'supply' | 'wait'

export interface NextAction {
  kind: NextActionKind
  task: TaskId
  name: string
  /** 이 TASK 를 여는 Workspace(중심 우선) — 없으면 null */
  ws: string | null
  /** 추천 이유 재료 — 문장은 화면이 만든다 */
  why: { need: Need['type'] | null; evidence: TaskPlan['evidence'] | null; items: number | null; pointsPerExam: number | null }
  quantity: { unit: TaskPlan['quantity']['unit']; planned: number | null; done: number; source: 'saved' | 'proposed' } | null
  criterion: string | null
  /** start 일 때만 — 계획 그대로의 활동 링크 */
  href: string | null
  label: string | null
  /** wait 일 때만 — ranksOf 의 이유 그대로 */
  blocked: NotActionableReason | null
}

type Saved = Pick<SavedPlans, 'byTemplate'> & { status?: SavedPlans['status']; error?: unknown } | null | undefined

/**
 * 이번 학습량 — 계획 편집기(PlanSection)와 같은 출처: 그 묶음의 최신 저장 버전을 applySaved 로 덮은 값.
 * 「저장한 계획」은 저장 행이 이 TASK 를 **지금과 같은 단계**로 담았을 때만(옛 단계 저장 · 저장 없음 = 제안). 적용 단계 수량은 저장 이력에서 이미 재생된 값.
 */
function quantityOf(task: TaskId, ws: string | null, view: V4View, saved: Saved, fallback: TaskPlan | null): NextAction['quantity'] {
  const sw = ws && saved?.status !== 'not_installed' && !saved?.error ? (saved?.byTemplate?.[ws] as SavedWorkspace | undefined) ?? null : null
  const pv = ws ? view.plans[ws] ?? null : null
  const row = pv ? applySaved(pv, sw?.latest ?? null).tasks.find((t) => t.task === task) ?? null : null
  const p = row ?? fallback
  if (!p) return null
  const savedRow = sw?.latest?.plan.tasks.find((t) => t.task === task) ?? null
  const isSaved = !!savedRow && savedRow.stage === p.stage
  return { unit: p.quantity.unit, planned: p.quantity.planned, done: p.quantity.done, source: isSaved ? 'saved' : 'proposed' }
}

/** 이 TASK 를 여는 Workspace — 중심으로 둔 계획 먼저, 다음 보조(TaskInspector.homeWsOf 와 같은 순서) */
export function wsForTask(task: string, view: Pick<V4View, 'plans'>): string | null {
  const ids = Object.keys(view.plans)
  return ids.find((id) => view.plans[id].core.includes(task as TaskId)) ?? ids.find((id) => view.plans[id].tasks.some((x) => x.task === task)) ?? null
}

export function nextActionOf(view: V4View, ranks: Ranks | null, saved: Saved): NextAction | null {
  if (!ranks) return null
  const first = ranks.actionRank[0]
  const target = first?.task ?? ranks.notActionable.find((n) => n.reason !== 'relevance_unknown')?.task ?? null
  if (!target) return null
  const plan = view.taskPlans.find((p) => p.task === target) ?? null
  const need = view.toBe?.needs.find((n) => n.task === target) ?? null
  const ws = wsForTask(target, view)
  const isSaved = !!(ws && saved?.byTemplate?.[ws])
  const base = {
    task: target,
    name: plan?.name ?? target,
    ws,
    why: { need: need?.type ?? null, evidence: plan?.evidence ?? need?.evidence ?? null, items: need?.relevance.items ?? null, pointsPerExam: need?.relevance.pointsPerExam ?? null },
    quantity: quantityOf(target, ws, view, saved, plan),
    criterion: plan?.criterion ?? null,
  }
  if (first) {
    if (ws && !isSaved) return { ...base, kind: 'plan', href: null, label: null, blocked: null }
    return { ...base, kind: 'start', href: first.href, label: first.label, blocked: null }
  }
  const blocked = ranks.notActionable.find((n) => n.task === target)?.reason ?? 'no_next_activity'
  // 그 묶음 계획이 아직 저장 전이면 실제로 할 수 있는 첫 행동은 계획 확정이다(단계 대기를 「기다림」으로 보이면 학습자가 멈춘다 — CI 39387227895 캡처)
  if (ws && !isSaved && blocked !== 'canon_hold') return { ...base, kind: 'plan', href: null, label: null, blocked }
  // 확인 단계가 「확인 문항 연결 없음」으로 막힌 창작 TASK 는 첫 확인 자료 공급이 그 다음 행동이다(단계 잠금 그대로가 아님)
  const firstCheckLocked = blocked === 'stage_locked' && (!plan?.stage || plan.stage === 'check')
  const supplyable = ws && AUTHORED_TASKS.includes(target) && (firstCheckLocked || blocked === 'content_gap' || blocked === 'material_needed' || blocked === 'repair_material_needed' || blocked === 'no_next_activity')
  if (supplyable) return { ...base, kind: isSaved ? 'supply' : 'plan', href: null, label: null, blocked }
  return { ...base, kind: 'wait', href: null, label: null, blocked }
}

export const WAIT_LABEL: Record<NotActionableReason, string> = {
  content_gap: '이 TASK 를 확인할 자료가 아직 없어요 — 준비되면 여기서 열려요',
  material_needed: '다음 단계에 쓸 자료가 아직 없어요',
  repair_material_needed: '바로잡기 자료가 아직 없어요',
  stage_locked: '앞 단계를 마치면 열려요',
  canon_hold: '이 TASK 는 정의를 정비하는 중이라 지금은 학습하지 않아요',
  relevance_unknown: '목표 시험과의 연결을 아직 확인하지 못했어요',
  no_next_activity: '지금 열 수 있는 활동을 찾지 못했어요 — 정확한 원인은 아직 몰라요',
}
