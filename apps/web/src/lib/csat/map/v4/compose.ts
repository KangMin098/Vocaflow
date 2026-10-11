// apps/web/src/lib/csat/map/v4/compose.ts
//
// 화면 데이터(MapPageData) → As-Is · To-Be · Workspace 한 번에. 서버 · 화면 · 테스트가 같은 함수를 쓴다(판정은 한 곳).
// 축 proxy 는 기존 learnerPath(단계 근거 상태)를 축 단위로 옮긴 것뿐 — 새 판정이 아니다. 순수 함수(시각은 asOf 주입).

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { learnerPath, type StepEvidence } from '../learner-path'
import type { MapPageData } from '../load'

import { asIsMap, ms, type AsIsMap, type AxisProxyState } from './as-is'
import { DOMAINS, type Domain } from './definition'
import { toBeMap, type ConfirmLink, type ToBeGoal, type ToBeMap } from './to-be'
import { planWorkspaces, type WorkspacePlan } from './workspace'

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
}

/**
 * asOf 기본값은 서버가 계산한 시각(data.now). 목표가 정해지지 않았으면 goal.set=false → To-Be 없음.
 * findAttempts 를 못 읽었으면(undefined) 직접 확인 판정을 하지 않는다 — 빈 배열로 바꾸면 이미 확인한 학습자에게 「확인 전」을 보인다.
 */
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
  const plan = planWorkspaces({ asIs, toBe, confirmLinks, transferItems: data.v4.transferItems })
  return { asIs, toBe, plan }
}
