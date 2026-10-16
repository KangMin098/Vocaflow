// apps/web/src/lib/csat/map/v4/compose.ts
//
// 화면 데이터(MapPageData) → As-Is · To-Be · Workspace 한 번에. 서버 · 화면 · 테스트가 같은 함수를 쓴다(판정은 한 곳).
// 축 proxy 는 기존 learnerPath(단계 근거 상태)를 축 단위로 옮긴 것뿐 — 새 판정이 아니다. 순수 함수(시각은 asOf 주입).

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { learnerPath, type StepEvidence } from '../learner-path'
import type { MapPageData } from '../load'

import { asIsMap, ms, type AsIsMap, type AxisProxyState } from './as-is'
import { DOMAINS, checkKeysOfTask, templateOf, type Domain, type TaskId } from './definition'
import { evidenceView, type EvidenceView } from '../v62/evidence-claims'
import { toBeMap, type ConfirmLink, type ToBeGoal, type ToBeMap } from './to-be'
import { planWorkspaces, type WorkspacePlan } from './workspace'
import { transferPolicy } from './plan-commit'
import { allTaskPlans, transferDoneOf, transferPlanned, workspacePlan, type PlanActivity, type TaskPlan, type WorkspacePlanView } from './plan'

const STEP_TO_PROXY: Record<StepEvidence, AxisProxyState> = {
  none: 'none',
  pending: 'pending',
  more: 'insufficient',
  observed: 'observed',
  focus: 'check_first',
  // verified 는 지금 만드는 경로가 없다(CURRENT_BASIS = rule_proxy). 생겨도 축 proxy 는 TASK 확정 근거가 아니므로 관찰로만 옮긴다
  verified: 'observed',
}
// 축 안에서 더 「먼저 확인」에 가까운 단계 상태를 축 상태로
const PROXY_RANK: Record<AxisProxyState, number> = { check_first: 4, observed: 3, insufficient: 2, pending: 1, none: 0 }

export function axisProxyOf(data: Pick<MapPageData, 'model' | 'settings'>): NonNullable<Parameters<typeof asIsMap>[0]['axisProxy']> {
  const path = learnerPath(data.model, data.settings)
  const state = Object.fromEntries(DOMAINS.map((d) => [d, 'none'])) as Record<Domain, AxisProxyState>
  const contributions = Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Record<Domain, number>
  for (const s of [...path.read, ...path.listen]) {
    const d = s.axis as Domain
    const p = STEP_TO_PROXY[s.evidence]
    if (PROXY_RANK[p] > PROXY_RANK[state[d]]) state[d] = p
    contributions[d] = Math.max(contributions[d], s.axisView.contributions)
  }
  return { state, contributions }
}

/** 확인 과제 키 → 실행 가능한 확인 문항 링크(지도 FIND 연결의 confirm — 보류 문항은 load 에서 이미 빠졌다) */
export function confirmLinksOf(data: Pick<MapPageData, 'practiceLinks'>): Record<string, ConfirmLink[]> {
  const out: Record<string, ConfirmLink[]> = {}
  for (const l of Object.values(data.practiceLinks ?? {})) for (const c of l.confirm) {
    const list = (out[c.taskKey] ??= [])
    if (!list.some((x) => x.target === c.target)) list.push({ target: c.target, href: c.href, label: c.label })
  }
  return out
}

/** 전이 기록이 있는 확인 과제 키 — 생애주기 수행 기록의 phase=transfer(`<키>-skeleton` 은 그 키로) */
export function transferredKeysOf(data: Pick<MapPageData, 'lifecycleActivity'>): string[] {
  return [...new Set((data.lifecycleActivity ?? []).filter((a) => a.phase === 'transfer').map((a) => a.taskKey.replace(/-skeleton$/, '')))]
}

/**
 * 「지금」 분석의 기준 시각 — 서버 시각과 가장 늦은 기록 입력 · 시도 시각 중 늦은 것.
 * 기록의 created_at 은 DB 시계, now 는 앱 서버 시계라 둘이 어긋나면 방금 넣은 기록이 「기준 뒤」로 빠져
 * 지금 화면이 과거 재분석처럼 보였다(2차 E2E). 지금 분석에는 모든 기록이 들어가야 한다 — 과거 기준(?asof=)만 엄격하게 거른다.
 */
export function currentAsOf(now: string, sessions: readonly { enteredAt: string; takenAt: string }[], attempts: readonly { answeredAt?: string | null }[]): string {
  let t = ms(now)
  for (const s of sessions) t = Math.max(t, ms(s.enteredAt) === Number.POSITIVE_INFINITY ? t : ms(s.enteredAt), ms(s.takenAt) === Number.POSITIVE_INFINITY ? t : ms(s.takenAt))
  for (const a of attempts) if (a.answeredAt && Number.isFinite(ms(a.answeredAt))) t = Math.max(t, ms(a.answeredAt))
  return new Date(t).toISOString()
}

/**
 * 과거 기준 분석 주소값(?asof=YYYY-MM-DD) → 그날 끝(KST)의 ISO 시각. 형식이 틀리거나 지금보다 뒤면 undefined(지금 분석).
 * 화면은 이 값이 있으면 「다시 분석한 것 · 정확한 재현 아님」을 표시한다(as-is limits).
 */
export function parseAsOf(v: string | undefined, now: string): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const end = new Date(`${v}T23:59:59.999+09:00`)
  if (Number.isNaN(end.getTime())) return undefined
  const iso = end.toISOString()
  return iso < now ? iso : undefined
}

export interface V4View {
  asIs: AsIsMap
  toBe: ToBeMap | null
  plan: WorkspacePlan
  /** Workspace id → TASK 별 학습계획(대표 · 다른 후보) */
  plans: Record<string, WorkspacePlanView>
  /** 모든 비보류 TASK 계획 — 지도의 TASK → 연관 Workspace 찾기 */
  taskPlans: TaskPlan[]
  /** LM-G1.4 — TASK 별 증거 자격 · 주장 범위(직접 확인 키가 있는 TASK 만 · 기존 판정 결과 조합). 화면 팝업 · 드로어 · Workspace 모달이 같은 값을 읽는다 */
  evidence?: Partial<Record<TaskId, EvidenceView>>
}

/**
 * asOf 기본값은 서버가 계산한 시각(data.now). 목표가 정해지지 않았으면 goal.set=false → To-Be 없음.
 * findAttempts 를 못 읽었으면(undefined) 직접 확인 판정을 하지 않는다 — 빈 배열로 바꾸면 이미 확인한 학습자에게 「확인 전」을 보인다.
 */
/**
 * LM-G1.2 — 저장된 최신 계획에서 「적용」 단계로 저장된 TASK 의 계획량(학습자 조정 · 운영량). 정상 미설치/미저장은 비어 있다(정본 2지문). 조회 실패는 기본값으로 대체하지 않는다.
 * 계획량은 단계 운영만 바꾼다 — 성취 · 직접 확인 판정은 읽지도 바꾸지도 않는다.
 */
export function savedTransferOf(data: Pick<MapPageData, 'v4'>): Partial<Record<string, number>> {
  const s = data.v4?.saved
  if (s?.error) throw new Error('Saved PLAN policy is unavailable')
  if (!s || s.status !== 'installed') return {}
  const out: Partial<Record<string, number>> = {}
  for (const w of Object.values(s.byTemplate)) {
    const core = new Set<string>(templateOf(w.template)?.core ?? [])
    const policy = w.transferPlanned ?? transferPolicy(w.template, [...w.history.filter(h => h.version !== w.latest.version), w.latest])
    for (const [task, amount] of Object.entries(policy)) if (core.has(task)) out[task] = amount
  }
  return out
}

export function composeV4(data: MapPageData, goal: ToBeGoal, asOf?: string): V4View | null {
  if (!data.v4 || !data.now) return null
  const confirmLinks = confirmLinksOf(data)
  const attempts: FindAttemptRow[] = data.findAttempts ?? []
  const at = asOf ?? currentAsOf(data.now, data.v4.sessions, attempts)
  const checks = data.findAttempts
    ? Object.entries(confirmLinks).map(([taskKey, links]) => ({ taskKey, items: links.map((l) => l.target) }))
    : []
  const asIs = asIsMap({ asOf: at, sessions: data.v4.sessions, axisProxy: { ...axisProxyOf(data), covers: data.v4.proxyCovers }, checks, attempts })
  const toBe = toBeMap({ asIs, goal, refItems: data.v4.refItems, lineRefItems: data.model.lineRefItems, confirmLinks, transferredKeys: transferredKeysOf(data) })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks, transferItems: data.v4.transferItems, transferTargets: data.v4.transferTargets })
  // 수행 기록 — 생애주기 기록(지도 연결 과제 키의 본인 시도). 시각 없는 기록 · 기준 시점 뒤 기록은 세지 않는다(As-Is 와 같은 자격 · 리뷰 P1)
  const cut = ms(at)
  const activity: PlanActivity[] = (data.lifecycleActivity ?? []).filter((a) => !!a.answeredAt && ms(a.answeredAt) <= cut)
  const opts = { savedTransfer: savedTransferOf(data) }
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, { ...workspacePlan(w, asIs, toBe, plan, activity, opts), restoreTransfer: data.v4?.saved.byTemplate[w.id]?.transferPolicies }]))
  // LM-G1.4 — 직접 확인 키가 있는 TASK 의 증거 자격 · 주장 범위(기존 판정 결과만 조합 · 같은 기준 시점 · 같은 수행 기록)
  const views = [plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w)
  const evidence: Partial<Record<TaskId, EvidenceView>> = {}
  for (const id of Object.keys(asIs.tasks) as TaskId[]) {
    if (checkKeysOfTask(id).length === 0) continue
    const t = asIs.tasks[id]
    const home = views.find((w) => w.core.includes(id)) ?? null
    const firsts = data.findAttempts ? data.findAttempts.filter((f) => !f.answeredAt || ms(f.answeredAt) <= cut) : undefined
    evidence[id] = evidenceView({ task: id, check: t.check, firsts, activity: data.lifecycleActivity ? activity.map((a) => ({ ...a, isCorrect: a.isCorrect ?? null })) : undefined, hashes: data.instrumentHashes, transfer: { done: t.check?.verifiedAt ? transferDoneOf(id, t.check.verifiedAt, activity) : 0, planned: transferPlanned(t, home, opts) } })
  }
  return { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, activity, opts), evidence }
}
