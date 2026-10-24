// apps/web/src/lib/csat/bridge/round-trip.ts
//
// H6 — 지도/Workspace ↔ 기출 문항 왕복 문맥(순수). 기존 복귀 문맥(map-return · v62/return-ctx)을 그대로 쓰고,
//   기출분석에만 필요한 두 값 — 떠날 때의 분석 판본(map_av)과 복귀 위치(단계 step) — 을 더한다.
//   돌아오면 옛 판본 · 옛 Workspace 를 되살리지 않는다: 지금 최신을 보이고 달라진 사실만 알린다.
//   모든 값은 형식만 검증한다(조회 키 아님 · 열린 리디렉트 없음).

import { toItemSlug } from '../item-slug'
import { mapReturnQuery, parseMapReturn, returnQueryOf, withMapReturn, type MapReturnCtx } from '../map-return'
import { returnNotes, type ReturnNote } from '../map/v62/return-ctx'
import type { SavedPlans } from '../map/v4/plan-store'

export interface BridgeCtx extends MapReturnCtx {
  /** 떠날 때 본 분석 판본(1 이상 정수 문자열) */
  analysisVersion?: string | null
}

const parseAv = (v: string | undefined | null): string | null => (v && /^[1-9][0-9]{0,8}$/.test(v) ? v : null)

/** 문항 id(`2026-34` · `2026#34`) → 지도 문맥을 실은 문항 주소 */
export function bridgeItemHref(itemRef: string, ctx: BridgeCtx): string {
  const href = withMapReturn(`/csat/item/${toItemSlug(itemRef)}`, ctx)
  const av = parseAv(ctx.analysisVersion)
  return av ? `${href}${href.includes('?') ? '&' : '?'}map_av=${av}` : href
}

/** 문항 화면의 「학습지도로」 복귀 주소 — 받은 문맥 그대로(검증값만) */
export function bridgeReturnHref(sp: Record<string, string | string[] | undefined>): string {
  const q = mapReturnQuery(parseMapReturn(returnQueryOf(sp)))
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const av = parseAv(one(sp.map_av))
  const tail = `${q}${av ? `&map_av=${av}` : ''}`
  return tail ? `/csat?from=item${tail}` : '/csat'
}

/** 받은 주소 검색값 → 검증된 왕복 문맥 */
export function parseBridgeCtx(sp: Record<string, string | string[] | undefined>): BridgeCtx {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return { ...parseMapReturn(returnQueryOf(sp)), analysisVersion: parseAv(one(sp.map_av)) }
}

export type BridgeNote = ReturnNote | { kind: 'analysis_changed'; from: number; to: number }

/** 돌아왔을 때 — 계획 · Workspace · 목표 변화(기존 판정) + 분석 판본 변화. 지금 판본을 모르면 판본 비교는 하지 않는다 */
export function bridgeReturnNotes(saved: SavedPlans | null | undefined, ctx: BridgeCtx | null, currentAnalysisVersion: number | null): BridgeNote[] {
  const notes: BridgeNote[] = returnNotes(saved, ctx)
  const av = ctx?.analysisVersion ? Number(ctx.analysisVersion) : null
  if (av !== null && currentAnalysisVersion !== null && av !== currentAnalysisVersion) notes.push({ kind: 'analysis_changed', from: av, to: currentAnalysisVersion })
  return notes
}

export const ANALYSIS_CHANGED_LABEL = '떠난 뒤 이 문항의 분석이 고쳐졌어요. 지금 판본을 보여 드려요 — 이전 판본에서 한 수행은 그대로 남아 있어요.'
