// apps/web/src/lib/csat/map/v62/workspace-list.ts
//
// 학습지도 × Workspace 통합 화면(LM-W1) — 지도 아래 Workspace 리스트의 행 모델 · TASK ↔ Workspace 연결.
// **판정하지 않는다.** composeV4 의 plan(primary · others · preparing) · plans(workspacePlan) 결과를 그대로 엮기만 한다:
//   순서 = planWorkspaces 순서(대표 → 나머지 → 자료 준비 중) · 지금 단계 · 다음 행동 = 중심 TASK 의 taskPlan(stage · next)
//   (없으면 Workspace 의 next) · 수행량 = workspacePlan.progress(숙달률 아님) · 연결 = Workspace.core / support(정본 TASK id).
// 상태는 이 값들의 유무로만 나눈다 — 자료 준비 중 Workspace 는 다음 행동이 있어도 「학습 가능」으로 올리지 않는다.

import type { V4View } from '../v4/compose'
import type { TaskId } from '../v4/definition'
import type { StageKey, WorkspaceView } from '../v4/workspace'
import { maintainPassed } from './maintenance-state'

export type WsLink = 'core' | 'support'
/** maintain(T-0082) — 중심 TASK 가 지금 확인 통과 + 유지: 다른 날 유지 확인 기준 미정이라 지금 열 활동이 없다(앞 단계 잠김 아님) */
export type WsRowState = 'runnable' | 'in_progress' | 'locked' | 'preparing' | 'maintain'
export type WsRowKind = 'primary' | 'other' | 'preparing'

export interface WsRow {
  id: string
  name: string
  goal: string | null
  kind: WsRowKind
  core: TaskId[]
  support: TaskId[]
  /** 중심 TASK 의 지금 단계(taskPlan.stage) — 없으면 null */
  stage: StageKey | null
  /** 단계별 준비(Workspace.stages 그대로) — 자료 준비 중 행은 null */
  stages: WorkspaceView['stages'] | null
  /** 이번 계획 수행량(workspacePlan.progress) — 숙달률이 아니다 */
  progress: { planned: number; done: number } | null
  state: WsRowState
  /** 한 개의 다음 행동 — 중심 TASK 의 계획 링크, 없으면 Workspace 의 다음 확인. 자료 준비 중이면 null */
  next: { href: string; label: string; task: TaskId } | null
  /** 자료 준비 중 사유(DirectCheck 그대로) */
  readiness: string | null
}

export function workspaceRows(view: V4View): WsRow[] {
  const out: WsRow[] = []
  const seen = new Set<string>()
  const live: [WorkspaceView, WsRowKind][] = [
    ...(view.plan.primary ? [[view.plan.primary, 'primary'] as [WorkspaceView, WsRowKind]] : []),
    ...view.plan.others.map((w) => [w, 'other'] as [WorkspaceView, WsRowKind]),
  ]
  for (const [w, kind] of live) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    const plan = view.plans[w.id] ?? null
    const coreTask = w.core[0] ?? null
    const tp = coreTask ? plan?.tasks.find((t) => t.task === coreTask) ?? null : null
    const preparing = view.plan.preparing.some((p) => p.id === w.id)
    // LM-G1.1 단일 출처 — 계획이 바로잡기 · 적용 단계인데 링크가 없으면(실제 막힘) Workspace 의 확인 문항으로 바꿔 열지 않는다.
    //   Workspace.next 로 대신하는 것은 계획 단계가 없거나 확인 · 다시 확인 단계(같은 확인 문항 출처)일 때만
    const blockedStage = tp?.stage === 'repair' || tp?.stage === 'transfer'
    // T-0082(P1-1) — 지금 확인 통과 + 유지는 남은 확인 링크가 있어도 다음 행동으로 내밀지 않는다(rank · 상단과 같은 maintainPassed)
    const maintain = maintainPassed(tp)
    const link = maintain ? null : tp?.next ?? (!blockedStage && w.next ? { href: w.next.href, label: w.next.label } : null)
    const next = !preparing && link && coreTask ? { ...link, task: coreTask } : null
    const progress = plan?.progress ?? null
    out.push({
      id: w.id,
      name: w.name,
      goal: w.goal,
      kind: preparing ? 'preparing' : kind,
      core: [...w.core],
      support: [...w.support],
      stage: tp?.stage ?? null,
      stages: preparing ? null : w.stages,
      progress,
      state: preparing ? 'preparing' : next ? (progress && progress.done > 0 ? 'in_progress' : 'runnable') : maintain ? 'maintain' : 'locked',
      next,
      readiness: preparing ? w.readiness : null,
    })
  }
  for (const p of view.plan.preparing) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push({ id: p.id, name: p.name, goal: null, kind: 'preparing', core: [], support: [], stage: null, stages: null, progress: null, state: 'preparing', next: null, readiness: p.readiness })
  }
  // 자료 준비 중은 항상 뒤(대표 · 실행 가능 순서는 planWorkspaces 그대로)
  return [...out.filter((r) => r.kind !== 'preparing'), ...out.filter((r) => r.kind === 'preparing')]
}

/** 이 Workspace 에서 TASK 의 역할 — 중심 · 지원 · 무관(null) */
export function wsLinkOf(row: Pick<WsRow, 'core' | 'support'>, task: string): WsLink | null {
  return row.core.includes(task as TaskId) ? 'core' : row.support.includes(task as TaskId) ? 'support' : null
}

/** TASK 를 담은 Workspace — 중심 먼저, 그다음 지원(리스트 순서 유지) */
export function wsOfTask(rows: readonly WsRow[], task: string): { id: string; link: WsLink }[] {
  const all = rows.map((r) => ({ id: r.id, link: wsLinkOf(r, task) })).filter((x): x is { id: string; link: WsLink } => x.link !== null)
  return [...all.filter((x) => x.link === 'core'), ...all.filter((x) => x.link === 'support')]
}

/**
 * TASK 를 고를 때 같이 고를 Workspace — 지금 고른 Workspace 가 이 TASK 를 담으면 그대로(다른 묶음으로 튀지 않게),
 * 아니면 이 TASK 를 중심으로 하는 첫 Workspace, 아니면 지원으로 담은 첫 Workspace, 없으면 null.
 */
export function wsForTask(rows: readonly WsRow[], task: string, current: string | null): string | null {
  const cur = current ? rows.find((r) => r.id === current) : null
  if (cur && wsLinkOf(cur, task)) return cur.id
  return wsOfTask(rows, task)[0]?.id ?? null
}

/** Workspace 를 고를 때 같이 고를 TASK — 지금 TASK 가 이 Workspace 에 있으면 그대로, 아니면 첫 중심 TASK */
export function taskForWs(row: Pick<WsRow, 'core' | 'support'>, current: string | null): TaskId | null {
  if (current && wsLinkOf(row, current)) return current as TaskId
  return row.core[0] ?? row.support[0] ?? null
}
