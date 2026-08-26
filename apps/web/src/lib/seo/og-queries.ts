// apps/web/src/lib/seo/og-queries.ts
//
// 공유 카드가 읽는 **쿼리의 단일 출처**.
//
// ── 왜 따로 뽑았나 (2026-08-26) ──────────────────────────────────────
// 만화 카드가 **제목 `Vocaflow` 짜리 빈 카드**로 나간 적이 있다. `source_archive` 로
// select 했는데 그건 `selectPdProvenance` **RPC 가 매핑한 이름**이고 표에는 `source_adapter` 다.
// PostgREST 가 400 을 냈고, 코드는 `null` 을 받아 조용히 폴백을 그렸다.
//
// **상태 200 · 14 KB 짜리 유효한 PNG 였다.** 상태 코드로도, 크기로도, 타입으로도 알 수 없다 —
// 이미지를 열어 봐야 보이는 실패다. 그런데 사람이 매번 열어 볼 수는 없다.
//
// 그래서 쿼리를 여기로 모은다. 카드는 이것으로 그리고, 회귀는 **같은 쿼리를 실제로 날려**
// 행이 오는지 본다(`__tests__/og-queries.integration.test.ts`). 컬럼 이름이 틀리면 그때 걸린다.
//
// ⚠️ 필터 조건은 **화면과 같아야 한다.** 갈라지면 화면에는 없는 콘텐츠의 카드를 그리거나,
//    있는 콘텐츠에 빈 카드를 준다.

/** PostgREST 한 건 조회 — 카드가 필요한 열만. */
export interface OgQuery {
  table: string
  /** `select=` 에 들어갈 컬럼 목록 (표 기준 이름). */
  select: string
  /** id/slug 를 받아 `?` 뒤에 붙일 필터를 만든다. */
  filter: (key: string) => string
  /** 회귀가 "행이 와야 한다" 를 확인할 때 쓸 예시 키를 고르는 방법. */
  sampleFilter: string
}

export const OG_QUERIES = {
  /** 짧은 글 — 화면과 같은 조건(published + copyright_safe). */
  article: {
    table: 'library_articles',
    select: 'title,author,cefr_level,article_v_level,word_count,feed_label,source',
    filter: (id: string) =>
      `id=eq.${encodeURIComponent(id)}&status=eq.published&copyright_safe_in_kr=is.true`,
    sampleFilter: 'status=eq.published&copyright_safe_in_kr=is.true',
  },

  /** 발행 도서 — 화면과 같은 조건. */
  book: {
    table: 'library_books',
    select: 'title,author,cefr_band,cefr_level,book_v_level,word_count,chapter_count',
    filter: (id: string) =>
      `id=eq.${encodeURIComponent(id)}&status=eq.published&copyright_safe_in_kr=is.true`,
    sampleFilter: 'status=eq.published&copyright_safe_in_kr=is.true',
  },

  /**
   * 복원 만화 — RLS 가 `status='published'` 만 열지만 **명시한다.**
   * 정책에 기대면 정책이 바뀔 때 카드가 조용히 넓어진다.
   */
  comic: {
    table: 'pd_comic_issues',
    select: 'title,series_title,issue_no,published_year,source_adapter',
    filter: (slug: string) => `slug=eq.${encodeURIComponent(slug)}&status=eq.published`,
    sampleFilter: 'status=eq.published',
  },
} as const satisfies Record<string, OgQuery>

export type OgQueryKind = keyof typeof OG_QUERIES

/** 카드가 쓸 완성된 URL. */
export function ogQueryUrl(baseUrl: string, kind: OgQueryKind, key: string): string {
  const q = OG_QUERIES[kind]
  return `${baseUrl}/rest/v1/${q.table}?${q.filter(key)}&select=${q.select}&limit=1`
}
