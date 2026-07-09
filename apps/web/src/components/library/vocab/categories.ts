// apps/web/src/components/library/vocab/categories.ts
//
// 공용 단어장 9 카테고리 + '전체' — 유아~테마 학습자 단계 정렬.
// 매트릭스 그리드(CategoryMatrix)로 노출 (Calm UI 정합 — 보라 액센트 제거).

export const VOCAB_CATEGORIES = [
  { id: 'all', label: '전체', emoji: '✨', hint: '모든 단어장' },
  { id: 'preschool', label: '유아', emoji: '🧸', hint: '5~7세 기초' },
  { id: 'elementary', label: '초등', emoji: '🌱', hint: '1~6학년' },
  { id: 'middle', label: '중등', emoji: '📘', hint: '중1~3' },
  { id: 'high', label: '고등', emoji: '📚', hint: '고1~3' },
  { id: 'csat', label: '수능·내신', emoji: '🎯', hint: '입시 필수' },
  { id: 'eng_test', label: '공인영어', emoji: '🌍', hint: 'TOEIC·TOEFL·IELTS' },
  { id: 'civil', label: '공무원', emoji: '🏛️', hint: '7·9급' },
  { id: 'business', label: '비즈니스', emoji: '💼', hint: '실무 영어' },
  { id: 'themed', label: '테마별', emoji: '🎨', hint: '관심사 큐레이션' },
] as const

export type VocabCategoryId = (typeof VOCAB_CATEGORIES)[number]['id']

/**
 * 카테고리 중요도 — 타겟(수능생·한국 학습자) 우선순위. 높을수록 중요.
 * 추천 정렬(추천순)·캐러셀 탭 순서에 사용. 입시(수능·내신) → 교육과정(고·중·초) → 공인영어 → 실무/테마 → 유아.
 */
export const CATEGORY_IMPORTANCE: Record<string, number> = {
  csat: 100,
  high: 90,
  middle: 80,
  elementary: 70,
  eng_test: 60,
  civil: 45,
  business: 45,
  themed: 30,
  preschool: 20,
}

/** 카테고리 중요도 조회 (미지정=10, 최하위). */
export function categoryImportance(cat: string | null | undefined): number {
  return cat ? (CATEGORY_IMPORTANCE[cat] ?? 10) : 10
}

/** VOCAB_CATEGORIES 조회 (라벨·이모지·힌트). */
export function vocabCategoryMeta(cat: string) {
  return VOCAB_CATEGORIES.find((c) => c.id === cat) ?? null
}
