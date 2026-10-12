// apps/web/src/lib/csat/inquiry/labels.ts
//
// 탐구 데이터의 타입 · 라벨 — **JSON 을 import 하지 않는다.** 클라이언트 컴포넌트가 이 파일만 쓰게 해서
// 정적 정본(inquiry-data.json · 수 MB)이 브라우저 번들에 들어가지 않게 한다. 데이터 조회는 서버의 data.ts.

export type Truth = 'false' | 'true' | 'not_applicable' | 'unknown'

export interface InquiryDistractor {
  n: number
  truth: Truth
  operation: string
  preserved: { component: string; text: string }[]
  altered: { component: string; from: string; to: string }[]
  note: string
}

export interface InquiryPrinciple {
  statement: string
  when_applies: string[]
  when_not: string[]
}

/** 공개 가드 상태 — verified: 현재 내용에 묶인 독립 pass · legacy: 해시 결속 전(v1) 검수분 보존 */
export type InquiryReview = 'verified' | 'legacy'

export interface InquiryRecord {
  analysis_version: number
  review: InquiryReview
  /** v3 칸 — 현재 내용에 묶인 독립 pass(verified)일 때만 빌드가 싣는다 */
  v3?: InquiryV3
  distractors: InquiryDistractor[]
  principle: InquiryPrinciple | null
}

export const OPERATION_LABEL: Record<string, string> = {
  paraphrase: '동의 재진술',
  abstraction: '추상화',
  compression: '압축',
  inference: '추론',
  polarity: '극성 반전',
  scope: '범위 바꿈',
  agent: '행위자 바꿈',
  reference: '지시 대상 바꿈',
  temporal: '시점 바꿈',
  degree: '정도 바꿈',
  causal_direction: '인과 방향 뒤집기',
  syntactic_form: '문법 형태',
  order: '순서 · 위치',
  numeric_relation: '수치 관계',
  unsupported: '지문에 없는 내용',
  none: '바꾼 것 없음',
}

export const TRUTH_LABEL: Record<Truth, string> = {
  false: '내용이 지문과 다름',
  true: '내용은 맞지만 정답 아님',
  not_applicable: '위치 · 지칭 선지',
  unknown: '원문으로 확정 불가',
}

// ── v3 의미 · 판단 · 설계(docs/csat-learner/v3/CSAT_REASONING_DATA_V3.md §3) — 독립 검수(verified)를 지난 문항에만 실린다 ──

export type ScopeKind = 'negation' | 'condition' | 'agent' | 'time' | 'quantity' | 'contrast' | 'reference' | 'none'
export type ClaimBasis = 'official' | 'source_observation' | 'design_hypothesis'

export interface InquiryV3 {
  /** 작성 때의 문장 수 — 지문 지도 문장 수와 같을 때만 근거 연결을 켠다 */
  sentence_count: number
  units_hash: string
  requirement: { requested: string; polarity: 'positive' | 'negative'; conditions: string[]; reading_scope?: string }
  meanings: { id: string; sentences: number[]; expression: string; meaning_ko: string; scope: { kind: ScopeKind; note?: string } }[]
  choices: {
    n: number
    selected_as_answer: boolean
    content_truth: 'true' | 'false' | 'n_a' | 'unknown'
    requirement_fit: 'satisfies' | 'fails' | 'unknown'
    decisive: string
    sentences: number[]
    meaning_ids?: string[]
  }[]
  design: { claims: { basis: ClaimBasis; text: string; sentences?: number[] }[]; limitation: string }
}

export const SCOPE_LABEL: Record<ScopeKind, string> = {
  negation: '부정 범위',
  condition: '조건 범위',
  agent: '행위자',
  time: '시점',
  quantity: '수량 · 범위',
  contrast: '대조',
  reference: '지시 대상',
  none: '범위 표지 없음',
}

/** 근거 수준 — 서열이 아니라 출처(provenance)다. 검수 pass 가 official 을 뜻하지 않는다 */
export const BASIS_LABEL: Record<ClaimBasis, string> = {
  official: '공식 자료',
  source_observation: '원문에서 확인',
  design_hypothesis: '설계 가설',
}

export const CONTENT_TRUTH_LABEL: Record<InquiryV3['choices'][number]['content_truth'], string> = {
  true: '내용은 원문과 맞음',
  false: '내용이 원문과 다름',
  n_a: '위치 · 지칭 선택지(참거짓 해당 없음)',
  unknown: '원문만으로 확정 불가',
}

export const FIT_LABEL: Record<InquiryV3['choices'][number]['requirement_fit'], string> = {
  satisfies: '발문 요구를 충족',
  fails: '발문 요구를 충족하지 못함',
  unknown: '충족 여부 확정 불가',
}
