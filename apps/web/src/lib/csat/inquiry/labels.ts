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

// ── v3 비교 쌍 · 조건부 원리 (M4 · REASONING_DATA ComparisonPair · Principle) ──
export type PairKind = 'same_structure' | 'contrast' | 'boundary'
export const PAIR_KIND_LABEL: Record<PairKind, string> = {
  same_structure: '같은 판단 구조',
  contrast: '비슷해 보이지만 판정이 갈림',
  boundary: '원리가 통하는 경계',
}
export type PrincipleLevel = 'candidate' | 'bounded' | 'generalized'
export const PRINCIPLE_LEVEL_LABEL: Record<PrincipleLevel, string> = {
  candidate: '이 문항에서 얻은 잠정 원리',
  bounded: '검수된 두 사례가 지지하는 원리',
  generalized: '여러 사례로 검수된 원리',
}

/** 화면용 비교 쌍 — 이 문항(self) 기준으로 돌려 놓은 형태. 원문은 없고 문장 · 선지 번호만 */
export interface V3PairView {
  pairId: string
  kind: PairKind
  focus: string
  otherSlug: string
  otherLabel: string
  mappings: { self: { sentences: number[]; choices?: number[] }; other: { sentences: number[]; choices?: number[] }; relation: string }[]
  shared: string[]
  differences: { text: string; selfSentences: number[]; otherSentences: number[] }[]
  principle: { level: 'bounded'; statement: string; when_applies: string[]; when_not: string[] } | null
  limitation: string
}

/** 비교가 없는 이유 — 서로 다른 absence reason(REASONING_DATA §pair) */
export type PairAbsence = 'none' | 'partner_hidden' | 'partner_missing' | 'partner_changed' | 'stale'
export const PAIR_ABSENCE_TEXT: Record<PairAbsence, string> = {
  none: '이 문항과 독립 검수를 통과한 비교 쌍이 아직 없어요. 같은 유형이라는 이유만으로 채우지 않아요.',
  partner_hidden: '검수된 비교가 있지만 상대 문항이 지금 공개되지 않아 보여 드릴 수 없어요.',
  partner_missing: '검수된 비교의 상대 문항이 지금 공개 목록에 없어 보여 드릴 수 없어요.',
  partner_changed: '상대 문항의 분석이 바뀌어, 예전 분석으로 만든 비교는 다시 검수할 때까지 숨겨요.',
  stale: '이 문항의 분석이 새로 바뀌어, 예전 분석으로 만든 비교는 다시 검수할 때까지 숨겨요.',
}
