// apps/web/src/lib/csat/map/v4/plan-commit.ts
//
// 학습계획 저장 요청 → RPC 페이로드(순수 함수 · 4차). 신뢰 경계(LEARNING_MAP_V4_PLAN_SCHEMA §0):
//   학습자가 보내는 것 = template · order · planned(TASK 별) · reason · note · expectedVersion · clientKey(+ restoreOf)
//   서버가 채우는 것 = 템플릿 TASK 목록(정의) · TASK 별 단계 · **가용 문항 수**(서버가 지금 계산한 계획 보기) · 규칙 · 정의 버전 · 기준 시점
// 클라이언트가 보낸 가용량은 받지 않는다(요청 모양에 칸이 없다). 계획량이 가용량을 넘으면 조용히 자르지 않고 거절한다.

import { CANON_VERSION, templateOf, type TaskId } from './definition'
import type { WorkspacePlanView } from './plan'

export const PLAN_REASONS = ['initial', 'learner_adjust', 'new_exam', 'check_result', 'goal_change', 'definition_change', 'content_change', 'restore'] as const
export type PlanReason = (typeof PLAN_REASONS)[number]
/** 학습자가 고를 수 있는 사유 — 나머지는 서버 · 화면이 상황으로 정한다 */
export const LEARNER_REASONS: readonly PlanReason[] = ['initial', 'learner_adjust', 'new_exam', 'check_result', 'goal_change', 'content_change', 'definition_change', 'restore']

export const REASON_LABEL: Record<PlanReason, string> = {
  initial: '처음 확정',
  learner_adjust: '내가 조정',
  new_exam: '새 시험 기록',
  check_result: '확인 결과 반영',
  goal_change: '목표 변경',
  content_change: '쓸 수 있는 문항이 바뀜',
  definition_change: '학습 기준이 바뀜',
  restore: '이전 계획으로 되돌림',
}

export interface PlanCommitRequest {
  template: string
  order: TaskId[]
  planned: Record<TaskId, number | null>
  reason: PlanReason
  note?: string | null
  expectedVersion: number
  clientKey: string
  restoreOf?: number | null
}

export interface PlanPayloadTask {
  task: TaskId
  stage: string | null
  planned: number | null
  /** 서버가 계산한 지금 가용 문항 수 */
  available: number | null
  rule: string | null
}
export interface PlanPayload {
  order: TaskId[]
  tasks: PlanPayloadTask[]
}

export type CommitBuild =
  | { ok: true; templateTasks: TaskId[]; plan: PlanPayload; canon: string; asOf: string }
  | { ok: false; status: 400 | 422; code: string; detail?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 요청 모양 검사(인증 · DB 전) — 알 수 없는 칸(available 등)은 무시하지 않고 거절한다 */
export function parseCommitRequest(body: unknown): { ok: true; req: PlanCommitRequest } | { ok: false; code: string } {
  if (!body || typeof body !== 'object') return { ok: false, code: 'body' }
  const b = body as Record<string, unknown>
  const allowed = new Set(['template', 'order', 'planned', 'reason', 'note', 'expectedVersion', 'clientKey', 'restoreOf'])
  for (const k of Object.keys(b)) if (!allowed.has(k)) return { ok: false, code: `unknown_field:${k}` }
  if (typeof b.template !== 'string' || !/^ws\.[a-z0-9-]{1,40}$/.test(b.template)) return { ok: false, code: 'template' }
  if (!Array.isArray(b.order) || b.order.length > 50 || !b.order.every((t) => typeof t === 'string' && t.length <= 64)) return { ok: false, code: 'order' }
  if (!b.planned || typeof b.planned !== 'object' || Array.isArray(b.planned)) return { ok: false, code: 'planned' }
  for (const v of Object.values(b.planned as Record<string, unknown>)) if (!(v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 999))) return { ok: false, code: 'planned_value' }
  if (typeof b.reason !== 'string' || !(LEARNER_REASONS as readonly string[]).includes(b.reason)) return { ok: false, code: 'reason' }
  if (b.note !== undefined && b.note !== null && (typeof b.note !== 'string' || b.note.length > 500)) return { ok: false, code: 'note' }
  if (!Number.isInteger(b.expectedVersion) || (b.expectedVersion as number) < 0) return { ok: false, code: 'expectedVersion' }
  if (typeof b.clientKey !== 'string' || !UUID.test(b.clientKey)) return { ok: false, code: 'clientKey' }
  if (b.reason === 'restore' ? !(Number.isInteger(b.restoreOf) && (b.restoreOf as number) >= 1) : b.restoreOf !== undefined && b.restoreOf !== null) return { ok: false, code: 'restoreOf' }
  return { ok: true, req: b as unknown as PlanCommitRequest }
}

/**
 * 서버가 지금 계산한 계획 보기(view)로 페이로드를 만든다. 순서 = 템플릿 TASK 의 순열 · 모르는 TASK 거절 ·
 * 계획량은 가용량 이하(가용량이 없으면 계획량 없음). 이 검사는 RPC 가 한 번 더 한다(이중).
 */
export function buildCommitPayload(req: PlanCommitRequest, view: WorkspacePlanView | null, asOf: string): CommitBuild {
  const tpl = templateOf(req.template)
  if (!tpl || tpl.hold) return { ok: false, status: 422, code: 'template_unknown' }
  if (!view || view.workspace !== req.template) return { ok: false, status: 422, code: 'template_not_available' }
  const templateTasks = [...tpl.core, ...tpl.support]
  const set = new Set(templateTasks)
  if (req.order.length !== templateTasks.length || new Set(req.order).size !== req.order.length || req.order.some((t) => !set.has(t))) {
    return { ok: false, status: 422, code: 'order', detail: '순서는 이 묶음의 항목을 한 번씩 모두 담아야 해요' }
  }
  for (const t of Object.keys(req.planned)) if (!set.has(t)) return { ok: false, status: 422, code: 'planned_task', detail: t }
  const tasks: PlanPayloadTask[] = []
  for (const id of templateTasks) {
    const p = view.tasks.find((x) => x.task === id)
    const available = p?.quantity.available ?? null
    const want = req.planned[id] ?? null
    if (want !== null && (available === null || want > available)) return { ok: false, status: 422, code: 'planned_over_available', detail: `${id}: ${want} > ${available ?? '없음'}` }
    tasks.push({ task: id, stage: p?.stage ?? null, planned: want, available, rule: p?.quantity.rule ?? null })
  }
  return { ok: true, templateTasks, plan: { order: [...req.order], tasks }, canon: CANON_VERSION, asOf }
}

export interface SavedPlanVersion {
  version: number
  plan: PlanPayload
  reason: PlanReason
  note: string | null
  restoredFrom: number | null
  canon: string
  asOf: string
  createdAt: string
}

/** 저장된 계획과 지금 계획 보기의 차이 — 재계획 제안(콘텐츠 · 정의가 바뀌었을 때). 근거 · 판정은 보지 않는다 */
export function planDrift(saved: SavedPlanVersion | null, view: WorkspacePlanView): { content: { task: TaskId; saved: number | null; now: number | null }[]; definition: boolean; overAvailable: TaskId[] } | null {
  if (!saved) return null
  const content: { task: TaskId; saved: number | null; now: number | null }[] = []
  const overAvailable: TaskId[] = []
  for (const t of saved.plan.tasks) {
    const now = view.tasks.find((x) => x.task === t.task)?.quantity.available ?? null
    if (now !== t.available) content.push({ task: t.task, saved: t.available, now })
    if (t.planned !== null && (now === null || t.planned > now)) overAvailable.push(t.task)
  }
  return { content, definition: saved.canon !== CANON_VERSION, overAvailable }
}

/** 저장된 계획을 화면 보기에 덮는다 — 순서 · 계획량만(가용량이 줄었으면 가용량으로 자르고 표시는 drift 가 한다). 근거 · 수행은 지금 값 */
export function applySaved(view: WorkspacePlanView, saved: SavedPlanVersion | null): WorkspacePlanView {
  if (!saved) return view
  const rank = (id: TaskId) => { const i = saved.plan.order.indexOf(id); return i < 0 ? 999 + view.tasks.findIndex((p) => p.task === id) : i }
  const tasks = view.tasks.map((p) => {
    const s = saved.plan.tasks.find((t) => t.task === p.task)
    if (!s || p.quantity.available === null) return p
    const planned = s.planned === null ? null : Math.min(s.planned, p.quantity.available)
    return { ...p, quantity: { ...p.quantity, planned, remaining: planned === null ? null : Math.max(0, planned - p.quantity.done) } }
  }).sort((a, b) => rank(a.task) - rank(b.task))
  const core = tasks.filter((p) => view.core.includes(p.task) && p.quantity.planned !== null)
  return { ...view, tasks, progress: core.length ? { planned: core.reduce((s, p) => s + (p.quantity.planned ?? 0), 0), done: core.reduce((s, p) => s + Math.min(p.quantity.done, p.quantity.planned ?? 0), 0) } : null }
}
