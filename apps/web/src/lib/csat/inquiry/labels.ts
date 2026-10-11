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

export interface InquiryRecord {
  analysis_version: number
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
