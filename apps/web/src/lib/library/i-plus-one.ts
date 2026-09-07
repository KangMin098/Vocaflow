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

  // color 는 배지의 "글자+테두리" 에 쓰인다 → 잉크 토큰(AA 통과)을 쓴다.
  // 원색(--learn-known 등)은 종이 위 2.0~3.6:1 이라 작은 글자로 읽히지 않았다(2026-08-09 axe 실측).
  const d = illustrated ? ILLUSTRATION_DISCOUNT : 0;
  if (cov >= 98 - d)
    return { coverage: cov, tier: 'easy', label: '수월해요', color: 'var(--t2)' };
  if (cov >= 95 - d)
    return { coverage: cov, tier: 'ideal', label: '딱 맞아요', color: 'var(--learn-known-ink)' };
  if (cov >= 85 - d)
    return { coverage: cov, tier: 'challenge', label: '도전적', color: 'var(--learn-review-ink)' };
  return { coverage: cov, tier: 'hard', label: '어려워요', color: 'var(--learn-error-ink)' };
}

// ─────────────────────────────────────────────────────────────
// 글(article) i+1 — 책과 달리 coverage 컬럼이 없어 article_v_level 과
// 학습자 V레벨을 직접 비교 (C4). 미진단(0/null)은 한국 학습자 기본 V5 baseline
// (extract_vocabulary_for_user 의 effective_user_v 와 동일 규칙).
//   gap ≤ 0  수월해요 — 글 V레벨이 내 수준 이하 (대부분 아는 단어)
//   gap = +1 딱 맞아요 — i+1 sweet spot (Krashen)
//   gap = +2 도전적
//   gap ≥ +3 어려워요
// ─────────────────────────────────────────────────────────────

export interface ArticleIPlusOneFit {
  tier: IPlusOneTier;
  label: string;
  color: string;
  /** article_v_level − effectiveUserVLevel */
  gap: number;
  /** 판정에 쓰인 학습자 V레벨 (미진단이면 5) */
  effectiveUserVLevel: number;
}

export function judgeArticleIPlusOne(
  articleVLevel: number | null | undefined,
  userVLevel: number,
): ArticleIPlusOneFit | null {
  if (articleVLevel == null) return null;
  const effectiveUserVLevel = userVLevel && userVLevel > 0 ? userVLevel : 5;
  const gap = articleVLevel - effectiveUserVLevel;
  const base = { gap, effectiveUserVLevel };
  // 책 버전과 동일 규칙 — 배지 글자이므로 잉크 토큰(AA). --t3 는 텍스트 색이 아니다.
  if (gap <= 0) return { ...base, tier: 'easy', label: '수월해요', color: 'var(--t2)' };
  if (gap === 1) return { ...base, tier: 'ideal', label: '딱 맞아요', color: 'var(--learn-known-ink)' };
  if (gap === 2) return { ...base, tier: 'challenge', label: '도전적', color: 'var(--learn-review-ink)' };
  return { ...base, tier: 'hard', label: '어려워요', color: 'var(--learn-error-ink)' };
}

// ─────────────────────────────────────────────────────────────
// 챕터 단위 i+1 — **책 라벨이 가리는 진입로를 여는 자리.**
//
// 2026-08-30 실측: 발행 316권의 책 단위 난이도는 V8~V9(대학·대학원)가 187권(59%)이고
// 고1(V5) 은 2권뿐이다. 그런데 챕터로 재면 V5 챕터가 **87권에 걸쳐 263개** 있다.
// 책 라벨은 p75(상위 25% 어휘)라 책 안의 쉬운 챕터를 가린다.
//
// `chapter_v_level` 을 읽던 화면은 리더 안 ChapterSidebar 뿐이었다 — 책을 열기 전에는
// 볼 수 없었다. 그래서 카탈로그가 쓸 수 있도록 도서별 히스토그램을
// `curation_metadata.chapter_v_hist` 에 적재하고(스크립트: backfill-chapter-level-histogram.mjs)
// 여기서 판정한다.
//
// 판정 규칙은 글(article) 버전과 **같다** — gap ≤ 0 수월 · +1 딱 맞음. 둘이 갈리면
// 같은 학습자에게 자료 종류마다 다른 기준이 적용된다.
// ─────────────────────────────────────────────────────────────

/** 도서별 챕터 난이도 분포. 키는 V레벨 문자열, 값은 챕터 수. */
export type ChapterVHistogram = Record<string, number>

export interface ReadableChapters {
  /** 지금 읽을 수 있는 챕터 수 (gap ≤ +1 — 수월 + 딱 맞음) */
  count: number
  /** 그중 i+1 sweet spot(gap = +1) 챕터 수 */
  ideal: number
  /** 난이도가 매겨진 전체 챕터 수 — "몇 개" 만으로는 500장짜리 책의 20장을 판단할 수 없다 */
  total: number
  /** 판정에 쓰인 학습자 V레벨 (미진단이면 5 — 한국 학습자 baseline) */
  effectiveUserVLevel: number
}

/**
 * 학습자 수준에서 **지금 읽을 수 있는 챕터가 몇 개인지.**
 * 히스토그램이 없으면 null — 배지를 숨긴다(0개와 "모른다" 는 다르다).
 */
export function countReadableChapters(
  hist: ChapterVHistogram | null | undefined,
  userVLevel: number,
): ReadableChapters | null {
  if (!hist || Object.keys(hist).length === 0) return null
  const effectiveUserVLevel = userVLevel && userVLevel > 0 ? userVLevel : 5
  let count = 0
  let ideal = 0
  let total = 0
  for (const [level, n] of Object.entries(hist)) {
    const v = Number(level)
    if (!Number.isFinite(v) || !Number.isFinite(n) || n <= 0) continue
    total += n
    const gap = v - effectiveUserVLevel
    if (gap <= 1) count += n
    if (gap === 1) ideal += n
  }
  if (total === 0) return null
  return { count, ideal, total, effectiveUserVLevel }
}
