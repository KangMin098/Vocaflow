// apps/web/src/lib/csat/map-return.ts
//
// **지도 활동 복귀 문맥** (v3 M1 후속) — 지도에서 문항으로 나갈 때 「어디서 무엇을 하다 나갔는지」를 싣고,
// 문항의 「학습 지도로」 가 그 문맥을 홈(/csat)으로 돌려준다. 홈은 그 학습 묶음 · 단계 시트 · 과제 칸을 다시 연다.
//   task = 과제 id(지도의 data-task) · ws = 학습 묶음 id(data-ws, `ws.<slug>`) · step = 단계 키(data-step)
//   map_task = 영구 TASK id(v6.2 §9.3 — 활동 id `task` 와 구별 · r.central_meaning 같은 slug). 지도 정의에 없는 id 는 화면이 무시한다
//   map_ws = 학습자 Workspace UUID(템플릿 slug `ws` 와 구별) · map_plan = 떠날 때 계획 버전 · map_goal = 떠날 때 목표 이력 id
//     — 돌아온 화면은 이 값으로 「떠날 때와 지금이 같은가」만 비교한다. 이 값으로 조회하지 않는다(다른 사람 UUID 를 넣어도 읽히는 것이 없다)
// 받는 쪽은 모두 형식만 검증한다 — 자유 문자열 · 주소를 받지 않는다(열린 리디렉트 방지). 없는 값은 화면이 조용히 무시한다.

import { parseHomeTask } from './home-suggestion'
import type { StepKey } from './map/learner-path'

export interface MapReturnCtx {
  task?: string | null
  mapTask?: string | null
  ws?: string | null
  step?: StepKey | null
  mapWs?: string | null
  mapPlan?: string | null
  mapGoal?: string | null
  /** T-0062 — 학습 화면이 서버에서 붙이는 「이번에 연 자료」 id(창작 문항 slug). 지도는 본인 기록 안에서만 대조한다(조회 키 아님) */
  mapItem?: string | null
  /** T-0062 — 이 화면에서 **실제로 제출 · 저장된** 수행 id(서버 응답). 새 답 없는 재열기에는 붙지 않는다 */
  mapAttempt?: string | null
}

const STEPS: readonly StepKey[] = ['vocab', 'sentence', 'relation', 'structure', 'option', 'evidence', 'integrate', 'l-sound', 'l-sentence', 'l-retain', 'l-respond']

/** 학습 묶음 id — `ws.` + 소문자 · 하이픈(40자 이하)만 */
export function parseMapWs(v: string | undefined | null): string | null {
  return v && /^ws\.[a-z][a-z-]{0,39}$/.test(v) ? v : null
}

/** 단계 키 — 지도 단계 열거형만 */
export function parseMapStep(v: string | undefined | null): StepKey | null {
  return v && (STEPS as readonly string[]).includes(v) ? (v as StepKey) : null
}

/** 영구 TASK id — 소문자 slug 점 구분 2~3마디(v.core_meaning · s.o.sentence_meaning_model)만. 존재 여부는 지도 정의가 판단 */
export function parseMapTask(v: string | undefined | null): string | null {
  return v && /^[a-z]{1,2}(\.[a-z_]{1,40}){1,2}$/.test(v) ? v : null
}

/** 학습자 Workspace UUID — 소문자 16진 UUID 만 */
export function parseMapUuid(v: string | undefined | null): string | null {
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null
}

/** 이번에 연 자료 id — 소문자 · 숫자 · 하이픈(61자 이하)만 */
export function parseMapItem(v: string | undefined | null): string | null {
  return v && /^[a-z0-9][a-z0-9-]{1,60}$/.test(v) ? v : null
}
/** 수행 id — 1 이상의 정수(19자리 이하)만 */
export function parseMapAttempt(v: string | undefined | null): string | null {
  return v && /^[1-9][0-9]{0,18}$/.test(v) ? v : null
}
/** 버전 · 이력 id — 1 이상의 정수(9자리 이하)만 */
export function parseMapVersion(v: string | undefined | null): string | null {
  return v && /^[1-9][0-9]{0,8}$/.test(v) ? v : null
}

type ReturnQuery = { task?: string; ws?: string; step?: string; map_task?: string; map_ws?: string; map_plan?: string; map_goal?: string; map_item?: string; map_attempt?: string }

/** 검증한 문맥만 남긴다 */
export function parseMapReturn(q: ReturnQuery): Required<MapReturnCtx> {
  return {
    task: parseHomeTask(q.task),
    mapTask: parseMapTask(q.map_task),
    ws: parseMapWs(q.ws),
    step: parseMapStep(q.step),
    mapWs: parseMapUuid(q.map_ws),
    mapPlan: parseMapVersion(q.map_plan),
    mapGoal: parseMapVersion(q.map_goal),
    mapItem: parseMapItem(q.map_item),
    mapAttempt: parseMapAttempt(q.map_attempt),
  }
}

const KEYS = [['task', 'task'], ['mapTask', 'map_task'], ['ws', 'ws'], ['step', 'step'], ['mapWs', 'map_ws'], ['mapPlan', 'map_plan'], ['mapGoal', 'map_goal'], ['mapItem', 'map_item'], ['mapAttempt', 'map_attempt']] as const
const parseCtx = (ctx: MapReturnCtx) => parseMapReturn({
  task: ctx.task ?? undefined,
  map_task: ctx.mapTask ?? undefined,
  ws: ctx.ws ?? undefined,
  step: ctx.step ?? undefined,
  map_ws: ctx.mapWs ?? undefined,
  map_plan: ctx.mapPlan ?? undefined,
  map_goal: ctx.mapGoal ?? undefined,
  map_item: ctx.mapItem ?? undefined,
  map_attempt: ctx.mapAttempt ?? undefined,
})

/** 주소 검색값(searchParams · 배열 허용)에서 복귀 문맥 쿼리 키만 뽑는다 — 페이지마다 같은 키 목록을 다시 쓰지 않게 */
export function returnQueryOf(sp: Record<string, string | string[] | undefined>): ReturnQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return Object.fromEntries(KEYS.map(([, q]) => [q, one(sp[q])])) as ReturnQuery
}

/** 문맥 쿼리 조각(`&task=…&map_task=…&ws=…&step=…&map_ws=…`) — 검증을 통과한 값만. 없으면 빈 문자열 */
export function mapReturnQuery(ctx: MapReturnCtx): string {
  const c = parseCtx(ctx)
  return KEYS.map(([k, q]) => (c[k] ? `&${q}=${encodeURIComponent(c[k]!)}` : '')).join('')
}

/**
 * 지도에서 나가는 문항 링크에 `from=map` 과 문맥을 싣는다. 문항 화면(`/csat/item/…`)과 받은 창작 자료(`/csat/learn/…` · FI-011 C)만 — 연습 · 기록 등 다른 곳은 그대로 둔다.
 * 해시(#principle)는 끝에 유지하고, 이미 있는 같은 키는 덮어쓴다.
 */
export function withMapReturn(href: string, ctx: MapReturnCtx): string {
  if (!href.startsWith('/csat/item/') && !href.startsWith('/csat/learn/')) return href
  const hashAt = href.indexOf('#')
  const hash = hashAt < 0 ? '' : href.slice(hashAt)
  const u = new URL(hashAt < 0 ? href : href.slice(0, hashAt), 'http://x')
  u.searchParams.set('from', 'map')
  const c = parseCtx(ctx)
  for (const [k, q] of KEYS) {
    if (c[k]) u.searchParams.set(q, c[k]!)
  }
  return `${u.pathname}${u.search}${hash}`
}
