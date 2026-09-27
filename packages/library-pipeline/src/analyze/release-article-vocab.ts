// packages/library-pipeline/src/analyze/release-article-vocab.ts
//
// 배치 분석이 끝난 글의 어휘 행을 **남길지** 정하고, 안 남길 글이면 지운다.
//
// 왜: `library_article_vocabularies` 의 98.6% 가 발행 안 된 `ready` 글 몫이었다
//   (docs/reports/lav-retention-2026-09-24.md). 그 행을 읽는 곳은 분석 직후의
//   `compute_article_vrl` 하나이고, 결과는 `library_articles` 에 남는다. 게시·미리보기·조판은
//   행이 없으면 `ensureArticleVocab` 로 다시 만든다(§4 2~4단계). 그래서 V-Level 을 잰 뒤 걷는다.
//
// 남기는 글:
//   · `published` — 학습자 단어장의 원천이고 재발행(`republish_article_word_set`)이 읽는다.
//   · `source = 'original'`(가공 글) — 가공 콘솔 ⑦ 은 품질 게이트 「추출 비어있음」이 FAIL 이면
//     발행 버튼을 잠가 재생성까지 가지 못한다. 행이 있어야 발행할 수 있다.
// `keepAll` 은 옛 동작(전부 남김)으로 돌리는 손잡이다(스크립트의 `--keep-vocab`).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface VocabRetentionInput {
  /** 이 배치가 끝난 뒤의 글 상태 */
  status: string
  source: string
  keepAll?: boolean
}

export function shouldKeepArticleVocab(input: VocabRetentionInput): boolean {
  if (input.keepAll) return true
  if (input.status === 'published') return true
  if (input.source === 'original') return true
  return false
}

/**
 * 규칙상 안 남길 글이면 그 글의 어휘 행을 지운다. 지웠으면 true.
 * 삭제 실패는 던진다 — 조용히 넘기면 표가 다시 자라는데 아무도 모른다.
 */
export async function releaseArticleVocab(
  client: SupabaseClient,
  articleId: string,
  input: VocabRetentionInput,
): Promise<boolean> {
  if (shouldKeepArticleVocab(input)) return false
  const { error } = await client.from('library_article_vocabularies').delete().eq('library_article_id', articleId)
  if (error) throw new Error(`어휘 행 삭제 실패 (article ${articleId}): ${error.message}`)
  return true
}
