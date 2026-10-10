// apps/web/src/lib/csat/map/v4/to-be.ts
//
// To-Be Map — 목표가 있을 때, As-Is 근거 상태에서 TASK 별 **학습 요구 유형**과 확인 · 학습 **순서**를 낸다.
// 계약: docs/csat-learner/LEARNING_MAP_EXAM_INPUT_CONTRACT.md §5 · §6. 순수 함수.
//
// 목표가 하는 일은 하나 — 목표 관련도(기존 target.ts splitMust 의 「반드시 맞힐 문항」 중 그 TASK 의 기존 라인에 걸린 서로 다른 문항 · 배점)로
// 순서를 정한다. 하지 않는 것: 목표 점수를 TASK 별로 나누기 · 점수 향상 예측 · 필요 문항 수 생성 · As-Is 근거 상태 변경.
// 보류 TASK(L · X)에는 요구를 만들지 않는다 — EXAM_PRACTICE 는 「보류」로만 알린다(정본 §20-4).

import { splitMust, itemKey, type ItemKey, type RefItem } from '../target'

import type { AsIsMap, AsIsTask, TaskEvidence } from './as-is'
import { CANON_VERSION, checkKeysOfTask, linesOfTask, partsOf, taskOf, tasks, templates, type TaskId } from './definition'
import type { DirectCheck } from './types'

export type NeedType = 'CONFIRM' | 'REPAIR' | 'INTEGRATE' | 'TRANSFER' | 'MAINTAIN' | 'EXAM_PRACTICE'

export interface ToBeGoal {
  /** 목표 원점수(0~100) */
  score: number
  /** 학습자가 정한 목표인가 — 아니면 To-Be 를 만들지 않는다(기본값을 목표로 쓰지 않는다) */
  set: boolean
}

export interface ConfirmLink {
  target: string
  href: string
  label: string
}

export interface ToBeInput {
  asIs: AsIsMap
  goal: ToBeGoal | null
  /** 목표 계산 기준 시험의 전 문항(시험마다 배점 합 100) — splitMust 입력 */
  refItems: readonly RefItem[]
  /** 기존 라인 → 기준 시험에서 그 라인에 이어진 문항 */
  lineRefItems: Record<string, readonly RefItem[]>
  /** 확인 과제 키 → 실행 가능한 확인 문항 링크(보류 문항은 빠진 목록) */
  confirmLinks: Record<string, readonly ConfirmLink[]>
  /** 전이(다른 글 적용) 기록이 있는 확인 과제 키 */
  transferredKeys?: readonly string[]
}

export interface Need {
  task: TaskId
  type: Exclude<NeedType, 'EXAM_PRACTICE'>
  /** 1부터 — 낮을수록 먼저 */
  priority: number
  /** 목표 관련도 — 사실(문항 수 · 배점)만. 점수 향상이 아니다 */
  relevance: { items: number; pointsPerExam: number }
  /** As-Is 상태 그대로(목표가 바꾸지 않는다) */
  evidence: TaskEvidence
  basis: AsIsTask['basis']
  /** 추천 이유 코드 */
  reason: string
  /** 지금 실제로 할 수 있는 확인 문항(미노출 · 보류 아님) — 없으면 null */
  executable: ConfirmLink | null
  /** 이 TASK 를 중심 · 보조로 쓰는 Workspace 후보 */
  workspaces: string[]
  content: DirectCheck
}

export interface ToBeMap {
  asOf: string
  canonVersion: string
  goal: ToBeGoal
  /** 기준 시험 회수 — 관련도 단위 */
  exams: number
  needs: Need[]
  /** 목표 기준 문항에 걸리지 않은 TASK(요구 없음 — 목표와 무관하다는 사실) */
  unrelated: TaskId[]
  /** 지금 계산할 수 없는 요구 */
  notComputable: { task: TaskId; reason: 'canon_hold' | 'integrated_waits_parts' }[]
  deferred: { type: 'EXAM_PRACTICE'; reason: 'x_execution_model_deferred' }[]
}

const TYPE_RANK: Record<Need['type'], number> = { REPAIR: 0, CONFIRM: 1, INTEGRATE: 2, TRANSFER: 3, MAINTAIN: 4 }
// 같은 CONFIRM 안 — 이미 진행 중 · 축 기록상 먼저 · 기한 지남 · 관찰됨 · 근거 부족 · 기록 없음
const EVIDENCE_RANK: Partial<Record<TaskEvidence, number>> = { checking: 0, check_first: 1, expired: 2, observed: 3, insufficient: 4, analysis_pending: 5, unmeasured: 5 }

/** 목표 관련도 — 시험마다 splitMust(목표) 의 「반드시」 문항 중 이 TASK 의 기존 라인에 걸린 서로 다른 문항 */
export function goalRelevance(task: TaskId, must: ReadonlySet<ItemKey>, lineRefItems: ToBeInput['lineRefItems'], exams: number): Need['relevance'] {
  const seen = new Map<string, number>()
  for (const line of linesOfTask(task)) for (const it of lineRefItems[line] ?? []) {
    const k = itemKey(it)
    if (must.has(k)) seen.set(k, it.points)
  }
  const points = [...seen.values()].reduce((s, p) => s + p, 0)
  return { items: seen.size, pointsPerExam: exams > 0 ? Math.round((points / exams) * 10) / 10 : 0 }
}

export function mustSet(refItems: readonly RefItem[], goal: number): { must: Set<ItemKey>; exams: number } {
  const byExam = new Map<string, RefItem[]>()
  for (const it of refItems) byExam.set(it.examId, [...(byExam.get(it.examId) ?? []), it])
  const must = new Set<ItemKey>()
  for (const items of byExam.values()) for (const k of splitMust(items, goal).must) must.add(k)
  return { must, exams: byExam.size }
}

function needOf(t: AsIsTask, asIs: AsIsMap, transferred: ReadonlySet<string>): { type: Need['type']; reason: string } | 'integrated_waits_parts' | null {
  const def = taskOf(t.id)
  if (def.kind === 'integrated') {
    const parts = partsOf(t.id)
    if (parts.length > 0 && parts.every((p) => asIs.tasks[p]?.status === 'resolved') && t.status !== 'resolved') return { type: 'INTEGRATE', reason: 'parts_resolved' }
    return 'integrated_waits_parts'
  }
  switch (t.status) {
    case 'verified_need':
      return { type: 'REPAIR', reason: 'verified_need' }
    case 'resolved': {
      const done = checkKeysOfTask(t.id).some((k) => transferred.has(k))
      return done ? { type: 'MAINTAIN', reason: 'resolved_transferred' } : { type: 'TRANSFER', reason: 'resolved_not_transferred' }
    }
    case 'unmeasurable':
      return null
    default:
      return { type: 'CONFIRM', reason: `confirm_${t.status}` }
  }
}

export function toBeMap(input: ToBeInput): ToBeMap | null {
  const { asIs, goal } = input
  if (!goal || !goal.set) return null
  const { must, exams } = mustSet(input.refItems, goal.score)
  const transferred = new Set(input.transferredKeys ?? [])

  const needs: Omit<Need, 'priority'>[] = []
  const unrelated: TaskId[] = []
  const notComputable: ToBeMap['notComputable'] = []
  for (const def of tasks()) {
    const t = asIs.tasks[def.id]
    if (def.status === 'hold') {
      notComputable.push({ task: def.id, reason: 'canon_hold' })
      continue
    }
    const n = needOf(t, asIs, transferred)
    if (n === 'integrated_waits_parts') {
      notComputable.push({ task: def.id, reason: 'integrated_waits_parts' })
      continue
    }
    if (!n) continue
    const relevance = goalRelevance(def.id, must, input.lineRefItems, exams)
    // 직접 확인된 요구(REPAIR)는 목표 관련도와 무관하게 남긴다 — 확인된 근거를 목표 설정으로 지우지 않는다
    if (relevance.items === 0 && n.type !== 'REPAIR') {
      unrelated.push(def.id)
      continue
    }
    const keys = checkKeysOfTask(def.id)
    const unseen = new Set(t.check?.unseen ?? [])
    const executable = n.type === 'CONFIRM' || n.type === 'MAINTAIN'
      // 아직 본 적 없는 확인 문항만 — 이미 푼 문항을 「확인」으로 다시 내밀지 않는다(독립 첫 시도 원칙)
      ? keys.flatMap((k) => input.confirmLinks[k] ?? []).find((l) => unseen.has(l.target)) ?? null
      : null
    needs.push({
      task: def.id,
      type: n.type,
      relevance,
      evidence: t.status,
      basis: t.basis,
      reason: n.reason,
      executable,
      workspaces: templates().filter((w) => w.core.includes(def.id) || w.support.includes(def.id)).map((w) => w.id),
      content: def.direct_check,
    })
  }
  // 순서: 요구 유형 → 근거 단계 → 지금 실행 가능한가 → 목표 관련도. 실행할 수 없는 확인은 근거를 만들 수 없으므로
  // 같은 유형 · 같은 근거 단계 안에서는 실제 확인 문항이 있는 것을 먼저 둔다(2차 화면 검토 — 준비 중 항목이 1위에 오던 문제)
  const order = (n: Omit<Need, 'priority'>) => [TYPE_RANK[n.type], EVIDENCE_RANK[n.evidence] ?? 9, n.executable ? 0 : 1, -n.relevance.pointsPerExam]
  needs.sort((a, b) => {
    const x = order(a)
    const y = order(b)
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]
    return taskOf(a.task).display.localeCompare(taskOf(b.task).display)
  })
  return {
    asOf: asIs.asOf,
    canonVersion: CANON_VERSION,
    goal,
    exams,
    needs: needs.map((n, i) => ({ ...n, priority: i + 1 })),
    unrelated,
    notComputable,
    deferred: [{ type: 'EXAM_PRACTICE', reason: 'x_execution_model_deferred' }],
  }
}

export const NEED_LABEL: Record<NeedType, string> = {
  CONFIRM: '추가 확인',
  REPAIR: '바로잡기',
  INTEGRATE: '통합',
  TRANSFER: '다른 글에 적용',
  MAINTAIN: '유지 · 다시 확인',
  EXAM_PRACTICE: '실전 연습',
}
