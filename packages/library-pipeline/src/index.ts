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
export { ingestFromLit2Go } from './ingest/lit2go'
export { ingestFromStoryWeaver } from './ingest/storyweaver'
// LCP T-2 (α) — Pressbooks OA book (OBP 동결 해제 retarget · CC-BY 서버렌더 HTML)
export { ingestFromPressbooks } from './ingest/pressbooks'

// S2 INGEST — Articles (ACP — VOA / NASA / NIH + v06.66 wikinews/the_conversation/simple_wikipedia.
// v06.69 arXiv 제거 — 사용자 명시 플랫폼 전체 삭제)
export { listVoaFeed, ingestVoaArticle, VOA_FEEDS } from './ingest-article/voa'
export type { VoaListItem } from './ingest-article/voa'
export { listNasaFeed, ingestNasaArticle, NASA_FEEDS } from './ingest-article/nasa'
export type { NasaListItem } from './ingest-article/nasa'
export { listNihFeed, ingestNihArticle, NIH_FEEDS } from './ingest-article/nih'
export type { NihListItem } from './ingest-article/nih'
// ACP §18 — Simple English Wikipedia (MediaWiki API · A2~B1 설명문). v06.66 listFeed.
export {
  ingestSimpleWikipediaArticle,
  listSimpleWikipediaFeed,
  SIMPLE_WIKIPEDIA_FEEDS,
} from './ingest-article/simple-wikipedia'
export type { SimpleWikipediaListItem } from './ingest-article/simple-wikipedia'
// ACP §18 — The Conversation (CC-BY-ND 논증문 · display_only). v06.66 listFeed.
export {
  ingestTheConversationArticle,
  listTheConversationFeed,
  THE_CONVERSATION_FEEDS,
} from './ingest-article/the-conversation'
export type { TheConversationListItem } from './ingest-article/the-conversation'
// ACP §18 — Wikinews (CC-BY 시사). v06.66 listFeed.
export {
  ingestWikinewsArticle,
  listWikinewsFeed,
  WIKINEWS_FEEDS,
} from './ingest-article/wikinews'
export type { WikinewsListItem } from './ingest-article/wikinews'
// ACP §18 T-2 — Our World in Data (CC-BY 데이터 논증문 · 발행 허용).
export {
  ingestOwidArticle,
  listOwidFeed,
  OWID_FEEDS,
} from './ingest-article/owid'
export type { OwidListItem } from './ingest-article/owid'
// ACP §18 — CIA World Factbook (PD 국가 개요 참고문 · reference gap 보강 · 발행 허용).
export {
  ingestFactbookArticle,
  listFactbookFeed,
  factbookUrl,
  FACTBOOK_COUNTRIES,
} from './ingest-article/factbook'
export type { FactbookListItem, FactbookCountry } from './ingest-article/factbook'
// ACP §18 — eLife digest (편집자 저작 과학 요약 · CC-BY · 발행 허용).
export { ingestElifeArticle, listElifeFeed } from './ingest-article/elife'
export type { ElifeListItem } from './ingest-article/elife'
// CTP DCP T2 — 결정론 order/insert 문항 생성 (LLM 0)
export { generateDcpItems } from './dcp/generate-items'
export type { DcpItem, DcpItemType } from './dcp/generate-items'
// ACP §18 §4-C — 텍스트 청결(어휘 노이즈) 산출
export { computeLexicalNoise } from './ingest-article/_helpers'
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
  resolveArticleRegister,
  FEED_REGISTER,
  SOURCE_REGISTER_DEFAULT,
} from './ingest-article/_curation-spec'
export type {
  SourceKey,
  FeedSpec,
  SourceSpec,
  LearnerLevel,
  ArticleScore,
} from './ingest-article/_curation-spec'
// ACP §18 — SourcePolicy (큐레이션/학습자 화면 공유 분기 출처). client 는 /curation-spec 서브패스로.
export {
  getSourcePolicy,
  resolveSourcePolicy,
  isSourceKey,
  licenseClassOf,
  SOURCE_POLICIES,
  SUPPLY_LABEL,
  MEDIA_LABEL,
  DERIVATION_LABEL,
  ATTRIBUTION_LABEL,
} from './ingest-article/_curation-spec'
export type {
  SourcePolicy,
  SupplyMode,
  MediaMode,
  DerivationMode,
  AttributionMode,
  LicenseClass,
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
