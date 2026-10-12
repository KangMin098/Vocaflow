// apps/web/src/lib/csat/meaning-support/model.ts
//
// **v3.1 원문 이해 — 순수 함수(클라이언트 · 서버 공용, 파일 · 암호 없음).** (C1 · C2 · 설계 §3)
//   - parseMeaningParams / buildItemUrl — `scene=meaning&meaning=<unit>&depth=brief|why|deep` 를 현재 문항 allowlist 로 검증하고,
//     장면을 오갈 때 기존 맥락(from=map · check · pair · back)을 지킨다. 잘못된 값은 기본 상태로 정규화.
//   - unitsForSentence — 원문 문장 하나를 고르면 그 문장을 포함한 검수 unit(0 · 1 · 여러 개)
//   - anchorsOf / sentencesOf — 같은 근거를 원문 판 · 지도 · 설명이 함께 가리키게
// 자유 선택 문자열 · 개인 초안은 URL 로 보내지 않는다.

import type { MeaningSupportView, MsDepth, MsUnit } from './labels'

export const DEPTHS: MsDepth[] = ['brief', 'why', 'deep']
export const DRAFT_MAX = 600

export interface MeaningParams { unitId: string | null; depth: MsDepth; normalized: boolean }

/** URL 값 → 검증된 선택. unit 은 이 문항의 unit id 집합에 있을 때만, depth 는 셋 중 하나만 */
export function parseMeaningParams(raw: { meaning?: string | null; depth?: string | null }, unitIds: readonly string[], defaultUnitId: string | null): MeaningParams {
  let normalized = false
  let unitId = raw.meaning ?? null
  if (unitId != null && !unitIds.includes(unitId)) { unitId = null; normalized = true }
  let depth = (raw.depth ?? 'brief') as MsDepth
  if (!DEPTHS.includes(depth)) { depth = 'brief'; normalized = true }
  return { unitId: unitId ?? defaultUnitId, depth, normalized }
}

/** 같은 문항 안 장면 이동 주소 — 기존 맥락 키만 보존하고, meaning/depth 는 검증된 값만 싣는다 */
export function buildItemUrl(
  current: URL,
  next: { scene: string; meaning?: string | null; depth?: MsDepth | null },
): string {
  const u = new URL(current.toString())
  const keep = new Set(['from', 'check', 'pair', 'back', 'judgmentView'])
  for (const k of [...u.searchParams.keys()]) if (!keep.has(k)) u.searchParams.delete(k)
  u.searchParams.set('scene', next.scene)
  if (next.meaning) u.searchParams.set('meaning', next.meaning)
  if (next.depth && next.depth !== 'brief') u.searchParams.set('depth', next.depth)
  return `${u.pathname}?${u.searchParams.toString()}${u.hash}`
}

/** 원문 문장 n 을 포함한 검수 unit — 없으면 빈 배열(설명을 만들어 내지 않는다) */
export function unitsForSentence(view: MeaningSupportView, n: number): MsUnit[] {
  return view.units.filter((u) => u.sentences.includes(n))
}

/** unit 이 가리키는 원문 문장(지도 강조용, 1-기반 → 지도는 0-기반으로 바꿔 쓴다) */
export function sentencesOf(view: MeaningSupportView, unitId: string | null): number[] {
  const u = view.units.find((x) => x.id === unitId)
  return u ? [...u.sentences] : []
}

/** 관계 하나가 가리키는 양쪽 unit 의 문장 합집합 */
export function relationSentences(view: MeaningSupportView, relationId: string | null): number[] {
  const r = view.relations.find((x) => x.id === relationId)
  if (!r) return []
  return [...new Set([...r.from, ...r.to].flatMap((id) => sentencesOf(view, id)))].sort((a, b) => a - b)
}

/** 이 unit 과 이어지는 관계(from 또는 to 에 있음) */
export function relationsOfUnit(view: MeaningSupportView, unitId: string | null) {
  return view.relations.filter((r) => unitId && (r.from.includes(unitId) || r.to.includes(unitId)))
}

/** 초안 길이 검사 — 넘으면 잘라내지 않고 오류만 알린다 */
export function draftTooLong(text: string): boolean {
  return [...text].length > DRAFT_MAX
}
