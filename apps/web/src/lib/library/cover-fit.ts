// apps/web/src/lib/library/cover-fit.ts
//
// 표지 이미지를 3:4 카드 슬롯에 어떻게 앉힐지 — 카드마다 다시 정하지 않도록 한 곳에 둔다.
//
// ── 왜 필요한가 (실측 2026-08-15) ──────────────────────────────────
// 카드 슬롯은 이미 `aspect-[3/4]` 로 통일돼 있다. 통일되지 않은 것은 **원본 비율**이고,
// `object-cover` 는 부족한 쪽을 잘라서 채우므로 그 차이가 잘림으로 나타난다:
//
//   Gutenberg  200x281 / 200x299  (0.67~0.71)  → 상하 5~11% 잘림   ← 허용
//   Standard Ebooks 1400x2100     (0.667)      → 상하 11% 잘림     ← 허용
//   StoryWeaver 959x460 / 3351x1605 (2.09)     → **좌우 64% 잘림** ← 그림이 사라진다
//
// StoryWeaver 표지는 사실 표지가 아니라 **삽화 가로 크롭**(`illustration_crops/…`)이다.
// 세로 슬롯에 `object-cover` 로 넣으면 인물도 제목도 화면 밖으로 나간다.
//
// ── 판정 신호 ──────────────────────────────────────────────────────
// URL 패턴(`illustration_crops`)으로 가르지 않는다 — 호스트가 바뀌면 조용히 틀린다.
// `is_picture_book` 은 이미 카탈로그에 있고 **의미가 정확히 맞는다**: 그림책의 표지는
// 삽화에서 잘라 온 가로 이미지다. 새 컬럼도, 이미지 사전 측정도 필요 없다.

/** 3:4 슬롯에서의 표지 배치. */
export interface CoverFit {
  /** next/image className 에 넣을 object-fit */
  objectFit: 'object-cover' | 'object-contain'
  /**
   * 뒤에 같은 이미지를 흐리게 깔아 여백을 메울지.
   * contain 은 레터박스를 남기는데, 검은 띠보다 흐린 확대본이 카드 결을 덜 깬다.
   */
  blurBackdrop: boolean
}

/**
 * 표지 배치 결정.
 *
 * 그림책(가로 삽화 크롭) → `contain` + 블러 배경: 그림을 온전히 보여준다.
 * 그 외(세로 표지)      → `cover`: 상하 10% 안팎 잘림은 표지 디자인이 견디는 범위다.
 */
export function coverFitFor(book: { is_picture_book?: boolean | null }): CoverFit {
  if (book.is_picture_book) {
    return { objectFit: 'object-contain', blurBackdrop: true }
  }
  return { objectFit: 'object-cover', blurBackdrop: false }
}
