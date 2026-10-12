// apps/web/src/lib/csat/meaning-support/labels.ts
//
// **v3.1 원문 이해 교수 sidecar — 타입 · 라벨(클라이언트 안전).** 데이터 본체는 서버만 읽는다(`data.ts`).
// 계약: docs/csat-learner/v31/MEANING_SUPPORT_DESIGN.md §5 · scripts/csat/lib-meaning-support.mjs(검증 · 해시 정본).

export type MsDepth = 'brief' | 'why' | 'deep'
export type MsFacet = 'agent' | 'polarity' | 'condition' | 'quantity' | 'modality' | 'time' | 'reference' | 'causality' | 'comparison'
export type MsBasis = 'source_observation' | 'bridging_inference' | 'explanatory_elaboration'
export type MsRelationKind = 'add' | 'example' | 'contrast' | 'concession' | 'cause' | 'condition' | 'reference' | 'temporal' | 'purpose' | 'other'
export type MsGenre = 'argument' | 'expository' | 'narrative' | 'practical' | 'visual'

export interface MsAnchor {
  id: string
  sentence: number
  quote?: string
  occurrence?: number
  sourceRange?: { start: number; end: number; spanHash: string }
  mode: 'original'
}
export interface MsProposition { id: string; textKo: string; basis: MsBasis; anchorIds: string[]; warrantsKo: string[]; limitKo: string }
export interface MsUnit {
  id: string
  sentences: number[]
  legacyMeaningIds: string[]
  labelKo: string
  exactKo: string
  simpleKo: string
  propositionIds: string[]
  preserves: { facet: MsFacet; valueKo: string; anchorIds: string[]; explanationKo: string }[]
  syntax?: {
    parts: { id: string; role: 'main' | 'modifier' | 'clause' | 'connector'; anchorIds: string[]; meaningKo: string }[]
    attachments: { fromPart: string; toPart: string; whyKo: string }[]
    recombinedKo: string
    originalIssueKo?: string
    correction?: { form: string; explanationKo: string }
  }
  misunderstanding?: { alteredKo: string; lostFacet: MsFacet; whyWrongKo: string; anchorIds: string[] }
}
export interface MsRelation {
  id: string
  from: string[]
  to: string[]
  kind: MsRelationKind
  beforeKo: string
  afterKo: string
  changeKo: string
  propositionIds: string[]
  anchorIds: string[]
  basis: MsBasis
  warrantsKo: string[]
  limitKo: string
}
/** 화면으로 보내는 한 문항의 교수 설명(서버 projection) — 원문 본문 · 결속 해시 · 검수 메타는 없다 */
export interface MeaningSupportView {
  itemId: string
  defaultUnitId: string
  anchors: MsAnchor[]
  propositions: MsProposition[]
  units: MsUnit[]
  relations: MsRelation[]
  whole: { genre: MsGenre; summaryKo: string; propositionIds: string[]; relationIds: string[]; limitsKo: string[] }
  bridges: { unitId: string; meaningIds: string[]; choiceNumbers: number[]; designClaimIndices: number[] }[]
  /** 부분 공개(도표 등) — 공개하지 않은 범위와 이유 */
  partial?: { scope: string[]; withheldKo: string } | null
}
/** 콘텐츠 상태 — ready 만 새 판을 쓰고 나머지는 기존 V3Meaning 으로 돌아간다 */
export type MsContentState = 'missing' | 'stale' | 'ready' | 'withheld'

export const DEPTH_LABEL: Record<MsDepth, string> = { brief: '핵심만', why: '왜 그런가', deep: '깊이 탐구' }
export const FACET_LABEL: Record<MsFacet, string> = {
  agent: '주체', polarity: '부정 · 긍정', condition: '조건', quantity: '수량 · 범위', modality: '가능성 · 강도',
  time: '시간', reference: '지시', causality: '인과', comparison: '비교',
}
export const BASIS_LABEL_MS: Record<MsBasis, string> = {
  source_observation: '원문에 쓰인 것',
  bridging_inference: '연결하려고 한 추론',
  explanatory_elaboration: '이해를 돕는 풀이',
}
export const RELATION_KIND_LABEL: Record<MsRelationKind, string> = {
  add: '덧붙임', example: '예시', contrast: '대조', concession: '인정한 뒤 유지', cause: '원인 → 결과', condition: '조건',
  reference: '지시 · 받기', temporal: '시간 흐름', purpose: '목적', other: '그 밖의 연결',
}
export const WHOLE_TITLE: Record<MsGenre, string> = {
  argument: '전체의 생각', expository: '전체의 설명', narrative: '사건 흐름', practical: '안내 내용', visual: '도표 읽는 범위',
}
