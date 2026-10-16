// apps/web/src/lib/csat/map/v62/factory-bridge/material-unit.ts
//
// I0-2 — MaterialUnitProjection(순수). 수요 단위(지금은 「문항」)와 자료 · 생산 단위(문항 · 활동 · 분석 설명 · 지문 · cell · unit · volume)를 섞지 않는다.
// 변환은 **근거가 있는 쌍만** 한다(같은 단위 = 항등). 문항 2개를 지문 2편으로, 해설 1개를 연습 1문항으로 바꾸지 않는다.
// 근거가 없으면 UNKNOWN_UNIT, 원리상 바꿀 수 없으면 NOT_CONVERTIBLE 로 막는다. 영속 수요 v2 · B SQL 의 수량 구조는 바꾸지 않는다.

export type MaterialUnit = 'item' | 'activity' | 'analysis_explanation' | 'passage' | 'cell' | 'unit' | 'volume'

/** 수요 단위(WorkspaceDemand.quantity.unit) → 자료 단위. 지금 수요는 「문항」 하나뿐 */
export const DEMAND_UNIT: Readonly<Record<string, MaterialUnit>> = { 문항: 'item' }

export type ConversionStatus = 'IDENTITY' | 'CONVERTED' | 'UNKNOWN_UNIT' | 'NOT_CONVERTIBLE'

/**
 * 근거가 있는 변환만 둔다. 지금 저장소에는 검증된 단위 간 환산 근거가 없다 — 그래서 비어 있다.
 * (공장 cell 이 문항 몇 개를 담는지는 주문마다 다르고, 공장 계약이 정본을 돌려주기 전까지 짐작하지 않는다)
 */
export interface ConversionRule { from: MaterialUnit; to: MaterialUnit; factor: number; evidenceId: string }
export const CONVERSION_RULES: readonly ConversionRule[] = []

/** 원리상 같은 것으로 셀 수 없는 쌍(근거가 생겨도 수량 환산으로 바꾸지 않는다) */
const NEVER: ReadonlyArray<readonly [MaterialUnit, MaterialUnit]> = [
  ['item', 'passage'], ['passage', 'item'],
  ['analysis_explanation', 'item'], ['item', 'analysis_explanation'],
  ['analysis_explanation', 'activity'],
]

export interface MaterialUnitProjection {
  demandUnit: string
  materialUnit: MaterialUnit | null
  productionUnit: MaterialUnit
  countingBasis: 'distinct_item' | 'distinct_passage' | 'distinct_activity' | 'unknown'
  requested: number
  /** 자료 단위로 센 적격 수(이미 자료 단위) */
  eligible: number
  /** 요청 대비 부족(자료 단위) — 변환이 막히면 requested 전부를 부족으로 남기고 생산 단위 수량은 null */
  shortfall: number
  /** 부족을 생산 단위로 바꾼 수 — 변환 근거가 없으면 null(짐작하지 않는다) */
  productionQuantity: number | null
  conversion: { status: ConversionStatus; evidenceId: string | null; why: string }
}

const BASIS: Record<MaterialUnit, MaterialUnitProjection['countingBasis']> = {
  item: 'distinct_item', passage: 'distinct_passage', activity: 'distinct_activity', analysis_explanation: 'distinct_activity', cell: 'unknown', unit: 'unknown', volume: 'unknown',
}

export function projectUnits(input: { demandUnit: string; requested: number; eligible: number; productionUnit: MaterialUnit; rules?: readonly ConversionRule[] }): MaterialUnitProjection {
  const material = DEMAND_UNIT[input.demandUnit] ?? null
  const requested = Math.max(0, Math.floor(input.requested))
  const eligible = Math.max(0, Math.floor(input.eligible))
  const shortfall = Math.max(0, requested - eligible)
  const base = { demandUnit: input.demandUnit, materialUnit: material, productionUnit: input.productionUnit, requested, eligible, shortfall }
  if (!material) return { ...base, countingBasis: 'unknown', productionQuantity: null, conversion: { status: 'UNKNOWN_UNIT', evidenceId: null, why: 'demand_unit_unknown' } }
  const basis = BASIS[material]
  if (material === input.productionUnit) return { ...base, countingBasis: basis, productionQuantity: shortfall, conversion: { status: 'IDENTITY', evidenceId: null, why: 'same_unit' } }
  if (NEVER.some(([a, b]) => a === material && b === input.productionUnit)) return { ...base, countingBasis: basis, productionQuantity: null, conversion: { status: 'NOT_CONVERTIBLE', evidenceId: null, why: `${material}_is_not_${input.productionUnit}` } }
  const rule = (input.rules ?? CONVERSION_RULES).find((r) => r.from === material && r.to === input.productionUnit && r.factor > 0 && !!r.evidenceId)
  if (!rule) return { ...base, countingBasis: basis, productionQuantity: null, conversion: { status: 'UNKNOWN_UNIT', evidenceId: null, why: 'no_conversion_evidence' } }
  // 생산 단위는 부족분을 덮도록 올림(근거 있는 환산만)
  return { ...base, countingBasis: basis, productionQuantity: Math.ceil(shortfall / rule.factor), conversion: { status: 'CONVERTED', evidenceId: rule.evidenceId, why: 'evidence_rule' } }
}
