// apps/web/src/lib/csat/map/v4/plan.ts
//
// TASK 별 학습계획(PLAN) 계약 — rev4.0 3차. As-Is(근거) · To-Be(요구) · Workspace(실행 가능 단계)를 TASK 한 줄로 모은다.
// 원칙(지시서 §3 · WORKSPACE_CONTRACT §3):
//   · 정량(계획 · 수행 · 남음)과 정성(성취 조건 · 확인된 상태)은 다른 칸이다. 「계획 5 중 3 수행」은 진행 3/5 이지 숙달 60% 가 아니다.
//   · 계획량은 **실제로 쓸 수 있는 문항 수**에서만 나온다(출처 · 산출 규칙 · 조정 가능 여부를 함께 싣는다). 교육적 근거가 있는
//     권장량이 없으므로 「권장 N개」를 만들지 않는다 — 콘텐츠가 없으면 계획량은 null(계획 불가)이고 이유를 단다.
//   · 학습자 조정(순서 · 계획량)은 계획만 바꾼다. 근거 상태 · 직접 확인 판정 · 요구 유형은 바뀌지 않는다(adjust 는 그 칸을 읽지도 쓰지도 않는다).
// 순수 함수(DB · 시계 없음).

import { isInstructional, isKiceRepairTarget, passageIdentity, repairSuccess, repairWindow, transferTarget } from '../lifecycle-evidence'

import type { AsIsMap, AsIsTask, TaskEvidence } from './as-is'
import { evidenceKeysOfTask, taskOf, tasks, type TaskId } from './definition'
import type { Need, ToBeMap } from './to-be'
import { TRANSFER_PASSAGES, type StageKey, type WorkspacePlan, type WorkspaceView } from './workspace'

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
  unit: '문항' | '지문'
  /** 학습자가 쓸 수 있는 실제 문항 수(상한) — 없으면 null(계획 불가) */
  available: number | null
  /** 계획량 — 기본 = 가용량. 학습자 조정 뒤 값. 계획 불가면 null */
  planned: number | null
  /** 수행한 수(적용은 서로 다른 지문, 나머지는 서로 다른 문항) — 이 단계 기록만 */
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
  /** Content capacity independent of the currently allocated stage (restore validation). */
  transferAvailable?: number
  quantity: PlanQuantity
  achievement: Achievement
  /** 아직 풀리지 않은 것(문구 키) */
  unresolved: ('no_content' | 'stage_locked' | 'material_needed' | 'repair_material_needed' | 'canon_hold' | 'needs_direct_check' | 'not_goal_related' | 'transfer_shortage')[]
}

export interface PlanActivity {
  passageKey?: string | null
  itemRef: string | null
  taskKey: string
  phase: string
  answeredAt: string | null
  /** 정오(G2 원장 is_correct 그대로) — 바로잡기 성공은 true 만. 없거나 null 이면 성공 근거가 아니다(LM-G1.1) */
  isCorrect?: boolean | null
  /** 서버 수신 시각(원장 그대로) — 안내 연습이 이번 회차를 진전시키려면 회차 시작 뒤여야 한다(FI-011) */
  receivedAt?: string | null
  activity?: string | null
  /** 서버가 확인한 정확한 바로잡기 납품 결속(lifecycle-evidence ActivityRow.repairRole) */
  repairRole?: 'guided_practice'
  /** 여러 단계 교수 활동의 첫 단계 시작 시각(lifecycle-evidence ActivityRow.lessonStartedAt) */
  lessonStartedAt?: string | null
}

export interface WorkspacePlanView {
  /** Effective core transfer policy of each saved version, derived from full history. */
  restoreTransfer?: Record<number, Partial<Record<string, number>>>
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

/**
 * 적용 진행(LM-G1.2 · 계획 · lifecycle 공용) — 이 TASK 의 확인 키(skeleton 포함)로 확정 뒤 남긴 적용 시도의 **서로 다른 지문 수**.
 * 같은 문항 반복은 1, 다른 TASK 키의 시도는 0. 정오는 따지지 않는다(적용 경험 · 결과는 CHECK 가 판정).
 */
export function transferDoneOf(id: TaskId, since: string | null, activity: readonly Pick<PlanActivity, 'itemRef' | 'taskKey' | 'phase' | 'answeredAt' | 'passageKey'>[]): number {
  const keys = new Set(evidenceKeysOfTask(id))
  const after = since ? new Date(since).getTime() : null
  return uniq(activity.filter((a) => a.itemRef && keys.has(a.taskKey.replace(/-skeleton$/, '')) && (a.phase === 'transfer' || a.taskKey.endsWith('-skeleton')) && (after === null || (!!a.answeredAt && new Date(a.answeredAt).getTime() > after))).map((a) => passageIdentity(a.itemRef, a.passageKey)).filter((x): x is string => !!x)).length
}

/** 단계별 수행 수 — 이 TASK 의 확인 키 기록에서, 단계에 맞는 것만(서로 다른 문항) */
export function doneOf(stage: StageKey | null, t: AsIsTask, activity: readonly PlanActivity[]): number {
  if (!stage) return 0
  const keys = new Set(evidenceKeysOfTask(t.id))
  const after = t.check?.verifiedAt ?? null
  const mine = activity.filter((a) => keys.has(a.taskKey.replace(/-skeleton$/, '')) && a.itemRef)
  const since = (a: PlanActivity) => !after || (!!a.answeredAt && new Date(a.answeredAt).getTime() > new Date(after).getTime())
  switch (stage) {
    case 'check':
      // 수행량 = 실제로 푼 확인 문항(도움 · 합성 여부 무관). 독립성은 성취(achievement · 직접 확인)에서만 따진다 — 수행량 ≠ 검증된 성취(4차)
      return t.check?.attemptedItems ?? 0
    case 'repair': {
      // 막힌 기출 재시도 + 이번 회차의 결속된 안내 연습(서로 다른 문항) — 교수 자료 수행은 바로잡기에만 센다(FI-011)
      const targets = new Set([...(t.check?.verifiedItems ?? []), ...(t.check?.wrongItems ?? [])])
      const gate = repairGate(t, activity)
      return uniq([...mine.filter((a) => !isInstructional(a) && isKiceRepairTarget(a) && a.phase !== 'transfer' && targets.has(a.itemRef!) && since(a)).map((a) => a.itemRef), ...gate.guidedTried]).length
    }
    case 'transfer':
      return transferDoneOf(t.id, after, activity)
    case 'recheck': {
      const used = new Set([...(t.check?.verifiedItems ?? [])])
      return uniq(mine.filter((a) => a.phase === 'practice' && !isInstructional(a) && !used.has(a.itemRef!) && since(a) && !!after).map((a) => a.itemRef)).length
    }
  }
}

/**
 * 바로잡기 단계 준비(LM-G1.1) — **수행량이 아니라 성공 근거**로 단계를 넘긴다. lifecycle-evidence 의 같은 창(repairWindow)을 쓴다:
 *   이번 회차(확정 뒤 · 다시 확인에서 막혔으면 그 뒤)의 막힌 문항 시도 중 정답(true)이 하나라도 있으면 성공.
 *   retry = 아직 이번 회차에 맞히지 못한 막힌 문항(시도했다가 틀린 문항도 포함 — 재시도 대상).
 */
export function repairGate(t: AsIsTask, activity: readonly PlanActivity[]): { succeeded: boolean; tried: number; retry: string[]; guidedRight: string[]; guidedTried: string[] } {
  const c = t.check
  if (!c?.verifiedAt) return { succeeded: false, tried: 0, retry: [], guidedRight: [], guidedTried: [] }
  const skill = { status: c.status, verifiedAt: c.verifiedAt, verifiedItems: c.verifiedItems, check: { wrongItems: c.wrongItems, lastWrongAt: c.lastWrongAt ?? null } }
  const keys = new Set(evidenceKeysOfTask(t.id))
  // FI-011 — lifecycle repairAt 과 **같은 판정**(repairSuccess): 막힌 기출 재시도 정답 또는 정확히 결속된 안내 연습 정답(판단 · 서버 수신 모두 회차 뒤)
  const r = repairSuccess(skill, keys, activity.map((a) => ({ ...a, isCorrect: a.isCorrect ?? null, taskKey: a.taskKey.replace(/-skeleton$/, '') })))
  const right = new Set(r.retried.filter((a) => a.isCorrect === true).map((a) => a.itemRef))
  const blocked = repairWindow(skill)?.blocked ?? []
  const guidedRight = uniq(r.guided.filter((a) => a.isCorrect === true).map((a) => a.itemRef as string))
  const guidedTried = uniq(r.guided.map((a) => a.itemRef as string))
  return { succeeded: r.at !== null, tried: new Set([...r.retried, ...r.guided].map((a) => a.itemRef)).size, retry: blocked.filter((i) => !right.has(i)), guidedRight, guidedTried }
}

/**
 * LM-G1.2 — 학습자가 저장한 계획에서 온 운영 계획량(TASK → 적용 계획량). 저장 계획의 그 TASK 가 「적용」 단계로 저장됐을 때만 쓴다
 * (다른 단계로 저장한 계획량을 적용량으로 옮기지 않는다). 계획량은 운영량이다 — 숙달 기준 · 성취를 바꾸지 않는다.
 */
export interface PlanOpts {
  savedTransfer?: Partial<Record<string, number>>
}

/** 적용 운영 계획량(lifecycle-evidence.transferTarget) — 이 TASK 의 중심 Workspace 적용 가용(정본 2지문 상한) · 저장 계획량 */
export function transferPlanned(t: AsIsTask, home: WorkspaceView | null, opts?: PlanOpts): number | null {
  const st = home?.stages.transfer
  return transferTarget(st?.ready ? st.count : 0, opts?.savedTransfer?.[t.id], TRANSFER_PASSAGES)
}

/** 자료가 아직 없을 때의 적용 목표 — 저장 계획량(1 이상)이 있으면 그것, 없으면 정본 2지문(transferTarget 과 같은 정책 · 가용량 없이) */
function transferGoal(saved: number | null | undefined): number {
  return saved !== null && saved !== undefined && Number.isInteger(saved) && saved >= 1 ? saved : TRANSFER_PASSAGES
}

const RULE_OF: Record<StageKey, QuantityRule> = { check: 'unseen_check_items', repair: 'blocked_items', transfer: 'transfer_pool', recheck: 'recheck_items' }

/**
 * 지금 단계 — 확정된 요구(REPAIR) 안에서는 정본 순서(workspaces.json quantity_policy): 바로잡기 → 다른 글에 적용(전이 2지문) → 다시 확인.
 *   LM-G1.1: 바로잡기는 **성공 근거(repairGate)** 가 생겨야 넘어간다 — 틀린 · 정오 없는 시도는 수행량(doneOf)으로만 남고 단계를 넘기지 않는다
 *   (G02: 2회 실패 → 수행 2 · 다음도 바로잡기). 바로잡기 자료가 없으면 다른 단계로 건너뛰지 않고 바로잡기(링크 없음 = 실제 막힘)에 머문다.
 *   적용 · 다시 확인은 기존 정책 그대로(적용 = 계획량만큼 · 문항이 없으면 건너뜀). 단계가 넘어가도 **성취는 바꾸지 않는다** —
 *   「다시 확인 통과(resolved)」는 As-Is 의 독립 첫 시도 판정에서만 나온다(수행량 ≠ 검증된 성취).
 */
export function stageNow(need: Need | null, t: AsIsTask, home: WorkspaceView | null, activity: readonly PlanActivity[], opts?: PlanOpts): StageKey | null {
  if (!need) return null
  const base = STAGE_OF_NEED[need.type]
  if (need.type !== 'REPAIR' || !home) return base
  if (!repairGate(t, activity).succeeded) return 'repair'
  // 적용 — 운영 계획량(저장 계획량 · 정본 2지문)을 채울 때까지. 1회 경험 ≠ 계획 완료. 자료가 없으면(null) 건너뛴다(완료로 꾸미지 않는다)
  // 적용 목표 = 운영 계획량(저장 계획량 · 정본 2지문). 아직 전이 자료를 **받지 않았다는 것**은 적용을 마친 것이 아니다(T-0052 Codex P1 —
  //   전이 링크가 있어야 transfer 가 열리고 공급은 현재 단계로만 요청하던 순환). 목표가 남으면 transfer 에 머물고, 자료가 없으면 그 단계의
  //   부족(no_transfer_items → material_needed)으로 보이며 수요는 전이 역할로 난다. 가용량 · 수행량은 만들어내지 않는다
  const planned = transferPlanned(t, home, opts) ?? transferGoal(opts?.savedTransfer?.[t.id])
  if (doneOf('transfer', t, activity) < planned) return 'transfer'
  // 바로잡기 성공 · 적용 운영 조건 충족 뒤에는 「다시 확인」 단계다 — 다시 확인 문항이 부족해도 성공한 바로잡기로 되돌리지 않는다(FI-011 B · 순환 방지).
  //   부족은 recheck.ready=false → material_needed(새 독립 확인 자료 필요)로 안내하고, 수요는 그 단계 역할(independent_check)로 만든다
  return 'recheck'
}

/**
 * 단계의 다음 활동 하나. 확인 · 다시 확인은 Workspace 의 안 본 확인 문항.
 *   바로잡기(LM-G1.1): 이번 회차에 아직 **맞히지 못한** 막힌 문항 — 틀린 시도가 있어도 재시도 대상으로 남긴다(시도했다고 빼지 않는다).
 *   자료가 없거나 단계가 닫혀 있으면 null(실제 막힘) — 다른 단계의 자료로 바꿔 열지 않는다.
 *   적용: 아직 안 한 적용 문항.
 */
function stageLink(stage: StageKey | null, t: AsIsTask, home: WorkspaceView | null, activity: readonly PlanActivity[]): { href: string; label: string } | null {
  if (!home || !stage || !home.stages[stage].ready) return null
  if (stage === 'check' || stage === 'recheck') return home.next ? { href: home.next.href, label: home.next.label } : null
  if (stage === 'repair') {
    const gate = repairGate(t, activity)
    const retry = new Set(gate.retry)
    // 기출 막힌 문항(재시도) → 아직 맞히지 못한 안내 연습 → 원리 설명 순. 창작 평가 자료는 repairable 에서 이미 빠졌다
    const pick = home.stageItems.repair.find((l) => !l.role && retry.has(l.target))
      ?? home.stageItems.repair.find((l) => l.role === 'guided_practice' && !gate.guidedRight.includes(l.target))
      ?? home.stageItems.repair.find((l) => l.role === 'model_explanation')
      ?? null
    return pick ? { href: pick.href, label: pick.label } : null
  }
  const after = t.check?.verifiedAt ? new Date(t.check.verifiedAt).getTime() : null
  // 수행량(doneOf)과 같은 TASK 키 범위. 다른 과제로 같은 지문을 푼 기록은 이 과제의 적용 링크를 소진하지 않는다.
  const keys = new Set(evidenceKeysOfTask(t.id))
  const did = new Set(activity.filter((a) => keys.has(a.taskKey.replace(/-skeleton$/, '')) && a.itemRef && (!after || (!!a.answeredAt && new Date(a.answeredAt).getTime() > after)) && (stage === 'transfer' ? a.phase === 'transfer' || a.taskKey.endsWith('-skeleton') : a.phase !== 'transfer')).map((a) => passageIdentity(a.itemRef, a.passageKey)).filter((x): x is string => !!x))
  const pick = home.stageItems[stage].find((l) => { const key = passageIdentity(l.target, l.passageKey); return !!key && !did.has(key) }) ?? null
  return pick ? { href: pick.href, label: pick.label } : null
}

/** T-0070 — 이 묶음에 지금 실제로 쓸 수 있는 단계 자료가 있는가(어느 단계가 열렸거나 · 단계 자료 링크가 하나라도 있다) */
function hasUsableContent(home: WorkspaceView): boolean {
  return Object.values(home.stages).some((s) => s.ready) || Object.values(home.stageItems).some((l) => l.length > 0)
}

/** 보조 TASK 의 home — 그 TASK 를 보조로 든 묶음 중 그 TASK 자신의 창작 자료 보기가 있는 첫 묶음(core 는 이 TASK 로 바꿔 단계 계산이 이 TASK 를 보게) */
export function supportHome(ws: readonly WorkspaceView[], id: TaskId): WorkspaceView | null {
  const w = ws.find((x) => x.support.includes(id) && x.supportViews?.[id])
  const v = w?.supportViews?.[id]
  return w && v ? { ...w, core: [id], support: [], stages: v.stages, next: v.next, stageItems: v.stageItems, readiness: v.readiness, supportViews: undefined } : null
}

export function taskPlan(id: TaskId, asIs: AsIsMap, toBe: ToBeMap | null, ws: readonly WorkspaceView[], activity: readonly PlanActivity[], opts?: PlanOpts): TaskPlan {
  const def = taskOf(id)
  const t = asIs.tasks[id]
  const need = toBe?.needs.find((n) => n.task === id) ?? null
  // 단계 가용량은 이 TASK 를 **중심**으로 하는 Workspace 에서만(보조로 든 곳의 수를 더하지 않는다 — 증거 · 자료 중복 금지)
  // T-0056 — 어느 묶음의 중심도 아니면, 보조로 든 묶음에서 **이 TASK 자신의** 단계 보기(supportViews)를 home 으로(자료 · 수행 · 단계는 이 TASK 것만).
  //   진행 합(progressOf)은 그대로 중심 TASK 만 센다 — 보조 TASK 수행이 묶음 진전에 섞이지 않는다
  const home = ws.find((w) => w.core.includes(id)) ?? supportHome(ws, id)
  const stage = stageNow(need, t, home, activity, opts)
  const st = home && stage ? home.stages[stage] : null
  const done = doneOf(stage, t, activity)
  // 확인 단계 — 단계 수(st.count)는 「아직 안 본 문항」이고 수행(done)은 「이미 푼 문항」이다. 같은 묶음으로 세려면 둘을 더한다
  //   (안 본 수에서 푼 수를 또 빼면 5 중 3 을 풀었을 때 「2/2 끝」으로 보이던 결함 · 3차 리뷰 P1)
  const available = st && st.ready && st.count !== null ? (stage === 'check' ? st.count + done : st.count) : null
  // 적용 단계의 계획량 = 운영 계획량(저장 계획량이 있으면 그것) — 가용과 다를 수 있다(LM-G1.2)
  const planned = stage === 'transfer' && available !== null ? transferPlanned(t, home, opts) : available
  const unresolved: TaskPlan['unresolved'] = []
  if (stage === 'transfer' && planned !== null && (available ?? 0) < planned) unresolved.push('transfer_shortage')
  if (def.status === 'hold') unresolved.push('canon_hold')
  // T-0070 — 「콘텐츠 없음」은 실제로 쓸 단계 자료가 하나도 없을 때만. 정본 readiness 가 live 가 아니어도 창작 납품으로 단계 · 링크가 열렸으면
  //   그 단계의 실제 상태(부족 · 잠김)로 말한다. readiness 를 live 로 올리지 않는다(정본 상태는 그대로 · 가용량은 실제 단계 값만)
  else if (!home || (home.readiness !== 'live' && !hasUsableContent(home))) unresolved.push('no_content')
  // 단계가 열릴 차례인데 그 단계 자료를 다 썼거나 없다(앞 단계 미완료가 아니다) — 「새 자료가 필요해요」로 정확히 안내
  else if (stage && !st?.ready) unresolved.push(st?.blocked === 'no_repair_items' ? 'repair_material_needed' : st?.blocked === 'no_unseen_items' || st?.blocked === 'not_enough_unseen' || st?.blocked === 'no_transfer_items' ? 'material_needed' : 'stage_locked')
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
    next: need?.executable ? { href: need.executable.href, label: need.executable.label } : stageLink(stage, t, home, activity),
    transferAvailable: Math.min(TRANSFER_PASSAGES, new Set((home?.stageItems?.transfer ?? []).map(l => passageIdentity(l.target, l.passageKey)).filter(x => x !== null)).size),
    quantity: {
      unit: stage === 'transfer' ? '지문' : '문항',
      available,
      planned,
      done,
      remaining: planned === null ? null : Math.max(0, planned - done),
      rule: available === null || !stage ? null : RULE_OF[stage],
      source: available === null ? 'none' : 'available_content',
      adjustable: available !== null,
    },
    achievement: ACHIEVEMENT_OF[t.status],
    unresolved,
  }
}

/** Workspace 하나의 TASK 계획 — 중심 먼저, 보조는 뒤(보조의 가용량은 그 TASK 의 중심 Workspace 기준) */
export function workspacePlan(w: WorkspaceView, asIs: AsIsMap, toBe: ToBeMap | null, plan: WorkspacePlan, activity: readonly PlanActivity[], opts?: PlanOpts): WorkspacePlanView {
  const views = [plan.primary, ...plan.others].filter((v): v is WorkspaceView => !!v)
  const list = [...w.core, ...w.support].map((id) => {
    const p = taskPlan(id, asIs, toBe, views, activity, opts)
    return p.stage === 'transfer' && !w.core.includes(id) ? { ...p, quantity: { ...p.quantity, adjustable: false } } : p
  })
  return { workspace: w.id, core: [...w.core], tasks: list, progress: progressOf(w.core, list) }
}

/** 학습자 조정 초안 — 순서와 계획량만. 근거 · 판정 · 요구 칸은 여기 없다 */
export interface PlanDraft {
  /** Local quantity intent is valid only for the recorded TASK stage. */
  stages?: Record<string, string | null>
  order: TaskId[]
  planned: Record<TaskId, number>
}

/**
 * 조정 적용 — 계획량은 0 ~ 가용량으로 자른다(적용은 기존 최소1)(콘텐츠보다 많이 계획할 수 없다), 계획 불가 TASK 는 조정하지 않는다.
 * 순서는 초안에 있는 TASK 먼저, 나머지는 원래 순서. 근거 · 성취 · 요구 칸은 원본 그대로 복사된다.
 */
export function applyDraft(view: WorkspacePlanView, draft: PlanDraft | null): WorkspacePlanView {
  if (!draft) return view
  const planned = view.tasks.map((p) => {
    const want = draft.planned[p.task]
    if ((draft.stages && draft.stages[p.task] !== p.stage) || !p.quantity.adjustable || (p.stage === 'transfer' && want < 1) || want === undefined || p.quantity.available === null || !Number.isFinite(want) || want === p.quantity.planned) return p
    const n = Math.max(0, Math.min(p.quantity.available, Math.round(want)))
    return { ...p, quantity: { ...p.quantity, planned: n, remaining: Math.max(0, n - p.quantity.done) } }
  })
  const rank = (id: TaskId) => { const i = draft.order.indexOf(id); return i < 0 ? draft.order.length + view.tasks.findIndex((p) => p.task === id) : i }
  const ordered = [...planned].sort((a, b) => rank(a.task) - rank(b.task))
  return { ...view, tasks: ordered, progress: progressOf(view.core, ordered) }
}

/** 모든 비보류 TASK 계획(지도에서 TASK → Workspace 찾기용) */
export function allTaskPlans(asIs: AsIsMap, toBe: ToBeMap | null, plan: WorkspacePlan, activity: readonly PlanActivity[], opts?: PlanOpts): TaskPlan[] {
  const views = [plan.primary, ...plan.others].filter((v): v is WorkspaceView => !!v)
  return tasks().filter((d) => d.status !== 'hold').map((d) => taskPlan(d.id, asIs, toBe, views, activity, opts))
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
  transfer_pool: '확인 묶음 밖 서로 다른 지문 수',
  recheck_items: '다시 확인 기준 문항 수(서로 다른 2문항)',
}
