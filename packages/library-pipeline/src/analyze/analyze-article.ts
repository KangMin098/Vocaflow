// packages/library-pipeline/src/analyze/analyze-article.ts
// ACP v1.0 — article 분석 통합 함수.
//
// 책(analyzeBook)과 핵심 차이:
//   1. chapter 분할 없음 — 단일 content unit
//   2. content_chunks INSERT 없음 (article 은 통째 저장)
//   3. trans actional insert RPC 없음 — service role 클라이언트로 직접 INSERT
//
// 재사용 모듈: extractBookLemmas (chapter 1개로 wrap), lookupAndEnrich, detectBookCefr
//   → extract-lemmas 의 chapter 단위 통계가 article 에 그대로 적용됨

import type { NormalizedArticle, AnalyzedArticle, ArticleWord } from '../types-article'
import { getServiceClient } from '../client'
import { extractBookLemmas } from './extract-lemmas'
import { lookupAndEnrich } from './lookup-enrich'
import { computeLearningValue } from './learning-value'
import { detectBookCefr } from './cefr-detect'

export interface AnalyzeArticleOptions {
  skipLlm?: boolean
}

/**
 * article 1개 분석 + library_article_vocabularies INSERT.
 *
 * @param articleId  library_articles.id
 * @param norm       NormalizedArticle (S3 NORMALIZE 결과)
 */
export async function analyzeArticle(
  articleId: string,
  norm: NormalizedArticle,
  options: AnalyzeArticleOptions = {},
): Promise<AnalyzedArticle> {
  const client = getServiceClient()

  // article 은 chapter 1개로 wrap — extractBookLemmas / detectBookCefr 재사용
  const pseudoChapter = {
    chapter_idx: 1,
    content: norm.body,
    word_count: countWords(norm.body),
    paragraph_offsets: [0],
    sentence_offsets: [0],
  }

  // 1. lemma 추출
  const lemmaIndex = extractBookLemmas([pseudoChapter])
  const lemmas = [...lemmaIndex.bookFrequency.keys()]

  // 2. lookup + enrich
  const enriched = await lookupAndEnrich(client, lemmas, {
    skipLlm: options.skipLlm ?? false,
  })

  // 3. LV
  const chapterWords = computeLearningValue(lemmaIndex, enriched.entries, {
    totalChapters: 1,
  })

  // 4. CEFR
  const cefr = await detectBookCefr([pseudoChapter], lemmaIndex, enriched.entries, {
    skipLlm: options.skipLlm ?? false,
  })

  // 5. ArticleWord 형식으로 변환
  const words: ArticleWord[] = chapterWords.map((w) => ({
    word: w.word,
    frequency_in_article: w.frequency_in_book, // article 전체 빈도
    first_sentence: w.first_sentence,
    base_learning_value: w.base_learning_value,
  }))

  // 6. library_article_vocabularies INSERT (chunk 분할 — 대용량 article 대비)
  //    재처리 멱등 — 기존 vocab 전량 삭제 후 재삽입 (재분석 시 중복 누적 방지).
  await client.from('library_article_vocabularies').delete().eq('library_article_id', articleId)
  if (words.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < words.length; i += CHUNK) {
      const chunk = words.slice(i, i + CHUNK)
      const { error } = await client.from('library_article_vocabularies').insert(
        chunk.map((w) => ({
          library_article_id: articleId,
          word: w.word,
          frequency_in_article: w.frequency_in_article,
          first_sentence: w.first_sentence,
          base_learning_value: w.base_learning_value,
        })),
      )
      if (error) {
        throw new Error(`library_article_vocabularies insert failed: ${error.message}`)
      }
    }
  }

  const totalWords = pseudoChapter.word_count
  const totalLlmCost = enriched.llmCost + cefr.llmCost

  return {
    article_id: articleId,
    cefr_level: cefr.level,
    cefr_confidence: cefr.confidence,
    word_count: totalWords,
    reading_minutes: Math.max(1, Math.ceil(totalWords / 200)), // article 은 평균 200 wpm
    words,
    llm_cost_usd: totalLlmCost,
  }
}

function countWords(s: string): number {
  return s.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)?.length ?? 0
}
