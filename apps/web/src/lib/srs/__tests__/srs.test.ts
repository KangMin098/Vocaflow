// packages/ui-shared/src/srs/__tests__/srs.test.ts
// Vocaflow SRS — Vitest 단위 테스트
// CLAUDE.md §17 학습 모델 v2.0 동작 검증

import { describe, it, expect } from 'vitest';
import {
  Rating,
  MEMORY_THRESHOLD,
  calculateRetrievability,
  getMemoryState,
  getRetrievability,
  filterUrgentCards,
  getMemoryColorVar,
  createNewCard,
  applyReview,
  previewRatings,
  buildVocaflowParams,
  VOCAFLOW_DEFAULT_PARAMS,
} from '../index';
import type { SrsCard } from '../types';

// ─────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    id: 'test-card-1',
    difficulty: 6.0,
    stability: 1.0,
    lastReviewAt: new Date('2025-01-01T00:00:00Z'),
    nextReviewAt: null,
    moduleHistory: [],
    reviewCount: 1,
    ...overrides,
  };
}

const FIXED_NOW = new Date('2025-01-01T00:00:00Z');

// ─────────────────────────────────────────────────────────────────────
// calculateRetrievability — FSRS 핵심 수식 R(t) = 0.9^(t/S)
// ─────────────────────────────────────────────────────────────────────

describe('calculateRetrievability — FSRS R(t) 수식', () => {
  it('t=0일 때 R=1 (방금 review함)', () => {
    expect(calculateRetrievability(0, 10)).toBeCloseTo(1.0, 5);
  });

  it('t=S일 때 R=0.9 (Stability의 정의)', () => {
    expect(calculateRetrievability(10, 10)).toBeCloseTo(0.9, 5);
    expect(calculateRetrievability(5, 5)).toBeCloseTo(0.9, 5);
  });

  it('t=2S일 때 R=0.81 (지수 감쇠)', () => {
    expect(calculateRetrievability(20, 10)).toBeCloseTo(0.81, 3);
  });

  it('Stability=0인 신규 카드는 1.0 반환 (호출자가 new 분기 책임)', () => {
    expect(calculateRetrievability(100, 0)).toBe(1.0);
  });

  it('elapsedDays 음수는 1.0 반환 (방어적)', () => {
    expect(calculateRetrievability(-5, 10)).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// getMemoryState — R(t) → 4색 매핑 (CLAUDE.md §17.2 핵심)
// ─────────────────────────────────────────────────────────────────────

describe('getMemoryState — Memory Decay 4색 동적 매핑', () => {
  it('lastReviewAt 없으면 new', () => {
    const card = makeCard({ lastReviewAt: null });
    expect(getMemoryState(card, FIXED_NOW)).toBe('new');
  });

  it('stability=0이면 new (D/S 미부여)', () => {
    const card = makeCard({ stability: 0 });
    expect(getMemoryState(card, FIXED_NOW)).toBe('new');
  });

  it('R ≥ 0.95 → stable', () => {
    // S=100일, 경과 1일 → R = 0.9^0.01 ≈ 0.999
    const card = makeCard({
      stability: 100,
      lastReviewAt: new Date('2025-01-01T00:00:00Z'),
    });
    const now = new Date('2025-01-02T00:00:00Z'); // 1일 후
    expect(getMemoryState(card, now)).toBe('stable');
  });

  it('R = 0.95 경계는 stable에 포함', () => {
    // R = 0.95가 되려면 t/S = log(0.95)/log(0.9) ≈ 0.487
    // S=10, t≈4.87일
    const card = makeCard({
      stability: 10,
      lastReviewAt: new Date('2025-01-01T00:00:00Z'),
    });
    const now = new Date('2025-01-01T00:00:00Z');
    now.setUTCMilliseconds(0.487 * 10 * 24 * 60 * 60 * 1000);
    const r = getRetrievability(card, now);
    expect(r).toBeGreaterThanOrEqual(MEMORY_THRESHOLD.STABLE - 0.001);
  });

  it('0.70 ≤ R < 0.95 → shaky', () => {
    // S=5, 경과 4일 → R = 0.9^0.8 ≈ 0.919 → shaky
    const card = makeCard({
      stability: 5,
      lastReviewAt: new Date('2025-01-01T00:00:00Z'),
    });
    const now = new Date('2025-01-05T00:00:00Z'); // 4일 후
    expect(getMemoryState(card, now)).toBe('shaky');
  });

  it('R < 0.70 → risk', () => {
    // S=5, 경과 20일 → R = 0.9^4 ≈ 0.656 → risk
    const card = makeCard({
      stability: 5,
      lastReviewAt: new Date('2025-01-01T00:00:00Z'),
    });
    const now = new Date('2025-01-21T00:00:00Z'); // 20일 후
    expect(getMemoryState(card, now)).toBe('risk');
  });

  it('아주 오래 방치된 카드는 risk', () => {
    const card = makeCard({
      stability: 1,
      lastReviewAt: new Date('2024-01-01T00:00:00Z'),
    });
    const now = new Date('2025-12-01T00:00:00Z');
    expect(getMemoryState(card, now)).toBe('risk');
  });
});

// ─────────────────────────────────────────────────────────────────────
// filterUrgentCards — 추천 엔진 P1
// ─────────────────────────────────────────────────────────────────────

describe('filterUrgentCards — 회상 위급 단어 추출', () => {
  it('R < 0.6 단어만 반환', () => {
    const cards: SrsCard[] = [
      // stable
      makeCard({
        id: 'stable',
        stability: 100,
        lastReviewAt: new Date('2025-01-01'),
      }),
      // urgent (R ≈ 0.43)
      makeCard({
        id: 'urgent-1',
        stability: 5,
        lastReviewAt: new Date('2024-12-01T00:00:00Z'),
      }),
    ];
    const now = new Date('2025-01-10T00:00:00Z');

    const urgent = filterUrgentCards(cards, 0.6, now);
    expect(urgent).toHaveLength(1);
    expect(urgent[0].id).toBe('urgent-1');
  });

  it('new 단어는 제외 (회상 위급이 아니라 신규 학습 대상)', () => {
    const cards: SrsCard[] = [
      makeCard({ id: 'new', lastReviewAt: null, stability: 0 }),
    ];
    expect(filterUrgentCards(cards, 0.6, FIXED_NOW)).toHaveLength(0);
  });

  it('R 낮은 순으로 정렬 (가장 위급한 것 먼저)', () => {
    const baseDate = new Date('2024-12-01T00:00:00Z');
    const cards: SrsCard[] = [
      makeCard({ id: 'less-urgent', stability: 7, lastReviewAt: baseDate }),
      makeCard({ id: 'most-urgent', stability: 3, lastReviewAt: baseDate }),
    ];
    const now = new Date('2025-01-10T00:00:00Z');

    const urgent = filterUrgentCards(cards, 0.7, now);
    expect(urgent[0].id).toBe('most-urgent');
  });
});

// ─────────────────────────────────────────────────────────────────────
// getMemoryColorVar — CSS Variable 매핑
// ─────────────────────────────────────────────────────────────────────

describe('getMemoryColorVar — CSS 변수 토큰 매핑', () => {
  it('CLAUDE.md §"Memory Decay 색 체계" 토큰 정합', () => {
    expect(getMemoryColorVar('stable')).toBe('var(--memory-stable)');
    expect(getMemoryColorVar('shaky')).toBe('var(--memory-shaky)');
    expect(getMemoryColorVar('risk')).toBe('var(--memory-risk)');
    expect(getMemoryColorVar('new')).toBe('var(--memory-new)');
  });
});

// ─────────────────────────────────────────────────────────────────────
// createNewCard — 신규 단어 생성 (WordVault L3 등록 시)
// ─────────────────────────────────────────────────────────────────────

describe('createNewCard — 신규 단어 카드 생성', () => {
  it('새 카드는 항상 new 상태로 시작', () => {
    const card = createNewCard('vocab-123');
    expect(card.id).toBe('vocab-123');
    expect(card.lastReviewAt).toBeNull();
    expect(card.reviewCount).toBe(0);
    expect(card.moduleHistory).toEqual([]);
    expect(getMemoryState(card)).toBe('new');
  });
});

// ─────────────────────────────────────────────────────────────────────
// applyReview — 핵심 review 적용
// ─────────────────────────────────────────────────────────────────────

describe('applyReview — review 1건 적용 후 카드 갱신', () => {
  it('Good 평가 후 stability가 증가', () => {
    const initial = createNewCard('vocab-1', new Date('2025-01-01T00:00:00Z'));
    const result = applyReview({
      card: initial,
      rating: Rating.Good,
      reviewedAt: new Date('2025-01-01T00:00:00Z'),
      module: 'flashcard',
    });

    expect(result.card.stability).toBeGreaterThan(0);
    expect(result.card.lastReviewAt).toEqual(
      new Date('2025-01-01T00:00:00Z'),
    );
    expect(result.card.reviewCount).toBe(1);
    expect(result.card.moduleHistory).toContain('flashcard');
  });

  it('Easy 평가는 Good보다 더 큰 stability 증가', () => {
    const baseTime = new Date('2025-01-01T00:00:00Z');
    const initial = createNewCard('vocab-1', baseTime);

    const goodResult = applyReview({
      card: initial,
      rating: Rating.Good,
      reviewedAt: baseTime,
      module: 'flashcard',
    });

    const easyResult = applyReview({
      card: initial,
      rating: Rating.Easy,
      reviewedAt: baseTime,
      module: 'flashcard',
    });

    expect(easyResult.card.stability).toBeGreaterThan(goodResult.card.stability);
  });

  it('Again 평가는 Hard보다 stability가 더 작거나 같음', () => {
    const baseTime = new Date('2025-01-01T00:00:00Z');
    // 어느 정도 학습된 카드에서 시작
    const learned = applyReview({
      card: createNewCard('vocab-1', baseTime),
      rating: Rating.Good,
      reviewedAt: baseTime,
      module: 'flashcard',
    }).card;

    const laterTime = new Date('2025-01-15T00:00:00Z');

    const againResult = applyReview({
      card: learned,
      rating: Rating.Again,
      reviewedAt: laterTime,
      module: 'flashcard',
    });

    const hardResult = applyReview({
      card: learned,
      rating: Rating.Hard,
      reviewedAt: laterTime,
      module: 'flashcard',
    });

    expect(againResult.card.stability).toBeLessThanOrEqual(
      hardResult.card.stability,
    );
  });

  it('moduleHistory는 중복 없이, 가장 최근이 끝에', () => {
    const baseTime = new Date('2025-01-01T00:00:00Z');
    let card = createNewCard('vocab-1', baseTime);

    card = applyReview({
      card,
      rating: Rating.Good,
      reviewedAt: baseTime,
      module: 'flashcard',
    }).card;

    card = applyReview({
      card,
      rating: Rating.Good,
      reviewedAt: new Date('2025-01-02T00:00:00Z'),
      module: 'spellforge',
    }).card;

    // flashcard 다시 (중복 처리)
    card = applyReview({
      card,
      rating: Rating.Good,
      reviewedAt: new Date('2025-01-03T00:00:00Z'),
      module: 'flashcard',
    }).card;

    expect(card.moduleHistory).toEqual(['spellforge', 'flashcard']);
    expect(card.reviewCount).toBe(3);
  });

  it('log에 stabilityDelta가 정확히 기록됨', () => {
    const baseTime = new Date('2025-01-01T00:00:00Z');
    const initial = createNewCard('vocab-1', baseTime);

    const result = applyReview({
      card: initial,
      rating: Rating.Good,
      reviewedAt: baseTime,
      module: 'flashcard',
    });

    expect(result.log.stabilityDelta).toBe(result.card.stability - 0);
    expect(result.log.module).toBe('flashcard');
    expect(result.log.rating).toBe(Rating.Good);
  });
});

// ─────────────────────────────────────────────────────────────────────
// previewRatings — UI에서 4 버튼 옆에 다음 review 일정 표시
// ─────────────────────────────────────────────────────────────────────

describe('previewRatings — 4가지 평가 결과 미리보기', () => {
  it('4가지 평가 모두 결과 반환', () => {
    const card = createNewCard('vocab-1');
    const preview = previewRatings(card);

    expect(preview[Rating.Again]).toBeDefined();
    expect(preview[Rating.Hard]).toBeDefined();
    expect(preview[Rating.Good]).toBeDefined();
    expect(preview[Rating.Easy]).toBeDefined();
  });

  it('Easy 간격 ≥ Good 간격 ≥ Hard 간격 (단조 증가)', () => {
    const baseTime = new Date('2025-01-01T00:00:00Z');
    // 기존 카드로 시작 (신규는 learning_steps에 묶임)
    const learned = applyReview({
      card: createNewCard('vocab-1', baseTime),
      rating: Rating.Good,
      reviewedAt: baseTime,
      module: 'flashcard',
    }).card;

    const laterTime = new Date('2025-01-15T00:00:00Z');
    const preview = previewRatings(learned, laterTime);

    expect(preview[Rating.Easy].intervalDays).toBeGreaterThanOrEqual(
      preview[Rating.Good].intervalDays,
    );
    expect(preview[Rating.Good].intervalDays).toBeGreaterThanOrEqual(
      preview[Rating.Hard].intervalDays,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// 한국 학습자 파라미터 — CLAUDE.md §17.4 정합
// ─────────────────────────────────────────────────────────────────────

describe('VOCAFLOW_DEFAULT_PARAMS — 한국 학습자 초기값', () => {
  it('target retention = 0.85 (학습 시간 부족 — 부담 완화)', () => {
    expect(VOCAFLOW_DEFAULT_PARAMS.request_retention).toBe(0.85);
  });

  it('maximum_interval = 365일 (1년 이상 의미 없음)', () => {
    expect(VOCAFLOW_DEFAULT_PARAMS.maximum_interval).toBe(365);
  });

  it('learning_steps = [1d, 3d] (분 단위 X)', () => {
    expect(VOCAFLOW_DEFAULT_PARAMS.learning_steps).toEqual(['1d', '3d']);
  });

  it('enable_short_term = false (Vocaflow는 일 단위 세션)', () => {
    expect(VOCAFLOW_DEFAULT_PARAMS.enable_short_term).toBe(false);
  });
});

describe('buildVocaflowParams — 사용자별 파라미터', () => {
  it('targetRetention 미지정 시 기본 0.85', () => {
    const params = buildVocaflowParams();
    expect(params.request_retention).toBe(0.85);
  });

  it('Hot 사용자는 0.9로 더 높게 가능', () => {
    const params = buildVocaflowParams(0.9);
    expect(params.request_retention).toBe(0.9);
  });

  it('Cold 사용자는 0.8로 부담 완화 가능', () => {
    const params = buildVocaflowParams(0.8);
    expect(params.request_retention).toBe(0.8);
  });
});
