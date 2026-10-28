// apps/web/src/lib/learner/reader-article-practice.ts
// R0 — Reader(/text/[id]) 의 「이 기사에 연습이 있는가」 세 상태. 조회 실패를 「연습 0」 으로 뭉개지 않는다(T-0204).
// 예전 layout 은 `article_practice_items` 의 error 를 버리고 행이 비면 링크를 두지 않아, 실패와 0 이 같은 화면이었다.
// 실패면 같은 RPC 를 화면에서 다시 부르지 않는다 — 기존 연습 페이지(/practice/article/<id>)로 가는 링크 하나만 둔다.
//   그 페이지 loader 가 계정 · 본인 글 · 판본 · 현재 문항을 다시 확인한다(자동 재시도 · 반복 없음).
// ⚠️ 문항(payload)은 화면으로 넘기지 않는다 — 상태와 연습 주소만. 정답 · 해설은 이 RPC 가 애초에 돌려주지 않는다.

import { keepCentralMeaningRows } from './article-practice-contract'

export type ReaderArticlePractice =
  | { state: 'available'; href: string }
  | { state: 'none' }
  | { state: 'failed'; href: string }

/**
 * RPC 응답 하나를 세 상태로.
 * - error · 배열 아님(null 등) · 행은 있는데 알려진 화면 모양(keepCentralMeaningRows)이 하나도 아님 → failed
 * - 정상 빈 배열 → none(예전처럼 링크 없음)
 * - 정상 행 → available
 */
export function classifyPracticeLookup(articleId: string, res: { data: unknown; error: unknown }): ReaderArticlePractice {
  const href = `/practice/article/${articleId}`
  if (res.error || !Array.isArray(res.data)) return { state: 'failed', href }
  if (res.data.length === 0) return { state: 'none' }
  return keepCentralMeaningRows(res.data).length > 0 ? { state: 'available', href } : { state: 'failed', href }
}
