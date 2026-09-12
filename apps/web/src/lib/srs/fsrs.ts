// packages/ui-shared/src/srs/fsrs.ts
// Vocaflow SRS — FSRS 엔진 wrapper (ts-fsrs ^5.2.3)
// CLAUDE.md §17.4 [4] 기억 축 — FSRS 호환 알고리즘
//
// 한국 학습자 초기 파라미터:
//   - target_retention: 0.85 (학습 시간 부족 — 부담 완화)
//   - initial difficulty: 6.0 (외국어 처리는 모국어보다 어려움)
//   - maximum_interval: 365일 (1년 이상은 의미 없음)
//   - learning_steps: [1d, 3d] (게임 세션 단위 — 분 단위 X)

import {
  fsrs,
  createEmptyCard,
  generatorParameters,
  Rating as FsrsRating,
  State as FsrsState,
  type Card as FsrsCard,
  type FSRSParameters,
  type Grade as FsrsGrade,
  type RecordLog,
} from 'ts-fsrs';

import type {
  SrsCard,
  ReviewInput,
  ReviewResult,
  RatingValue,
} from './types';
import { Rating } from './types';
import { getRetrievability } from './state';

// ─────────────────────────────────────────────────────────────────────
// 한국 학습자 초기 파라미터 (CLAUDE.md §17.4)
// ─────────────────────────────────────────────────────────────────────

/**
 * Vocaflow 기본 FSRS 파라미터 — 한국 학습자 특화 초기값
 * 출시 후 review 1,000건 누적 시 fsrs-optimizer로 사용자별 자동 재최적화 (§17 미정 항목 1)
 */
export const VOCAFLOW_DEFAULT_PARAMS: Partial<FSRSParameters> = {
  request_retention: 0.85,
  maximum_interval: 365,
  enable_fuzz: true, // 같은 시간 due 충돌 방지
  enable_short_term: false, // 분 단위 학습 단계 비활성 (Vocaflow는 일 단위)
  learning_steps: ['1d', '3d'],
  relearning_steps: ['1d'],
};

/**
 * 사용자별 파라미터 생성 — user_stats.fsrs_target_retention 반영
 *
 * @param targetRetention 사용자 개인화 목표 retention (기본 0.85)
 */
export function buildVocaflowParams(targetRetention = 0.85): FSRSParameters {
  return generatorParameters({
    ...VOCAFLOW_DEFAULT_PARAMS,
    request_retention: targetRetention,
  });
}

/**
 * Vocaflow FSRS 인스턴스 생성
 *
 * @param targetRetention 사용자별 목표 retention (없으면 기본 0.85)
 */
export function createVocaflowScheduler(targetRetention?: number) {
  return fsrs(buildVocaflowParams(targetRetention));
}

// ─────────────────────────────────────────────────────────────────────
// Vocaflow ↔ ts-fsrs 어댑터
// ─────────────────────────────────────────────────────────────────────

/**
 * SrsCard → ts-fsrs Card 변환
 *
 * Vocaflow 는 R(t) 를 읽을 때 동적으로 계산하므로 DB 에 상태 컬럼을 두지 않는다.
 * **하지만 ts-fsrs 에게는 state 를 말해 줘야 한다** — 아래 주석 참조.
 */
function toFsrsCard(card: SrsCard, now: Date): FsrsCard {
  // 신규 카드는 createEmptyCard로 시작
  if (!card.lastReviewAt || card.stability <= 0) {
    return createEmptyCard(now);
  }

  // 기존 카드는 D/S/last_review 복원
  const empty = createEmptyCard(now);
  return {
    ...empty,
    difficulty: card.difficulty,
    stability: card.stability,
    last_review: card.lastReviewAt,
    reps: card.reviewCount,
    // due는 nextReviewAt 또는 now (재계산되므로 무관)
    due: card.nextReviewAt ?? now,
    // ⚠️ **`state` 를 반드시 넣는다. 안 넣으면 간격 반복이 통째로 멈춘다.**
    //
    // `createEmptyCard()` 는 `state: New` 로 시작하고 위 스프레드는 그걸 안 덮는다.
    // 그러면 ts-fsrs 의 `next()` 가 매번 New 분기(`init_ds`)를 타서 **바로 위에서 복원한
    // stability 를 버리고** `S = w[rating-1]` 로 초기화한다. 오류는 하나도 안 난다.
    //
    // 실측 2026-09-05 (이 줄이 없던 동안):
    //   Good 8회 반복 → S 가 2.3065 로 **8회 내내 같은 값**(FSRS-5 초기값 w[2] 그대로)
    //   DB: 복습한 234단어의 최대 S = 8.2956일, 그리고 S 는 복습 횟수와 **역상관**
    //       (29회 복습한 단어의 S = 0.0010일 = 86초 — 많이 할수록 나빠졌다)
    //   그 결과 `stable`(R≥0.95)은 구조적으로 도달 불가(실측 stable 0 / risk 234),
    //   `known_word_count` 의 임계 `stability >= 21` 도 영원히 넘지 못했다(두 계정 다 0).
    //
    // 예전 주석은 "state 는 stability 에서 추론 — ts-fsrs state 미사용" 이라고 적었는데,
    // **우리가 안 쓰는 것과 ts-fsrs 가 안 쓰는 것은 다른 말이다.** ts-fsrs 는 쓴다.
    // `lapses` 는 DB 에 없어 0 으로 둔다 — D 보정에만 쓰이고 S 성장을 막지는 않는다.
    state: FsrsState.Review,
  };
}

/**
 * ts-fsrs Card → SrsCard 변환 (review 직후 적용)
 */
function fromFsrsCard(
  fsrsCard: FsrsCard,
  original: SrsCard,
  reviewedAt: Date,
  module: SrsCard['moduleHistory'][number],
): SrsCard {
  return {
    id: original.id,
    difficulty: fsrsCard.difficulty,
    stability: fsrsCard.stability,
    lastReviewAt: reviewedAt,
    nextReviewAt: fsrsCard.due,
    moduleHistory: addToHistory(original.moduleHistory, module),
    reviewCount: original.reviewCount + 1,
  };
}

/**
 * 모듈 이력 추가 — 중복 제거, 순서 유지 (가장 최근 추가가 끝)
 */
function addToHistory<T>(history: T[], next: T): T[] {
  const filtered = history.filter((m) => m !== next);
  return [...filtered, next];
}

/**
 * Vocaflow Rating → ts-fsrs Rating 변환
 */
function toFsrsRating(rating: RatingValue): FsrsGrade {
  switch (rating) {
    case Rating.Again:
      return FsrsRating.Again;
    case Rating.Hard:
      return FsrsRating.Hard;
    case Rating.Good:
      return FsrsRating.Good;
    case Rating.Easy:
      return FsrsRating.Easy;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 공개 API — 두 가지 호출 패턴 (preview / commit)
// ─────────────────────────────────────────────────────────────────────

/**
 * 카드 review 적용 — 사용자가 게임에서 평가한 직후 호출
 *
 * @param input ReviewInput (card + rating + module + reviewedAt)
 * @param targetRetention 사용자별 목표 retention (없으면 기본)
 * @returns ReviewResult (갱신된 card + log)
 *
 * @example
 * const result = applyReview({
 *   card: existingCard,
 *   rating: Rating.Good,
 *   module: 'flashcard',
 *   reviewedAt: new Date()
 * });
 * await db.vocabularies.update(result.card);
 * await db.learning_records.insert(result.log);
 */
export function applyReview(
  input: ReviewInput,
  targetRetention?: number,
): ReviewResult {
  const scheduler = createVocaflowScheduler(targetRetention);
  const fsrsCard = toFsrsCard(input.card, input.reviewedAt);

  // R(t) 계산 — review 직전 시점
  const retrievabilityBefore = getRetrievability(input.card, input.reviewedAt);
  const stabilityBefore = input.card.stability;

  // ts-fsrs로 다음 상태 계산
  const { card: nextFsrsCard } = scheduler.next(
    fsrsCard,
    input.reviewedAt,
    toFsrsRating(input.rating),
  );

  const updatedCard = fromFsrsCard(
    nextFsrsCard,
    input.card,
    input.reviewedAt,
    input.module,
  );

  return {
    card: updatedCard,
    log: {
      cardId: input.card.id,
      rating: input.rating,
      module: input.module,
      reviewedAt: input.reviewedAt,
      retrievabilityBefore,
      stabilityDelta: updatedCard.stability - stabilityBefore,
    },
  };
}

/**
 * 4가지 평가 결과 미리보기 — UI에서 "Easy/Good/Hard/Again" 버튼 옆에
 * "다음 review까지 N일" 표시할 때 사용 (Progressive Disclosure 정합)
 *
 * 단, CLAUDE.md §17 안티패턴 2: FSRS 변수(D/S)는 직접 노출 금지.
 * → "5일 후 다시 만나요" 식 자연어로 표현할 것
 */
export function previewRatings(
  card: SrsCard,
  now: Date = new Date(),
  targetRetention?: number,
): Record<RatingValue, { intervalDays: number; nextReviewAt: Date }> {
  const scheduler = createVocaflowScheduler(targetRetention);
  const fsrsCard = toFsrsCard(card, now);
  const preview: RecordLog = scheduler.repeat(fsrsCard, now);

  return {
    [Rating.Again]: extractInterval(preview[FsrsRating.Again].card, now),
    [Rating.Hard]: extractInterval(preview[FsrsRating.Hard].card, now),
    [Rating.Good]: extractInterval(preview[FsrsRating.Good].card, now),
    [Rating.Easy]: extractInterval(preview[FsrsRating.Easy].card, now),
  };
}

function extractInterval(
  fsrsCard: FsrsCard,
  now: Date,
): { intervalDays: number; nextReviewAt: Date } {
  const ms = fsrsCard.due.getTime() - now.getTime();
  const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  return { intervalDays: days, nextReviewAt: fsrsCard.due };
}

/**
 * 신규 카드 생성 — WordVault 단어장 등록 직후 사용
 * 한국 학습자 초기값 D=6.0 부여 (CLAUDE.md §17.4)
 *
 * 단, ts-fsrs createEmptyCard는 D=0/S=0으로 시작 — 첫 review에서 D 부여됨.
 * Vocaflow는 첫 review 전까지 'new' 상태이므로 그대로 사용.
 */
export function createNewCard(id: string, now: Date = new Date()): SrsCard {
  // ts-fsrs createEmptyCard 호출 (검증용, 실제 D/S는 첫 review 후 부여)
  const empty = createEmptyCard(now);

  return {
    id,
    difficulty: empty.difficulty, // 0 (첫 review 후 부여됨)
    stability: empty.stability, // 0
    lastReviewAt: null,
    nextReviewAt: null,
    moduleHistory: [],
    reviewCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 재export — 사용처에서 './fsrs' 한 곳만 import
// ─────────────────────────────────────────────────────────────────────

export { Rating } from './types';
export type { SrsCard, ReviewInput, ReviewResult, RatingValue } from './types';
