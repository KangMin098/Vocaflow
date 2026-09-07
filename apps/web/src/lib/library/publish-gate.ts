// apps/web/src/lib/library/publish-gate.ts
//
// 학습자 노출 게이트 단일 출처 (설계서 §4.3).
//
// 문제였던 것: "무엇이 학습자에게 보이는가"의 조건이 화면마다 흩어져 있었다.
//   · 도서   status='published' AND copyright_safe_in_kr AND published_at IS NOT NULL  (books/page.tsx)
//   · 아티클 status='published' AND copyright_safe_in_kr                                (scripts/page.tsx)
//   · 만화   comic_books.status='published' AND library_books.status='published'        (RPC 내부)
//   한 곳만 바꾸면 다른 곳이 조용히 어긋난다.
//
// 왜 SQL 뷰가 아니라 여기인가: 통합 뷰(v_library_catalog)는 소비자(통합 홈)가 생겼을 때 의미가 있다.
//   지금 뷰만 추가하면 아무도 안 쓰는 정의가 하나 더 늘 뿐이라, 실제로 쿼리를 치는 지점을 먼저 묶는다.
//
// ⚠️ 카탈로그 게이트 ≠ 열람 게이트 — 의도적으로 다르다.
//   카탈로그(목록에 뜨는가)는 published_at 까지 요구하고(정식 publish RPC 가 찍는 값),
//   열람(이미 링크를 아는 사람이 볼 수 있는가)은 status 만 본다. 만화 RPC 의 게이트와 맞춘 것으로,
//   published_at 이 비어 있는 과거 도서의 챕터/만화가 갑자기 404 가 되는 것을 막는다.

// Supabase PostgrestFilterBuilder 의 최소 구조. 제약을 `T extends Gateable<T>` 로 걸면
// 빌더 타입이 재귀 확장돼 TS2589(instantiation too deep)가 난다 — 반환 타입만 보존하고
// 내부에서 구조적으로 캐스팅한다(호출부는 빌더 타입 그대로 이어서 쓸 수 있음).
interface Gateable {
  eq(column: string, value: unknown): Gateable
  not(column: string, operator: string, value: unknown): Gateable
}

const asGate = (q: unknown) => q as Gateable

/** 도서 카탈로그 노출 게이트 — /library/books 그리드·추천·검색에 뜨는 조건. */
export function applyBookCatalogGate<T>(q: T): T {
  return asGate(q)
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .not('published_at', 'is', null) as unknown as T
}

/** 도서 열람 게이트 — 상세/리더처럼 이미 대상을 지정해 여는 경로. 만화 RPC 게이트와 동일 기준. */
export function applyBookReadGate<T>(q: T): T {
  return asGate(q).eq('status', 'published') as unknown as T
}

/** 아티클(스크립트) 카탈로그 게이트 — RLS anyone_read_published_safe_articles 와 동일 기준. */
export function applyArticleCatalogGate<T>(q: T): T {
  return asGate(q).eq('status', 'published').eq('copyright_safe_in_kr', true) as unknown as T
}
