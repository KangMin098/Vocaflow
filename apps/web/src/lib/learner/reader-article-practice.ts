// apps/web/src/lib/learner/reader-article-practice.ts
// R0 — Reader(/text/[id]) 의 「이 기사에 연습이 있는가」 세 상태. 조회 실패를 「연습 0」 으로 뭉개지 않는다(T-0204).
// 예전 layout 은 `article_practice_items` 의 error 를 버리고 행이 비면 링크를 두지 않아, 실패와 0 이 같은 화면이었다.
// ⚠️ 문항(payload)은 화면으로 넘기지 않는다 — 상태와 연습 주소만. 정답·해설은 이 RPC 가 애초에 돌려주지 않는다.

export type ReaderArticlePractice =
  | { state: 'available'; href: string }
  | { state: 'none' }
  | { state: 'failed'; articleId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** RPC 응답 하나를 세 상태로. error 가 있거나 data 가 배열이 아니면 failed(없음이 아니다). */
export function classifyPracticeLookup(articleId: string, res: { data: unknown; error: unknown }): ReaderArticlePractice {
  if (res.error || !Array.isArray(res.data)) return { state: 'failed', articleId }
  return res.data.length > 0 ? { state: 'available', href: `/practice/article/${articleId}` } : { state: 'none' }
}

export function isPracticeArticleId(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}
