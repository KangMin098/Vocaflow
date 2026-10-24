// apps/web/src/lib/csat/binding/types.ts
// 기출 원문·근거·선지 결속(대량작업 G)의 공통 계약.
//
// 근거 앵커 하나는 「어느 원문 판본의 어디」를 가리킨다. 판본(basis)이 바뀌면 앵커는 자동으로 무효다 —
// [u3] 이 다른 문장을 가리키거나 오프셋이 다른 글자를 가리키는 순간 틀린 근거가 되므로, 그때는 근거를 보이지 않는다.
// precision 은 화면이 「정확한 근거」와 「추정」을 구분해 말하게 하는 값이다. estimated·candidate 를 exact 처럼 보이면 안 된다.

/** 앵커가 만들어진 원문·분석 판본. DB 값을 그대로 옮긴다(이 계층은 해시를 새로 만들지 않는다) */
export type BindingBasis = {
  itemId: string
  /** csat_item_input_hash(item) — 원문(+현재 도표 이미지) 해시 */
  inputHash: string
  /** 현재 근거 단위 판본. 단위가 없는 문항은 null */
  unitsVersion: number | null
  unitsHash: string | null
  /** 앵커를 낸 분석 판본. 분석과 무관한 앵커(원문 구조에서 읽은 것)는 null */
  analysisVersion: number | null
}

/**
 * exact      원문 글자 범위가 확정됐다(오프셋 + 글자 일치)
 * unit       근거 단위(문장·목록 한 줄) 단위까지만 확정됐다
 * marker     ①–⑤ 표지 위치만 확정됐다 — 밑줄의 끝은 평문에 없다(어법·어휘)
 * candidate  낱말 겹침 같은 기계 추정. 근거로 단정하지 않는다
 * unavailable 원문에 없다(그림에만 있는 수치 · 빠진 각주)
 */
export type AnchorPrecision = 'exact' | 'unit' | 'marker' | 'candidate' | 'unavailable'

type AnchorBase = { basis: BindingBasis; precision: AnchorPrecision }

/** 원문 글자 범위 [start, end) — passage 기준 */
export type SpanAnchor = AnchorBase & { kind: 'span'; start: number; end: number; quote: string }
/** 근거 단위 하나 */
export type UnitAnchor = AnchorBase & { kind: 'unit'; unitId: string; n: number }
/** 지문 속 ①–⑤ 표지와 그 뒤 첫 낱말들(밑줄 시작) */
export type MarkerAnchor = AnchorBase & { kind: 'marker'; choice: number; at: number; head: string; /** 표지 글자(① 또는 (a)) */ mark: string }
/** 선지 하나 */
export type ChoiceAnchor = AnchorBase & { kind: 'choice'; choice: number }
/** 도표·안내문의 수치 — 값이 원문 글자에 있으면 span 도 함께 */
export type ValueAnchor = AnchorBase & {
  kind: 'value'
  value: number
  unit: ValueUnit
  raw: string
  span?: { start: number; end: number }
  /** 원문 글자에 없고 그림에만 있는 값 — precision 은 언제나 unavailable */
  imageOnly: boolean
}
/** 안내문의 조건·한정(only · except · must · 요일 · 시간대 · 연령) */
export type ConditionAnchor = AnchorBase & { kind: 'condition'; cue: ConditionCue; start: number; end: number; quote: string }
/** 각주 — 표지(*)와 정의. 정의가 빠졌으면 precision unavailable */
export type FootnoteAnchor = AnchorBase & { kind: 'footnote'; mark: string; term: string | null; gloss: string | null; at: number }

export type EvidenceAnchor = SpanAnchor | UnitAnchor | MarkerAnchor | ChoiceAnchor | ValueAnchor | ConditionAnchor | FootnoteAnchor

export type ValueUnit = 'percent' | 'percentage_point' | 'times' | 'currency' | 'count' | 'year' | 'time' | 'age' | 'ordinal' | 'none'
export type ConditionCue = 'only' | 'except' | 'must' | 'not' | 'deadline' | 'weekday' | 'time_range' | 'age' | 'fee' | 'limit' | 'footnote'

/** 추출본 결함 — 원문이 틀린 것이 아니라 PDF → 글자 변환에서 생긴 것 */
export type ExtractionDefect =
  | { code: 'choice_page_number'; choice: number; raw: string }
  | { code: 'choice_footnote_merged'; choice: number; raw: string }
  | { code: 'choice_overrun'; choice: number; chars: number }
  | { code: 'choice_paren_residue'; choice: number }
  | { code: 'footnote_mark_without_gloss'; mark: string; at: number; context: string }
  | { code: 'orphan_fragment'; at: number; text: string }
  | { code: 'marker_missing'; choice: number }
  | { code: 'marker_duplicate'; choice: number; count: number }
  | { code: 'marker_order'; order: number[] }
  | { code: 'choice_count'; count: number }

/** 정답 집합 — csat_items.answers 가 정본. answer(단일)와 어긋나면 그 자체가 결함이다 */
export type AnswerSet = { answers: number[]; multiple: boolean; legacyMismatch: boolean }

/** 공개 분석이 정답 집합을 얼마나 다루는가 */
export type AnswerCoverage =
  | { status: 'covered' }
  | { status: 'partial'; missing: number[]; extra: number[] }
  | { status: 'no_analysis' }

/** 문항이 근거 결속을 쓸 수 없는 이유 — 화면·리포트가 같은 코드를 쓴다 */
export type BlockReason =
  | 'body_not_ok'
  | 'no_type'
  | 'no_current_units'
  | 'no_published_analysis'
  | 'analysis_unbound'
  | 'analysis_stale'
  | 'answer_legacy_mismatch'
  | 'multi_answer_partial_analysis'
  | 'multi_answer_unsupported_by_tool'
  | 'extraction_defect'
  | 'footnote_missing'
  | 'chart_value_unverified'
  | 'analysis_ref_unknown_unit'
  | 'analysis_quote_not_in_source'
  | 'marker_anchor_unavailable'
  | 'no_pdf_anchor'

/** 차단 이유의 무게 — block 은 그 유형 도구에 넘기지 않는다, warn 은 넘기되 화면이 한계를 말한다 */
export const BLOCK_SEVERITY: Record<BlockReason, 'block' | 'warn'> = {
  body_not_ok: 'block',
  no_type: 'block',
  no_current_units: 'block',
  no_published_analysis: 'block',
  analysis_unbound: 'block',
  analysis_stale: 'block',
  answer_legacy_mismatch: 'warn',
  multi_answer_partial_analysis: 'block',
  multi_answer_unsupported_by_tool: 'block',
  extraction_defect: 'warn',
  footnote_missing: 'block',
  chart_value_unverified: 'block',
  analysis_ref_unknown_unit: 'block',
  analysis_quote_not_in_source: 'warn',
  marker_anchor_unavailable: 'block',
  no_pdf_anchor: 'warn',
}
