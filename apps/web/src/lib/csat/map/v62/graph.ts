// apps/web/src/lib/csat/map/v62/graph.ts
//
// v6.2 §2 · §3 G1 · §9 — 단일 학습지도가 그리는 데이터.
//   DomainTaskGraphDTO = 영역 6 · TASK 30(영구 slug) · 관계 34 를 **정의 그대로** — 승인(approved) / 제안(proposed)을 구분.
//   TaskInspectorDTO   = 선택한 TASK 하나의 「현재와 목표 / 기출 · 출제 논리 / 교재 · 학습 · 계획 / 결과」 — V4View · Ranks · Ledger 만 읽는다.
// 30 TASK 정의(rev4 codebook)는 바꾸지 않는다. v6.2 가 붙인 연구 표지(독립성 보류 등)는 표시용 주석일 뿐 판정을 바꾸지 않는다.

import type { V4View } from '../v4/compose'
import { CANON_VERSION, DOMAIN_NAME, DOMAINS, relations, taskOf, tasks, templates, type Domain, type TaskId } from '../v4/definition'
import type { DirectCheck, RelationType } from '../v4/types'

import type { GapCode, GoalCoverageLedger, TaskCoverage } from './coverage'
import type { Ranks } from './rank'

export const V62_CANON_VERSION = 'v6.2(2026-10-14)'

/** v6.2 §2.2 「현행 상태」 표지 — 연구 게이트. 판정 · 요구 계산에 쓰지 않는다 */
export type ResearchFlag = 'independence_hold' | 'reclassification_candidate' | 'definition_split_candidate' | 'inference_gate_pending'
export const RESEARCH_FLAGS: Readonly<Record<TaskId, ResearchFlag>> = {
  's.chunk_boundary': 'independence_hold',
  's.attachment': 'independence_hold',
  'r.discourse_function': 'independence_hold',
  'r.discourse_structure': 'independence_hold',
  'e.task_demand': 'reclassification_candidate',
  'v.contextual_sense': 'definition_split_candidate',
  's.form_scope': 'definition_split_candidate',
  'r.inference': 'inference_gate_pending',
}

/** v6.2 §2.1 영역별 학습자 질문 */
export const DOMAIN_QUESTION: Record<Domain, string> = {
  V: '이 표현이 여기에서 무엇을 뜻하는가?',
  S: '누가, 무엇을, 어떤 조건에서 말하는가?',
  R: '문장과 문단은 어떤 관계로 글의 의미를 만드는가?',
  E: '무엇을 묻고, 어떤 근거가 어떤 후보를 지지 · 배제하는가?',
  L: '듣고 무엇을 이해하고 판단했는가?',
  X: '같은 이해를 시간과 상황 제약에서 유지할 수 있는가?',
}

export interface GraphTask {
  id: TaskId
  display: string
  domain: Domain
  name: string
  kind: 'atomic' | 'integrated'
  hold: boolean
  directCheck: DirectCheck
  researchFlag: ResearchFlag | null
  /** 이 TASK 를 중심으로 하는 학습 묶음(Template) */
  coreOf: string[]
}

export interface GraphEdge {
  id: string
  type: RelationType
  from: TaskId
  to: TaskId
  /** approved = 구조적 연결(실선) · proposed = 연결 연구 중(점선) — 선수 강제 화살표가 아니다 */
  approval: 'approved' | 'proposed'
}

export interface DomainTaskGraphDTO {
  canonVersion: string
  v62: string
  domains: { id: Domain; name: string; question: string; hold: boolean; tasks: TaskId[] }[]
  tasks: GraphTask[]
  edges: GraphEdge[]
  counts: { tasks: number; nonHold: number; hold: number; atomicNonHold: number; integratedNonHold: number }
}

export function domainTaskGraph(): DomainTaskGraphDTO {
  const list: GraphTask[] = tasks().map((t) => ({
    id: t.id,
    display: t.display,
    domain: t.axis,
    name: t.name,
    kind: t.kind,
    hold: t.status === 'hold',
    directCheck: t.direct_check,
    researchFlag: RESEARCH_FLAGS[t.id] ?? null,
    coreOf: templates().filter((w) => w.core.includes(t.id)).map((w) => w.id),
  }))
  const nonHold = list.filter((t) => !t.hold)
  return {
    canonVersion: CANON_VERSION,
    v62: V62_CANON_VERSION,
    domains: DOMAINS.map((d) => ({ id: d, name: DOMAIN_NAME[d], question: DOMAIN_QUESTION[d], hold: list.filter((t) => t.domain === d).every((t) => t.hold), tasks: list.filter((t) => t.domain === d).map((t) => t.id) })),
    tasks: list,
    edges: relations().map((r) => ({ id: r.id, type: r.type, from: r.from, to: r.to, approval: r.status })),
    counts: { tasks: list.length, nonHold: nonHold.length, hold: list.length - nonHold.length, atomicNonHold: nonHold.filter((t) => t.kind === 'atomic').length, integratedNonHold: nonHold.filter((t) => t.kind === 'integrated').length },
  }
}

/** 학습자에게 보이는 TASK 근거 상태(v6.2 §5.1) — 퍼센트 · 숙달 막대 없음 */
export type InspectorEvidence = 'unmeasurable' | 'not_measured' | 'checking' | 'need_confirmed' | 'passed_current_policy' | 'recheck_due' | 'axis_observation'

export interface TaskInspectorDTO {
  task: GraphTask
  goal: string
  learnerCriterion: string
  /** 현재와 목표 */
  now: {
    evidence: InspectorEvidence
    /** n — 판정에 쓴 서로 다른 문항의 독립 첫 시도 수(분모). 확인 판정이 없으면 null. 계획 수행량과 다른 수치 */
    observed: { independent: number } | null
    need: Ranks['needRank'][number]['need'] | null
    needRank: number | null
  }
  /** 교재 · 학습 · 계획 — 계획 수행량(done/planned)은 성취와 다른 수치 */
  plan: { stage: string | null; done: number; planned: number | null; workspaces: string[] } | null
  /** 상단 고정 — 다음 한 가지 행동 */
  next: { href: string; label: string } | null
  /** 지금 못 하는 이유(플랫폼 · 단계) — 학생 결손 아님 */
  blocked: Ranks['notActionable'][number]['reason'] | null
  /** 지원 공백(접을 수 있는 보기) */
  coverage: { gaps: GapCode[]; ledgers: TaskCoverage['ledgers'] } | null
  versions: { canon: string; v62: string; asOf: string; mode: V4View['asIs']['mode'] }
}

const EVIDENCE: Record<V4View['asIs']['tasks'][string]['status'], InspectorEvidence> = {
  unmeasurable: 'unmeasurable',
  unmeasured: 'not_measured',
  analysis_pending: 'not_measured',
  insufficient: 'not_measured',
  observed: 'axis_observation',
  check_first: 'axis_observation',
  checking: 'checking',
  verified_need: 'need_confirmed',
  resolved: 'passed_current_policy',
  expired: 'recheck_due',
}

export function taskInspector(id: TaskId, view: V4View, ranks: Ranks, ledger: GoalCoverageLedger | null): TaskInspectorDTO {
  const def = taskOf(id)
  const graph = domainTaskGraph().tasks.find((t) => t.id === id)!
  const a = view.asIs.tasks[id]
  const nr = ranks.needRank.find((e) => e.task === id) ?? null
  const ar = ranks.actionRank.find((e) => e.task === id) ?? null
  const na = ranks.notActionable.find((e) => e.task === id) ?? null
  const p = view.taskPlans.find((x) => x.task === id) ?? null
  const cov = ledger?.tasks.find((t) => t.task === id) ?? null
  // 목표 없는 자율 연습 — 계획의 다음 활동, 없으면 이 TASK 를 중심으로 하는 묶음의 다음 확인 문항(Workspace 가 이미 미노출 규칙을 거쳤다)
  const homeWs = [view.plan.primary, ...view.plan.others].find((w) => w?.core.includes(id)) ?? null
  const free = view.toBe ? null : p?.next ?? homeWs?.next ?? null
  return {
    task: graph,
    goal: def.goal,
    learnerCriterion: def.learner_criterion,
    now: {
      evidence: EVIDENCE[a.status],
      observed: a.check ? { independent: a.check.independentItems } : null,
      need: nr?.need ?? null,
      needRank: nr?.rank ?? null,
    },
    plan: p ? { stage: p.stage, done: p.quantity.done, planned: p.quantity.planned, workspaces: p.workspaces } : null,
    // 목표가 없으면 NeedRank 가 비어도 탐색 · 자율 연습은 된다(§6.1) — 그때는 계획이 고른 다음 활동(단계 · 미노출 규칙을 이미 거친 것)
    next: ar ? { href: ar.href, label: ar.label } : free ? { href: free.href, label: free.label } : null,
    blocked: ar || free ? null : na?.reason ?? (graph.hold ? 'canon_hold' : 'no_next_activity'),
    coverage: cov ? { gaps: cov.gaps, ledgers: cov.ledgers } : null,
    versions: { canon: CANON_VERSION, v62: V62_CANON_VERSION, asOf: view.asIs.asOf, mode: view.asIs.mode },
  }
}
