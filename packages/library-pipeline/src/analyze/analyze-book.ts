// packages/library-pipeline/src/analyze/analyze-book.ts
// LCP v2.0 — 책 1권 전체 분석 통합 함수

import type {
  NormalizedBook,
  ChapterSegment,
  AnalyzedBook,
  ChapterWord,
} from '../types'
import { getServiceClient } from '../client'
import { extractBookLemmas } from './extract-lemmas'
import { lookupAndEnrich } from './lookup-enrich'
import { computeLearningValue } from './learning-value'
import { detectBookCefr } from './cefr-detect'
import { storeChapterChunks } from './content-store'

export interface AnalyzeBookOptions {
  /** OPENAI_API_KEY 미설정/테스트 환경 — LLM 단계 skip */
  skipLlm?: boolean
}

export interface AnalyzeBookStats {
  hitCount: number
  missCount: number
  enrichedCount: number
  llmCostUsd: number
}

/**
 * 책 1권 전체 분석:
 *  1) content_chunks INSERT (chapter별)
 *  2) lemma 통합 추출 (WLP)
 *  3) shared_dictionary lookup + LLM enrichment
 *  4) LV Score 계산
 *  5) CEFR 3중 합의
 *  6) library_chapters_master + library_book_vocabularies INSERT (트랜잭션)
 *
 * @param bookId   library_books.id (이미 생성된 row의 id)
 * @param _norm    S3 NORMALIZE 결과 (현재는 미사용 — 향후 stat 용도)
 * @param chapters S4 SEGMENT 결과
 */
export async function analyzeBook(
  bookId: string,
  _norm: NormalizedBook,
  chapters: ChapterSegment[],
  options: AnalyzeBookOptions = {},
): Promise<AnalyzedBook & { stats: AnalyzeBookStats }> {
  const client = getServiceClient()

  // 1. content_chunks INSERT
  const chapterHashes = await storeChapterChunks(
    client,
    chapters.map((ch) => ch.content),
  )

  // 2. lemma 추출
  const lemmaIndex = extractBookLemmas(chapters)

  // 3. lookup + enrich
  const lemmas = [...lemmaIndex.bookFrequency.keys()]
  const enriched = await lookupAndEnrich(client, lemmas, {
    skipLlm: options.skipLlm ?? false,
  })

  // 4. LV Score
  const words: ChapterWord[] = computeLearningValue(
    lemmaIndex,
    enriched.entries,
    { totalChapters: chapters.length },
  )

  // 5. CEFR
  const cefr = await detectBookCefr(chapters, lemmaIndex, enriched.entries, {
    skipLlm: options.skipLlm ?? false,
  })

  // 6. INSERT (트랜잭션)
  const totalWords = chapters.reduce((s, ch) => s + ch.word_count, 0)

  const { error } = await client.rpc('insert_book_analysis', {
    p_book_id: bookId,
    p_chapters: chapters.map((ch, i) => ({
      chapter_idx: ch.chapter_idx,
      chapter_title: ch.chapter_title ?? '',
      group_label: ch.group_label ?? null,
      content_hash: chapterHashes[i],
      word_count: ch.word_count,
      cefr_level: cefr.level,
      paragraph_offsets: ch.paragraph_offsets,
      sentence_offsets: ch.sentence_offsets,
    })),
    p_words: words,
  })

  if (error) {
    throw new Error(`insert_book_analysis failed: ${error.message}`)
  }

  const totalLlmCost = enriched.llmCost + cefr.llmCost

  return {
    book_id: bookId,
    cefr_level: cefr.level,
    cefr_confidence: cefr.confidence,
    word_count: totalWords,
    chapter_count: chapters.length,
    reading_minutes: Math.ceil(totalWords / 150),
    words,
    llm_cost_usd: totalLlmCost,
    stats: {
      hitCount: enriched.hitCount,
      missCount: enriched.missCount,
      enrichedCount: enriched.enrichedCount,
      llmCostUsd: totalLlmCost,
    },
  }
}
