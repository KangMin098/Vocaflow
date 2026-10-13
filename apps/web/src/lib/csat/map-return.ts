// apps/web/src/lib/csat/map-return.ts
//
// **지도 활동 복귀 문맥** (v3 M1 후속) — 지도에서 문항으로 나갈 때 「어디서 무엇을 하다 나갔는지」를 싣고,
// 문항의 「학습 지도로」 가 그 문맥을 홈(/csat)으로 돌려준다. 홈은 그 학습 묶음 · 단계 시트 · 과제 칸을 다시 연다.
//   task = 과제 id(지도의 data-task) · ws = 학습 묶음 id(data-ws, `ws.<slug>`) · step = 단계 키(data-step)
// 받는 쪽은 모두 형식만 검증한다 — 자유 문자열 · 주소를 받지 않는다(열린 리디렉트 방지). 없는 값은 화면이 조용히 무시한다.

import { parseHomeTask } from './home-suggestion'
import type { StepKey } from './map/learner-path'

export interface MapReturnCtx {
  task?: string | null
  ws?: string | null
  step?: StepKey | null
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

/** 검증한 문맥만 남긴다 */
export function parseMapReturn(q: { task?: string; ws?: string; step?: string }): Required<MapReturnCtx> {
  return { task: parseHomeTask(q.task), ws: parseMapWs(q.ws), step: parseMapStep(q.step) }
}

/** 문맥 쿼리 조각(`&task=…&ws=…&step=…`) — 검증을 통과한 값만. 없으면 빈 문자열 */
export function mapReturnQuery(ctx: MapReturnCtx): string {
  const c = parseMapReturn({ task: ctx.task ?? undefined, ws: ctx.ws ?? undefined, step: ctx.step ?? undefined })
  return (['task', 'ws', 'step'] as const).map((k) => (c[k] ? `&${k}=${encodeURIComponent(c[k]!)}` : '')).join('')
}

/**
 * 지도에서 나가는 문항 링크에 `from=map` 과 문맥을 싣는다. 문항 화면(`/csat/item/…`)만 — 연습 · 기록 등 다른 곳은 그대로 둔다.
 * 해시(#principle)는 끝에 유지하고, 이미 있는 같은 키는 덮어쓴다.
 */
export function withMapReturn(href: string, ctx: MapReturnCtx): string {
  if (!href.startsWith('/csat/item/')) return href
  const hashAt = href.indexOf('#')
  const hash = hashAt < 0 ? '' : href.slice(hashAt)
  const u = new URL(hashAt < 0 ? href : href.slice(0, hashAt), 'http://x')
  u.searchParams.set('from', 'map')
  const c = parseMapReturn({ task: ctx.task ?? undefined, ws: ctx.ws ?? undefined, step: ctx.step ?? undefined })
  for (const k of ['task', 'ws', 'step'] as const) {
    if (c[k]) u.searchParams.set(k, c[k]!)
  }
  return `${u.pathname}${u.search}${hash}`
}
