// apps/web/src/lib/csat/map/v4/plan.ts
//
// TASK 별 학습계획(PLAN) 계약 — rev4.0 3차. As-Is(근거) · To-Be(요구) · Workspace(실행 가능 단계)를 TASK 한 줄로 모은다.
// 원칙(지시서 §3 · WORKSPACE_CONTRACT §3):
//   · 정량(계획 · 수행 · 남음)과 정성(성취 조건 · 확인된 상태)은 다른 칸이다. 「계획 5 중 3 수행」은 진행 3/5 이지 숙달 60% 가 아니다.
//   · 계획량은 **실제로 쓸 수 있는 문항 수**에서만 나온다(출처 · 산출 규칙 · 조정 가능 여부를 함께 싣는다). 교육적 근거가 있는
//     권장량이 없으므로 「권장 N개」를 만들지 않는다 — 콘텐츠가 없으면 계획량은 null(계획 불가)이고 이유를 단다.
//   · 학습자 조정(순서 · 계획량)은 계획만 바꾼다. 근거 상태 · 직접 확인 판정 · 요구 유형은 바뀌지 않는다(adjust 는 그 칸을 읽지도 쓰지도 않는다).
// 순수 함수(DB · 시계 없음).

import type { AsIsMap, AsIsTask, TaskEvidence } from './as-is'
import { checkKeysOfTask, taskOf, tasks, type TaskId } from './definition'
import type { Need, ToBeMap } from './to-be'
import type { StageKey, WorkspacePlan, WorkspaceView } from './workspace'

/** 요구 유형 → 그 요구를 채우는 Workspace 단계 */
const STAGE_OF_NEED: Record<Need['type'], StageKey | null> = { CONFIRM: 'check', REPAIR: 'repair', TRANSFER: 'transfer', MAINTAIN: 'recheck', INTEGRATE: null }

/** 확인된 성취 상태 — 직접 확인 판정에서만 나온다(계획 진행과 무관) */
export type Achievement =
  | 'unmeasurable'   // 측정 방법 보류
  | 'not_checked'    // 직접 확인 전(축 기록 관찰만 있을 수 있음)
  | 'checking'       // 확인 진행 중
  | 'need_confirmed' // 직접 확인 — 연습 필요
  | 'resolved'       // 다시 확인 통과
  | 'expired'        // 기한 지남 — 다시 확인

const ACHIEVEMENT_OF: Record<TaskEvidence, Achievement> = {
  unmeasurable: 'unmeasurable', unmeasured: 'not_checked', analysis_pending: 'not_checked', insufficient: 'not_checked', observed: 'not_checked',
  check_first: 'not_checked', checking: 'checking', verified_need: 'need_confirmed', resolved: 'resolved', expired: 'expired',
}

export type QuantityRule =
  | 'unseen_check_items'     // 확인: 아직 안 본 확인 문항 수
  | 'blocked_items'          // 바로잡기: 확인에서 막힌 문항 수
  | 'transfer_pool'          // 적용: 확인 묶음 밖 실제 적용 문항 수
  | 'recheck_items'          // 다시 확인: 독립 재확인 기준 문항 수(2)

export interface PlanQuantity {
  /** 이 단계 계획에 쓰는 단위 */
  unit: '문항'
  /** 학습자가 쓸 수 있는 실제 문항 수(상한) — 없으면 null(계획 불가) */
  available: number | null
  /** 계획량 — 기본 = 가용량. 학습자 조정 뒤 값. 계획 불가면 null */
  planned: number | null
  /** 수행한 수(서로 다른 문항) — 이 단계 기록만 */
  done: number
  /** 남은 수 — planned 가 없으면 null */
  remaining: number | null
  rule: QuantityRule | null
  /** 학습량의 출처 */
  source: 'available_content' | 'none'
  /** 학습자가 계획량을 줄일 수 있나(늘리기는 가용량까지) */
  adjustable: boolean
}

export interface TaskPlan {
  task: TaskId
  name: string
  /** TASK 수행 목표(코드북) */
  goal: string
  /** 정성 성취 조건(코드북 learner_criterion — 학습자 말) — 계획 진행과 별개 */
  criterion: string
  /** 현재 관찰 근거(As-Is 그대로) */
  evidence: TaskEvidence
  basis: AsIsTask['basis']
  /** 목표 관련도(To-Be) — 목표 없으면 null */
  relevance: Need['relevance'] | null
  need: Need['type'] | null
  priority: number | null
  /** 이 계획이 쓰는 Workspace 단계 */
  stage: StageKey | null
  workspaces: string[]
  /** 지금 실행 가능한 자료(확인 문항 링크 등) — 없으면 null */
  next: { href: string; label: string } | null
  quantity: PlanQuantity
  achievement: Achievement
  /** 아직 풀리지 않은 것(문구 키) */
  unresolved: ('no_content' | 'stage_locked' | 'canon_hold' | 'needs_direct_check' | 'not_goal_related')[]
}

export interface PlanActivity {
  itemRef: string | null
  taskKey: string
  phase: string
  answeredAt: string | null
}

export interface WorkspacePlanView {
  workspace: string
  /** 중심 TASK — 계획 진행은 이것만 센다(보조 TASK 는 그 TASK 의 중심 Workspace 에서 센다 · 중복 금지) */
  core: TaskId[]
  tasks: TaskPlan[]
  /** 계획 진행(정량) — 계획 가능한 TASK 의 합. 숙달률이 아니다 */
  progress: { planned: number; done: number } | null
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/** 계획 진행 — 중심 TASK 중 계획 가능한 것의 합(수행은 계획량을 넘겨 세지 않는다) */
function progressOf(core: readonly TaskId[], list: readonly TaskPlan[]): WorkspacePlanView['progress'] {
  const p = list.filter((x) => core.includes(x.task) && x.quantity.planned !== null)
  return p.length ? { planned: p.reduce((s, x) => s + (x.quantity.planned ?? 0), 0), done: p.reduce((s, x) => s + Math.min(x.quantity.done, x.quantity.planned ?? 0), 0) } : null
}

/** 단계별 수행 수 — 이 TASK 의 확인 키 기록에서, 단계에 맞는 것만(서로 다른 문항) */
export function doneOf(stage: StageKey | null, t: AsIsTask, activity: readonly PlanActivity[]): number {
  if (!stage) return 0
  const keys = new Set(checkKeysOfTask(t.id))
  const after = t.check?.verifiedAt ?? null
  const mine = activity.filter((a) => keys.has(a.taskKey.replace(/-skeleton$/, '')) && a.itemRef)
  const since = (a: PlanActivity) => !after || (!!a.answeredAt && new Date(a.answeredAt).getTime() > new Date(after).getTime())
  switch (stage) {
    case 'check':
      // 수행량 = 실제로 푼 확인 문항(도움 · 합성 여부 무관). 독립성은 성취(achievement · 직접 확인)에서만 따진다 — 수행량 ≠ 검증된 성취(4차)
      return t.check?.attemptedItems ?? 0
    case 'repair': {
      const targets = new Set([...(t.check?.verifiedItems ?? []), ...(t.check?.wrongItems ?? [])])
      return uniq(mine.filter((a) => a.phase !== 'transfer' && targets.has(a.itemRef!) && since(a)).map((a) => a.itemRef)).length
    }
    case 'transfer':
      return uniq(mine.filter((a) => (a.phase === 'transfer' || a.taskKey.endsWith('-skeleton')) && since(a)).map((a) => a.itemRef)).length
    case 'recheck': {
      const used = new Set([...(t.check?.verifiedItems ?? [])])
      return uniq(mine.filter((a) => a.phase === 'practice' && !used.has(a.itemRef!) && since(a) && !!after).map((a) => a.itemRef)).length
    }
  }
}

const RULE_OF: Record<StageKey, QuantityRule> = { check: 'unseen_check_items', repair: 'blocked_items', transfer: 'transfer_pool', recheck: 'recheck_items' }

export function taskPlan(id: TaskId, asIs: AsIsMap, toBe: ToBeMap | null, ws: readonly WorkspaceView[], activity: readonly PlanActivity[]): TaskPlan {
  const def = taskOf(id)
  const t = asIs.tasks[id]
  const need = toBe?.needs.find((n) => n.task === id) ?? null
  const stage = need ? STAGE_OF_NEED[need.type] : null
  // 단계 가용량은 이 TASK 를 **중심**으로 하는 Workspace 에서만(보조로 든 곳의 수를 더하지 않는다 — 증거 · 자료 중복 금지)
  const home = ws.find((w) => w.core.includes(id)) ?? null
  const st = home && stage ? home.stages[stage] : null
  const done = doneOf(stage, t, activity)
  // 확인 단계 — 단계 수(st.count)는 「아직 안 본 문항」이고 수행(done)은 「이미 푼 문항」이다. 같은 묶음으로 세려면 둘을 더한다
  //   (안 본 수에서 푼 수를 또 빼면 5 중 3 을 풀었을 때 「2/2 끝」으로 보이던 결함 · 3차 리뷰 P1)
  const available = st && st.ready && st.count !== null ? (stage === 'check' ? st.count + done : st.count) : null
  const unresolved: TaskPlan['unresolved'] = []
  if (def.status === 'hold') unresolved.push('canon_hold')
  else if (!home || home.readiness !== 'live') unresolved.push('no_content')
  else if (stage && !st?.ready) unresolved.push('stage_locked')
  if (t.basis !== 'direct_check' && def.status !== 'hold') unresolved.push('needs_direct_check')
  if (toBe && !need && def.status !== 'hold') unresolved.push('not_goal_related')
  return {
    task: id,
    name: def.name,
    goal: def.goal,
    criterion: def.learner_criterion,
    evidence: t.status,
    basis: t.basis,
    relevance: need?.relevance ?? null,
    need: need?.type ?? null,
    priority: need?.priority ?? null,
    stage,
    workspaces: need?.workspaces ?? [],
    next: need?.executable ? { href: need.executable.href, label: need.executable.label } : home && stage && st?.ready && home.next ? { href: home.next.href, label: home.next.label } : null,
    quantity: {
      unit: '문항',
      available,
      planned: available,
      done,
      remaining: available === null ? null : Math.max(0, available - done),
      rule: available === null || !stage ? null : RULE_OF[stage],
      source: available === null ? 'none' : 'available_content',
      adjustable: available !== null,
    },
    achievement: ACHIEVEMENT_OF[t.status],
    unresolved,
  }
}

/** Workspace 하나의 TASK 계획 — 중심 먼저, 보조는 뒤(보조의 가용량은 그 TASK 의 중심 Workspace 기준) */
export function workspacePlan(w: WorkspaceView, asIs: AsIsMap, toBe: ToBeMap | null, plan: WorkspacePlan, activity: readonly PlanActivity[]): WorkspacePlanView {
  const views = [plan.primary, ...plan.others].filter((v): v is WorkspaceView => !!v)
  const list = [...w.core, ...w.support].map((id) => taskPlan(id, asIs, toBe, views, activity))
  return { workspace: w.id, core: [...w.core], tasks: list, progress: progressOf(w.core, list) }
}

/** 학습자 조정 초안 — 순서와 계획량만. 근거 · 판정 · 요구 칸은 여기 없다 */
export interface PlanDraft {
  order: TaskId[]
  planned: Record<TaskId, number>
}

/**
 * 조정 적용 — 계획량은 0 ~ 가용량으로 자른다(콘텐츠보다 많이 계획할 수 없다), 계획 불가 TASK 는 조정하지 않는다.
 * 순서는 초안에 있는 TASK 먼저, 나머지는 원래 순서. 근거 · 성취 · 요구 칸은 원본 그대로 복사된다.
 */
export function applyDraft(view: WorkspacePlanView, draft: PlanDraft | null): WorkspacePlanView {
  if (!draft) return view
  const planned = view.tasks.map((p) => {
    const want = draft.planned[p.task]
    if (want === undefined || p.quantity.available === null || !Number.isFinite(want)) return p
    const n = Math.max(0, Math.min(p.quantity.available, Math.round(want)))
    return { ...p, quantity: { ...p.quantity, planned: n, remaining: Math.max(0, n - p.quantity.done) } }
  })
  const rank = (id: TaskId) => { const i = draft.order.indexOf(id); return i < 0 ? draft.order.length + view.tasks.findIndex((p) => p.task === id) : i }
  const ordered = [...planned].sort((a, b) => rank(a.task) - rank(b.task))
  return { ...view, tasks: ordered, progress: progressOf(view.core, ordered) }
}

/** 모든 비보류 TASK 계획(지도에서 TASK → Workspace 찾기용) */
export function allTaskPlans(asIs: AsIsMap, toBe: ToBeMap | null, plan: WorkspacePlan, activity: readonly PlanActivity[]): TaskPlan[] {
  const views = [plan.primary, ...plan.others].filter((v): v is WorkspaceView => !!v)
  return tasks().filter((d) => d.status !== 'hold').map((d) => taskPlan(d.id, asIs, toBe, views, activity))
}

export const ACHIEVEMENT_LABEL: Record<Achievement, string> = {
  unmeasurable: '측정 방법을 정하는 중',
  not_checked: '아직 직접 확인 전',
  checking: '직접 확인 진행 중',
  need_confirmed: '직접 확인 — 연습 필요',
  resolved: '다시 확인 통과',
  expired: '다시 확인할 때',
}
export const RULE_LABEL: Record<QuantityRule, string> = {
  unseen_check_items: '아직 풀지 않은 확인 문항 수',
  blocked_items: '확인에서 막힌 문항 수',
  transfer_pool: '확인 묶음 밖 적용 문항 수',
  recheck_items: '다시 확인 기준 문항 수(서로 다른 2문항)',
}
