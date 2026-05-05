// apps/web/src/components/library/vocab/categories.ts
//
// 공용 단어장 8 카테고리 + '전체' — 사이드바 직접 노출 X (Calm UI 정합).
// 페이지 내부 가로 스크롤 칩으로만 노출.

export const VOCAB_CATEGORIES = [
  { id: 'all', label: '전체', emoji: '✨' },
  { id: 'elementary', label: '초등', emoji: '🌱' },
  { id: 'middle', label: '중등', emoji: '📘' },
  { id: 'high', label: '고등', emoji: '📚' },
  { id: 'csat', label: '수능·내신', emoji: '🎯' },
  { id: 'eng_test', label: '공인영어', emoji: '🌍' },
  { id: 'civil', label: '공무원', emoji: '🏛️' },
  { id: 'business', label: '비즈니스', emoji: '💼' },
  { id: 'themed', label: '테마별', emoji: '🎨' },
] as const

export type VocabCategoryId = (typeof VOCAB_CATEGORIES)[number]['id']
