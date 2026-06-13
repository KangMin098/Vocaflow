// packages/library-pipeline/src/index.ts
// LCP v2.0 — Public API

export * from './types'
export { loadEnv, type Env } from './env'
export { getServiceClient } from './client'

// S2 INGEST — Books (LCP)
export { ingestFromGutenberg } from './ingest/gutenberg'
export { ingestFromStandardEbooks } from './ingest/standard-ebooks'
export { ingestFromWikibooks } from './ingest/wikibooks'
export { ingestFromWikisource } from './ingest/wikisource'
export { ingestFromLibriVox } from './ingest/librivox'
export { ingestFromOpenStax } from './ingest/openstax'
export { ingestFromSimpleWikipedia } from './ingest/simple-wikipedia'

// S2 INGEST — Articles (ACP — Phase 18: VOA / Phase 19: NASA · NIH · arXiv)
export { listVoaFeed, ingestVoaArticle, VOA_FEEDS } from './ingest-article/voa'
export type { VoaListItem } from './ingest-article/voa'
export { listNasaFeed, ingestNasaArticle, NASA_FEEDS } from './ingest-article/nasa'
export type { NasaListItem } from './ingest-article/nasa'
export { listNihFeed, ingestNihArticle, NIH_FEEDS } from './ingest-article/nih'
export type { NihListItem } from './ingest-article/nih'
export { listArxivFeed, ingestArxivArticle, ARXIV_FEEDS } from './ingest-article/arxiv'
export type { ArxivListItem } from './ingest-article/arxiv'
// v06.41 feed-level + v06.42 source-level curation spec
export {
  FEED_SPECS,
  SOURCE_DEFAULT_SPEC,
  SOURCE_SPECS,
  SOURCE_RANKINGS_BY_LEVEL,
  applyArticleCurationSpec,
  applySourceLevelCap,
  scoreArticleFit,
  passesArticleFilter,
  getFeedSpec,
  getSourceSpec,
  getSourceOrderForLevel,
} from './ingest-article/_curation-spec'
export type {
  SourceKey,
  FeedSpec,
  SourceSpec,
  LearnerLevel,
  ArticleScore,
} from './ingest-article/_curation-spec'
export * from './types-article'
export { analyzeArticle } from './analyze/analyze-article'
export type { AnalyzeArticleOptions } from './analyze/analyze-article'

// S3 NORMALIZE + S4 SEGMENT (Phase 5)
export {
  normalizeBook,
  extractBody,
  normalizePunctuation,
  reflowSoftHyphens,
} from './normalize'
export { segmentBook } from './segment/segment'
export { findChapterBoundaries } from './segment/regex-segmenter'
export {
  computeParagraphOffsets,
  computeSentenceOffsets,
  countWords,
} from './segment/offset-calculator'

// S5 ANALYZE (Phase 6)
export { analyzeBook } from './analyze/analyze-book'
export type {
  AnalyzeBookOptions,
  AnalyzeBookStats,
} from './analyze/analyze-book'
// VRL v3 Krashen i+1 weight helper (Phase 2A · Stage B)
export { vLevelWeightFor, classifyLV } from './analyze/learning-value'
export type { ComputeLvOptions, UserSegment } from './analyze/learning-value'

// Phase 7 에서 활성화
// export { decideCuration } from './curate/auto-decision'
