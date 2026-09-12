// apps/web/src/lib/articles/admin-actions.ts
//
// ACP — 글 관리 액션의 **단일 매핑표** (목록 화면 · 검수 화면 공용).
//
// 왜 파일 하나로 모았나 (2026-09-05 실측 버그):
//   검수 화면(AdminArticleReviewClient)이 자기만의 RPC_ROUTE 를 들고 있었고 거기엔
//   force-publish 하나뿐이었다. 그런데 화면의 버튼 두 개는 `admin_revert_published_article`
//   / `admin_delete_article` 을 넘기고 있었다 — 라우트는 이미 존재하는데 매핑에만 없었다.
//   결과: 확인창을 통과한 다음 **항상 "알 수 없는 액션"** 으로 끝났다. 타입 에러도,
//   빌드 경고도 없다(둘 다 그냥 string 이다). 매핑이 화면마다 따로 있으면 이 드리프트는
//   반드시 다시 난다.
//
// 회귀 락: lib/articles/__tests__/admin-actions.test.ts
//   — 두 화면의 소스에서 `rpcAction('...')` 인자를 긁어 **여기 키 집합과 일치**하는지 본다.
//
// client 전용 상수 — 'server-only' 금지(두 화면 다 'use client' 다).

/**
 * 서버 라우트를 경유하는 액션.
 *
 * SECURITY DEFINER RPC 는 `is_admin_or_curator()` 를 보는데, DEV_ADMIN_BYPASS=1 환경에는
 * 쿠키 세션이 없어 `auth.uid()=NULL` → Forbidden 이 된다. 그래서 이 셋은 브라우저에서
 * 직접 부르지 않고 requireAdmin + service_role 라우트가 동등 로직을 실행한다.
 */
export const ARTICLE_RPC_ROUTE: Record<string, string> = {
  admin_force_publish_article: '/api/admin/articles/force-publish',
  admin_revert_published_article: '/api/admin/articles/revert',
  admin_delete_article: '/api/admin/articles/delete',
}

/**
 * 브라우저에서 곧장 부르는 RPC.
 *
 * ⚠️ 실제 호출부는 이름을 **리터럴로** 적는다(`client.rpc('admin_requeue_article', …)`).
 *    변수로 넘기면 RPC 권한 감사가 정적으로 수집할 때 빠져 "아무도 안 부르는 함수" 로
 *    오분류된다. 여기 배열은 "아는 액션인가" 판정용이지 호출용이 아니다.
 *    회귀 락: lib/auth/__tests__/rpc-call-sites.test.ts
 */
export const ARTICLE_DIRECT_RPC_NAMES: readonly string[] = [
  'admin_requeue_article',
  'admin_archive_article',
]

/** 화면이 넘길 수 있는 액션 전체 — 이 집합 밖은 눌러도 아무 일이 없다는 뜻이라 예외로 알린다. */
export const ARTICLE_ADMIN_ACTIONS: readonly string[] = [
  ...Object.keys(ARTICLE_RPC_ROUTE),
  ...ARTICLE_DIRECT_RPC_NAMES,
]

export function isKnownArticleAction(name: string): boolean {
  return ARTICLE_ADMIN_ACTIONS.includes(name)
}
