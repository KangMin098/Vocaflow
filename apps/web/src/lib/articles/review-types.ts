// apps/web/src/lib/articles/review-types.ts
// ACP v1.1 — 글 검수 페이지 공유 타입 (page ↔ review client ↔ 패널/모달 공용).

import type { ArticleStatus } from './types'

/** 추출 단어 1건 — library_article_vocabularies + shared_dictionary 조인 결과 */
export interface ReviewVocab {
  rank: number
  word: string
  lemma: string | null
  firstSentence: string | null
  baseLearningValue: number | null
  frequencyInArticle: number | null
  meaningKo: string | null
  pos: string | null
  cefrLevel: string | null
  vLevel: number | null
  wordRegister: string | null
  frequencyRank: number | null
}

/** 검수 대상 글 메타 */
export interface ReviewArticle {
  id: string
  source: string
  sourceId: string
  sourceUrl: string | null
  title: string
  author: string | null
  cefrLevel: string | null
  cefrConfidence: number | null
  /** v06.51 — V-Level baseline (compute_article_vrl P75, V11 제외). select_article_vocab 게이트. */
  articleVLevel: number | null
  wordCount: number | null
  readingMinutes: number | null
  status: ArticleStatus
  statusMessage: string | null
  license: string
  copyrightSafeInKr: boolean
  publishedAt: string | null
  llmCostUsd: string | null
  content: string | null
  audioUrl: string | null
  createdAt: string
}
