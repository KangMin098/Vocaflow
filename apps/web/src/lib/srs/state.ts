// packages/ui-shared/src/srs/state.ts
// Vocaflow SRS — Memory Decay 상태 계산 (R(t) 기반 동적 매핑)
// CLAUDE.md §17.2 [2] 상태 축 — 단어 상태 매핑 규칙
//
// 안티패턴: state(4색)를 DB에 직접 저장 금지 — 항상 R(t) 동적 계산
// (§17 "안티패턴 5개" 중 4번)

import type { SrsCard, MemoryState } from './types';

/**
 * Memory Decay 4색 매핑 임계값 — CLAUDE.md §17.2 (v06.39 Reading Room paper 톤)
 *
 * R ≥ 0.95           → stable  (#2E7D5A muted forest — "이건 알아요")
 * 0.70 ≤ R < 0.95    → shaky   (#C68A2C warm amber  — "익숙해요")
 * R < 0.70           → risk    (#A03A2E warm red    — "흐릿해요")
 * 신규(D/S 미부여)    → new     (#7A726A warm gray   — "처음 만나는 단어")
 */
export const MEMORY_THRESHOLD = {
  STABLE: 0.95,
  SHAKY: 0.7,
} as const;

/**
 * FSRS 회상 확률 함수 — CLAUDE.md §17.4 핵심 수식
 * R(t) = exp(ln(0.9) × t / S)
 *
 * - t=0일 때 R=1 (방금 review함)
 * - t=S일 때 R=0.9 (Stability의 정의)
 * - t→∞ 일 때 R→0
 *
 * @param elapsedDays 마지막 review로부터 경과한 일수
 * @param stability 카드의 현재 Stability (일 단위)
 * @returns 0.0 ~ 1.0 사이의 회상 확률
 */
export function calculateRetrievability(
  elapsedDays: number,
  stability: number,
): number {
  // 신규 카드(stability=0)는 정의되지 않음 — 1.0 반환 (위 호출자가 'new'로 분기)
  if (stability <= 0) return 1.0;
  if (elapsedDays <= 0) return 1.0;

  // R(t) = exp(ln(0.9) × t / S) = 0.9^(t/S)
  return Math.pow(0.9, elapsedDays / stability);
}

/**
 * 카드의 현재 Memory Decay 상태 계산
 * — CLAUDE.md §17.2 매핑 규칙 그대로 구현
 *
 * @param card SRS 카드 (vocabularies 1건)
 * @param now 기준 시각 (테스트 가능성 확보)
 * @returns 4상태 중 하나
 */
export function getMemoryState(card: SrsCard, now: Date = new Date()): MemoryState {
  // 신규: D/S 미부여 (lastReviewAt 없음 또는 stability=0)
  if (!card.lastReviewAt || card.stability <= 0) {
    return 'new';
  }

  const elapsedMs = now.getTime() - card.lastReviewAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  const r = calculateRetrievability(elapsedDays, card.stability);

  if (r >= MEMORY_THRESHOLD.STABLE) return 'stable';
  if (r >= MEMORY_THRESHOLD.SHAKY) return 'shaky';
  return 'risk';
}

/**
 * 카드의 현재 R(t) 값 — UI에 노출하지 않음 (§17 안티패턴 2)
 * 백엔드 정렬·우선순위 큐 빌딩에만 사용
 */
export function getRetrievability(card: SrsCard, now: Date = new Date()): number {
  if (!card.lastReviewAt || card.stability <= 0) return 1.0;

  const elapsedMs = now.getTime() - card.lastReviewAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  return calculateRetrievability(elapsedDays, card.stability);
}

/**
 * 회상 위급 단어 필터 — Hub Today CTA, FloatingSparkle 추천에 사용
 * §17.9 추천 엔진 P1: R < 0.6 단어는 즉시 복습 권장
 *
 * 라벨은 항상 격려형으로 — "오늘 N개를 다시 만나보세요" (§ 안티패턴: 비난 금지)
 */
export function filterUrgentCards(
  cards: SrsCard[],
  threshold = 0.6,
  now: Date = new Date(),
): SrsCard[] {
  return cards
    .filter((c) => getMemoryState(c, now) !== 'new')
    .filter((c) => getRetrievability(c, now) < threshold)
    .sort((a, b) => getRetrievability(a, now) - getRetrievability(b, now));
}

/**
 * 4색 → CSS 변수명 매핑
 * CLAUDE.md §"Memory Decay 색 체계" 토큰 정합
 */
export function getMemoryColorVar(state: MemoryState): string {
  switch (state) {
    case 'stable':
      return 'var(--memory-stable)';
    case 'shaky':
      return 'var(--memory-shaky)';
    case 'risk':
      return 'var(--memory-risk)';
    case 'new':
      return 'var(--memory-new)';
  }
}
