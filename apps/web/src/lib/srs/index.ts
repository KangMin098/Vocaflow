// packages/ui-shared/src/srs/index.ts
// Vocaflow SRS — 공개 API 진입점
// CLAUDE.md §17 학습 모델 v2.0 [4] 기억 축 + [2] 상태 축

// 도메인 타입
export type {
  SrsCard,
  MemoryState,
  RatingValue,
  ModuleId,
  MasteryLevel,
  UserStats,
  ReviewInput,
  ReviewResult,
} from './types';

export { Rating } from './types';

// 상태 계산 — R(t) → 4색 동적 매핑
export {
  MEMORY_THRESHOLD,
  calculateRetrievability,
  getMemoryState,
  getRetrievability,
  filterUrgentCards,
  getMemoryColorVar,
} from './state';

// FSRS 엔진 — ts-fsrs wrapper
export {
  VOCAFLOW_DEFAULT_PARAMS,
  buildVocaflowParams,
  createVocaflowScheduler,
  applyReview,
  previewRatings,
  createNewCard,
} from './fsrs';
