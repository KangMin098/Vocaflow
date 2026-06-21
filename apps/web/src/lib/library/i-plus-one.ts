// apps/web/src/lib/library/i-plus-one.ts
//
// 미지어 커버리지 → i+1 적합도 판정 (단일 출처).
//
// coverage[L] = "V레벨 L 학습자가 이 도서 토큰의 N% 를 안다" (compute_book_coverage RPC).
// 임계값 경계(85/95)는 admin 도서 상세(BookDetailModal CoverageCurve)와 공유 —
// 큐레이터가 보는 것과 학습자가 보는 것이 같은 기준이어야 신뢰가 유지된다.
//
//   ≥98  수월   — 거의 다 아는 단어. 유창성 읽기엔 좋지만 신규 어휘 수확 적음.
//   95–98 딱 맞아요 — 모르는 단어 ~2–5%. 맥락 추론 sweet spot (Nation 1990 · Krashen i+1).
//   85–95 도전적  — 분투가 필요하나 가능.
//   <85   어려워요 — 모르는 단어 과다 (frustration zone).

export type IPlusOneTier = 'easy' | 'ideal' | 'challenge' | 'hard';

export interface IPlusOneFit {
  /** 학습자 V레벨 시점의 커버리지(0–100) */
  coverage: number;
  tier: IPlusOneTier;
  /** 학습자 친화 라벨 */
  label: string;
  /** CSS variable 토큰 (Calm UI — easy 는 비난색 X, 중립 회색) */
  color: string;
}

/** coverage 맵에서 특정 V레벨의 값을 안전하게 추출 (compute_book_coverage 는 1..10 만 산출). */
export function coverageAtLevel(
  coverage: Record<string, number> | null | undefined,
  vLevel: number,
): number | null {
  if (!coverage) return null;
  const lv = Math.max(1, Math.min(10, vLevel));
  const v = coverage[String(lv)];
  return typeof v === 'number' ? v : null;
}

/**
 * 그림책 삽화 보정폭(pp). 삽화가 의미를 전달(Dual Coding)하므로 텍스트보다 낮은
 * lexical coverage 에서도 이해 가능 — 임계를 이만큼 낮춰 ~1 V-Level 보완 효과.
 */
const ILLUSTRATION_DISCOUNT = 7;

/**
 * 학습자 V레벨 × 도서 coverage → i+1 적합도.
 * 미진단(vLevel < 1) 또는 coverage 데이터 부재 시 null (판정 표시 안 함).
 *
 * @param illustrated 그림책(library_books.is_picture_book) 이면 임계 −7pp 완화.
 *   예: Ammachi V4 81.5% — 텍스트 기준 "어려워요"(<85) → 삽화 보정 "도전적"(≥78),
 *       V5 88.9% → "딱 맞아요"(≥88). 한국 초급(V4–V5) 학습자에게 적정 추천.
 */
export function judgeIPlusOne(
  coverage: Record<string, number> | null | undefined,
  vLevel: number,
  illustrated = false,
): IPlusOneFit | null {
  if (!vLevel || vLevel < 1) return null;
  const cov = coverageAtLevel(coverage, vLevel);
  if (cov == null) return null;

  const d = illustrated ? ILLUSTRATION_DISCOUNT : 0;
  if (cov >= 98 - d)
    return { coverage: cov, tier: 'easy', label: '수월해요', color: 'var(--t3)' };
  if (cov >= 95 - d)
    return { coverage: cov, tier: 'ideal', label: '딱 맞아요', color: 'var(--learn-known)' };
  if (cov >= 85 - d)
    return { coverage: cov, tier: 'challenge', label: '도전적', color: 'var(--learn-review)' };
  return { coverage: cov, tier: 'hard', label: '어려워요', color: 'var(--learn-error)' };
}
