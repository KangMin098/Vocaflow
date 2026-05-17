// packages/library-pipeline/src/index.ts
// LCP v2.0 — Public API

export * from './types'
export { loadEnv, type Env } from './env'
export { getServiceClient } from './client'

// S2 INGEST (Phase 4 — Gutenberg / Phase 13 — Standard Ebooks)
export { ingestFromGutenberg } from './ingest/gutenberg'
export { ingestFromStandardEbooks } from './ingest/standard-ebooks'

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

// Phase 7 에서 활성화
// export { decideCuration } from './curate/auto-decision'
