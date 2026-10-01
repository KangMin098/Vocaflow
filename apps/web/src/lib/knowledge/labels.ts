// apps/web/src/lib/knowledge/labels.ts
// 학습 원리 등록부의 닫힌 값과 화면 라벨. 정본 docs/methodology/SYSTEM.md · 마이그레이션 20260928120000.
// DB CHECK 제약과 값이 같아야 한다 — 하나만 바꾸면 화면이 조용히 「알 수 없음」을 낸다.

export const LAYERS = ['essence', 'principle', 'method', 'practice'] as const
export type Layer = (typeof LAYERS)[number]

export const LAYER_LABEL: Record<Layer, string> = {
  essence: '본질',
  principle: '원리',
  method: '방법론',
  practice: '공부법',
}

/** 층 번호 — 화면 표지(L1…L4)와 연결 방향 판정에 쓴다. */
export const LAYER_RANK: Record<Layer, 1 | 2 | 3 | 4> = {
  essence: 1,
  principle: 2,
  method: 3,
  practice: 4,
}

export const LAYER_QUESTION: Record<Layer, string> = {
  essence: '이 영역에서 「잘한다」는 게 결국 무엇인가',
  principle: '왜 그렇게 하면 배워지는가',
  method: '원리를 한 영역에 적용하는 절차',
  practice: '학습자가 오늘 하는 구체 루틴',
}

export const STATUSES = ['extracted', 'in_review', 'adopted', 'rejected', 'applied'] as const
export type ItemStatus = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<ItemStatus, string> = {
  extracted: '추출됨',
  in_review: '검토 중',
  adopted: '채택',
  rejected: '반려',
  applied: '제품 적용',
}

/** 검토 대기열에 뜨는 상태 — 사람이 판단해야 다음으로 간다. */
export const NEEDS_REVIEW: readonly ItemStatus[] = ['extracted', 'in_review']

export const GRADES = ['A', 'B', 'C', 'G'] as const
export type Grade = (typeof GRADES)[number]

/** 등급은 색만으로 전하지 않는다 — 글자와 이 라벨을 함께 쓴다. */
export const GRADE_LABEL: Record<Grade, string> = {
  A: '직접 확인',
  B: '유력 후보',
  C: '계보만',
  G: '미확인',
}

export const GAP_CAUSE_LABEL: Record<string, string> = {
  no_transcript: '자막 미확보',
  rights_unknown: '권리 미확인',
  not_found: '찾지 못함',
  not_researched: '아직 조사 안 함',
  unverifiable: '검증 불가',
}

export function isLayer(v: unknown): v is Layer {
  return typeof v === 'string' && (LAYERS as readonly string[]).includes(v)
}

export function isStatus(v: unknown): v is ItemStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
}

export function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as readonly string[]).includes(v)
}

/**
 * 비율 표시. 분모가 0 이면 null — 「0%」와 「셀 것이 없음」은 다르다.
 */
export function share(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}
