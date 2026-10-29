// apps/web/src/lib/csat/judgment/pilot.ts
//
// 판단 도구 노출 범위 판정 하나 — 첫 응답(bound-item loader) · 해설 요청(judgment route) · 화면(TypeJudgment)이 같은 판정을 쓴다.
// 'first' 유형(R-IRRELEVANT)은 기존대로 그 유형 전체. 그 밖의 유형은 **파일럿 한 문항 · 한 판본**에만 연다(U02-ORDER-PILOT-01).
// R-ORDER 를 전역 유형 집합이나 'first' 단계에 넣지 않는다 — 다른 R-ORDER 문항 · 다른 판본은 기존처럼 닫힌다.
// 정본: U02_ORDER_PILOT_SCOPE_20261029.md(sha 962a743a…) · 적격 검증 mc-u02-order-prep-2.json(main f0f2df49b 실 입력).
// 클라이언트 · 서버 공용(정답 · 분석 없이 식별자 · 해시만 담는다).

/** 'first' 단계로 연결된 유형 — 문항 전체에 연다 */
export const FIRST_JUDGMENT_TYPES: ReadonlySet<string> = new Set(['R-IRRELEVANT'])

export interface JudgmentPilot {
  itemId: string
  typeId: string
  /** 원문 · 선지 입력 해시(csat_item_input_hash) */
  inputHash: string
  unitsVersion: number
  unitsHash: string
  analysisVersion: number
}

/** 파일럿 — 이 문항의 이 판본만. 판본 · 단위 · 원문이 바뀌면 도구는 닫히고 다시 적격 검증을 거쳐야 한다 */
export const JUDGMENT_PILOTS: readonly JudgmentPilot[] = [
  {
    itemId: 'H2609G2#36',
    typeId: 'R-ORDER',
    inputHash: 'f41392e3b47746fe9b6ca7b6ab139e2b95f1384575a8aaf306c21edb5d575019',
    unitsVersion: 1,
    unitsHash: '138a1c06dad25b467641b80a2dfaaa62f040be95f4bd08abf70ad39595b54a28',
    analysisVersion: 1,
  },
]

function pilotOf(itemId: string, typeId: string): JudgmentPilot | null {
  return JUDGMENT_PILOTS.find((p) => p.itemId === itemId && p.typeId === typeId) ?? null
}

/** 결속을 읽기 전 1차 판정 — 이 문항 · 유형에 도구를 붙일 수 있는가(판본 확인은 judgmentBindingInScope) */
export function judgmentToolInScope(typeId: string | null | undefined, itemId: string | null | undefined): boolean {
  if (!typeId || !itemId) return false
  if (FIRST_JUDGMENT_TYPES.has(typeId)) return true
  return pilotOf(itemId, typeId) != null
}

export interface BindingVersion {
  unitsVersion: number
  unitsHash: string
  analysisVersion: number
}

/**
 * 결속 뒤 판정 — 'first' 유형은 늘 참(기존 결속 규칙만). 파일럿 유형은 이 문항의 고정 판본과 정확히 같을 때만.
 * inputHash 는 서버(loader)만 안다 — 화면은 null 을 넘겨 판본 세 값만 본다(서버가 이미 원문 해시까지 맞춘 문항만 보낸다).
 */
export function judgmentBindingInScope(
  item: { id: string; typeId: string; version: BindingVersion },
  inputHash: string | null,
): boolean {
  if (FIRST_JUDGMENT_TYPES.has(item.typeId)) return true
  const p = pilotOf(item.id, item.typeId)
  if (!p) return false
  if (inputHash !== null && inputHash !== p.inputHash) return false
  return item.version.unitsVersion === p.unitsVersion && item.version.unitsHash === p.unitsHash && item.version.analysisVersion === p.analysisVersion
}
