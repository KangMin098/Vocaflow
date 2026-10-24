// apps/web/src/lib/csat/binding/invalidate.ts
// 원문·근거 단위·분석 판본이 바뀌었을 때 그 위에 지은 것(근거 앵커 · 강의 cue · 판단 도구 픽스처)이 아직 유효한가.
//
// 판정은 셋 중 하나다. valid 만 화면에 근거로 보인다. stale 은 숨기고, unverifiable(결속 정보가 아예 없음)은
// 「유효하다」로 세지 않는다 — 결속이 없는 산출물을 통과로 두면 원문이 바뀐 뒤에도 옛 근거가 계속 나온다.
import type { BindingBasis, EvidenceAnchor } from './types'

/** 문항의 지금 판본 — DB 에서 읽은 그대로 */
export type CurrentState = {
  itemId: string
  inputHash: string
  passage: string
  unitsVersion: number | null
  unitsHash: string | null
  /** 지금 근거로 쓰는 분석 판본(현재 단위에 결속된 최신 published). 없으면 null */
  analysisVersion: number | null
}

export type StaleReason = 'item' | 'input_hash' | 'units_version' | 'units_hash' | 'analysis_version' | 'text_mismatch' | 'no_binding'
export type Validity = { status: 'valid' } | { status: 'stale'; reasons: StaleReason[] } | { status: 'unverifiable'; reasons: StaleReason[] }

export function basisDiff(basis: BindingBasis, cur: CurrentState): StaleReason[] {
  const r: StaleReason[] = []
  if (basis.itemId !== cur.itemId) r.push('item')
  if (basis.inputHash !== cur.inputHash) r.push('input_hash')
  if (basis.unitsVersion !== cur.unitsVersion) r.push('units_version')
  if (basis.unitsHash !== cur.unitsHash) r.push('units_hash')
  if (basis.analysisVersion != null && basis.analysisVersion !== cur.analysisVersion) r.push('analysis_version')
  return r
}

/** 앵커 하나 — 판본이 같아도 오프셋이 가리키는 글자가 기록과 다르면 stale(같은 길이로 고친 원문을 잡는다) */
export function anchorValidity(a: EvidenceAnchor, cur: CurrentState): Validity {
  const reasons = basisDiff(a.basis, cur)
  const p = cur.passage
  if (a.kind === 'span' || a.kind === 'condition') {
    if (p.slice(a.start, a.end) !== a.quote) reasons.push('text_mismatch')
  } else if (a.kind === 'marker') {
    if (p.slice(a.at, a.at + a.mark.length) !== a.mark) reasons.push('text_mismatch')
  } else if (a.kind === 'value' && a.span) {
    if (p.slice(a.span.start, a.span.end) !== a.raw) reasons.push('text_mismatch')
  }
  return reasons.length ? { status: 'stale', reasons } : { status: 'valid' }
}

/** 강의 한 편 — schema3 은 binding(analysis_version · units_hash)을 갖는다. 없으면 확인 불가 */
export function lectureValidity(
  lec: { item_id: string; binding?: { analysis_version: number; units_hash: string } | null },
  cur: CurrentState,
): Validity {
  if (lec.item_id !== cur.itemId) return { status: 'stale', reasons: ['item'] }
  if (!lec.binding) return { status: 'unverifiable', reasons: ['no_binding'] }
  const r: StaleReason[] = []
  if (lec.binding.analysis_version !== cur.analysisVersion) r.push('analysis_version')
  if (lec.binding.units_hash !== cur.unitsHash) r.push('units_hash')
  return r.length ? { status: 'stale', reasons: r } : { status: 'valid' }
}

/** 판단 도구(D) 픽스처 한 문항 — ItemVersion(unitsVersion · unitsHash · analysisVersion) 결속 */
export function judgmentItemValidity(
  v: { id: string; version: { unitsVersion: number; unitsHash: string; analysisVersion: number } },
  cur: CurrentState,
): Validity {
  if (v.id !== cur.itemId) return { status: 'stale', reasons: ['item'] }
  const r: StaleReason[] = []
  if (v.version.unitsVersion !== cur.unitsVersion) r.push('units_version')
  if (v.version.unitsHash !== cur.unitsHash) r.push('units_hash')
  if (v.version.analysisVersion !== cur.analysisVersion) r.push('analysis_version')
  return r.length ? { status: 'stale', reasons: r } : { status: 'valid' }
}

/** 앵커 목록을 지금 판본에 대 보고 유효한 것만 남긴다 — 화면은 이 결과만 그린다 */
export function keepValid<T extends EvidenceAnchor>(anchors: T[], cur: CurrentState): { valid: T[]; dropped: { anchor: T; reasons: StaleReason[] }[] } {
  const valid: T[] = []
  const dropped: { anchor: T; reasons: StaleReason[] }[] = []
  for (const a of anchors) {
    const v = anchorValidity(a, cur)
    if (v.status === 'valid') valid.push(a)
    else dropped.push({ anchor: a, reasons: v.reasons })
  }
  return { valid, dropped }
}
