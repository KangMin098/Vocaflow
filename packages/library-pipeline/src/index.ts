// packages/library-pipeline/src/index.ts
// LCP v2.0 — Public API

export * from './types'
export { loadEnv, type Env } from './env'
export { getServiceClient } from './client'

// S2 INGEST — Books (LCP)
export { ingestFromGutenberg } from './ingest/gutenberg'
export { ingestFromStandardEbooks } from './ingest/standard-ebooks'
export { ingestFromStandardEbooksGit } from './ingest/standard-ebooks-git'
export { ingestFromStandardEbooksResilient } from './ingest/standard-ebooks-resilient'
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
// ACP §18 — English Wikipedia 정규 (FA/GA 고급 백과 · CC-BY-SA · 발행 허용).
export { ingestWikipediaArticle, listWikipediaFeed, WIKIPEDIA_FEEDS } from './ingest-article/wikipedia'
export type { WikipediaListItem } from './ingest-article/wikipedia'
// ACP §18 — PLOS (CC-BY 오픈 학술 논문 · C1-C2 심화 · 발행 허용).
export { ingestPlosArticle, listPlosFeed } from './ingest-article/plos'
export type { PlosListItem } from './ingest-article/plos'
// ACP §18 — Wikivoyage (여행 가이드 · B1-B2 · CC-BY-SA · reference 밴드 보강).
export { ingestWikivoyageArticle, listWikivoyageFeed, WIKIVOYAGE_FEEDS } from './ingest-article/wikivoyage'
export type { WikivoyageListItem } from './ingest-article/wikivoyage'
// ACP §18 — USGS (지구과학·자연재해 과학 저널리즘 · B2 · PD US Gov · 신규 도메인 · 발행 허용).
export { ingestUsgsArticle, listUsgsFeed, USGS_FEEDS } from './ingest-article/usgs'
export type { UsgsListItem } from './ingest-article/usgs'
// ACP §18 — NOAA Climate.gov (기후과학 explainer · B2-C1 · PD US Gov · climate 신규 도메인 · CSAT 최빈출).
export { ingestNoaaArticle, listNoaaFeed, NOAA_FEEDS } from './ingest-article/noaa'
export type { NoaaListItem } from './ingest-article/noaa'
// CTP DCP T2 — 결정론 order/insert 문항 생성 (LLM 0)
export { generateDcpItems, explainDcpEligibility } from './dcp/generate-items'
export type { DcpParagraphDiagnosis } from './dcp/generate-items'
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
// 조용한 저하를 막는 판단 — 분석 전에 묻는다.
export { DEGRADED_CEFR_CONFIDENCE, checkAnalysisReadiness } from './analyze/readiness'
export type { AnalysisReadiness } from './analyze/readiness'
export { ACCEPTED_WORDS_P90, ARTICLE_WPM, assessReadingLoad } from './analyze/reading-load'
export type { ReadingLoad } from './analyze/reading-load'
// lemma 추출 — Claude Code 사전 드레인이 기사와 **같은 추출기**를 써야 한다.
//   따로 만들면 드레인이 채운 낱말과 파이프라인이 찾는 낱말이 어긋난다.
// 독해 교재 단원 조립 — 지문 + 문항 + 어휘를 하나로 묶는다.
// 수능 읽기 유형 정본 + 상업 교재 제작 단계 대응표 — 커버리지의 분모다.
export { CSAT_READING_TYPES, measureCoverage } from './textbook/csat-types'
export type { CoverageReport, CsatGeneration, CsatType } from './textbook/csat-types'
export { PRODUCTION_STAGES, measureStages } from './textbook/production-stages'
export { SCHOOL_TYPES, measureSchoolCoverage } from './textbook/school-types'
export type { AnswerMode, SchoolBand, SchoolCoverage, SchoolType, SourceNeed } from './textbook/school-types'
export { PASSAGE_ORIGINS, measureOrigins } from './textbook/passage-origin'
export type { OriginKey, OriginReport, OriginRight, PassageOrigin } from './textbook/passage-origin'
export type { ProductionStage, StageReport, StageState } from './textbook/production-stages'
export {
  contentWords,
  evidenceFor,
  explainInsert,
  explainOrder,
  findConnective,
  findDemonstrative,
  findFirstMention,
  findPronoun,
  insertEvidenceBySlot,
  isPositional,
  measureExplainCoverage,
  orderEvidenceByChoice,
} from './textbook/explain'
export type { Evidence, EvidenceKind, ExplainCoverage, Explanation, Relation } from './textbook/explain'
// 학습자·교사·학부모 3관점 채점표 — 못 재는 것에는 점수를 붙이지 않는다.
export { UNIT_MINUTES, scoreVolume } from './textbook/scorecard'
export type { Audience, AutoCheck, HumanCheck, Scorecard } from './textbook/scorecard'
// 수능 인쇄 형식 변환 — 저장 형식·학습 화면은 그대로 두고 표현만 바꾼다.
export {
  CSAT_INSERT_BODY,
  CSAT_INSERT_BODY_SENTENCES,
  CSAT_INSERT_SLOTS,
  pickSlots,
  ORDER_PERMS,
  splitIntoThree,
  toCsatInsert,
  toCsatOrder,
} from './textbook/csat-format'
export type { CsatInsertItem, CsatOrderItem } from './textbook/csat-format'
// 풀 기반 단원 조합 — 문항 자체가 수능 규격 지문이다(실측 중앙값 114어).
export {
  CSAT_ITEM_WORDS,
  DEFAULT_SLOTS,
  MAX_WORD_APPEARANCES,
  composeUnits,
  roundRobinByRef,
} from './textbook/compose-unit'
export type { ComposeOptions, ComposeResult, PoolItem, Unit } from './textbook/compose-unit'
export {
  MINUTES_PER_ITEM,
  MINUTES_PER_VOCAB,
  UNIT_READ_WPM,
  assembleReadingUnit,
  isBlocked,
  pickVocabulary,
} from './textbook/assemble-unit'
export type {
  AssembleOptions,
  ReadingUnit,
  UnitBlocked,
  UnitItem,
  UnitItemType,
  UnitPassage,
  UnitVocab,
} from './textbook/assemble-unit'
export { extractBookLemmas } from './analyze/extract-lemmas'
export type { BookLemmaIndex } from './analyze/extract-lemmas'
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

// ACP §20 COMPOSE — 사실 재저작. 소스 본문을 저장·복제하지 않고 지문으로만 대조한다.
export {
  DEFAULT_SHINGLE_N,
  buildFingerprint,
  containment,
  findVerbatimRuns,
  jaccard,
  sharedCount,
  tokenize,
} from './compose/fingerprint'
export type { Fingerprint, VerbatimRun } from './compose/fingerprint'
// 재저작·적응 글의 출처 표기 — 본문에 넣되 지문 대조에서는 뺀다.
export {
  ADAPTATION_PREFIX,
  ATTRIBUTION_PREFIX,
  buildAdaptationAttribution,
  buildAttribution,
  stripAttribution,
  withAttribution,
} from './compose/attribution'

// 외부 플랫폼 기준선 — "글로벌 수준 이상" 을 숫자로 고정한다(숫자만 보관, 본문 비보관).
// RSS 가 없는 섹션에서 기사 목록 — RSS 와 같은 모양을 돌려준다.
export { MAX_SECTION_ITEMS, inspectSectionPage, parseSectionPage } from './compose/section-page'
// 후보 피드 프로브가 파이프라인과 **같은 파서**를 써야 한다 — 따로 만들면 프로브가
//   통과시킨 피드를 파이프라인이 못 읽는 일이 생긴다.
export { parseRssFeed } from './ingest-article/_helpers'
export type { RssListItem } from './ingest-article/_helpers'

// 발주 어수와 원장 사실 수의 짝 — 판정이 아니라 예보다.
export { OBSERVED_FACT_DENSITY, assessFactDensity } from './compose/review'
export type { FactDensityAssessment, FactDensityVerdict } from './compose/review'

export { BENCHMARK_SAMPLES, benchmarkBar, compareToBenchmark } from './compose/benchmark'
export type { BenchmarkBar, BenchmarkResult, BenchmarkSample, BenchmarkVerdict } from './compose/benchmark'

// 제목 기반 학습 적합성 — 피드 순위·천장 측정용(개별 판정용 아님).
export {
  KOREAN_PUBLISHERS,
  classifyTopic,
  fitnessRatio,
  hasKoreaContext,
  isKoreaRelevant,
  koreanOutlets,
  learnerPriority,
} from './compose/topic-fitness'
export type { TopicFitness } from './compose/topic-fitness'

// 초안 검수 — 게이트가 보지 않는 것. 잰 것과 판단이 필요한 것을 나눠 돌려준다.
export { REVIEW_JUDGE_CHECKLIST, reviewDraft } from './compose/review'
export type { ReviewFinding, ReviewInput, ReviewMetrics, ReviewReport } from './compose/review'

// 레벨 적응 — 라이선스 보유 글의 쉬운 판. 게이트가 재저작과 다르다.
export { isAdaptationPublishable, runAdaptationGates } from './compose/adaptation'
export type { AdaptationInput } from './compose/adaptation'

export {
  COMPOSE_THRESHOLDS,
  checkExpressionIndependence,
  checkPublicationDelay,
  checkQuotePolicy,
  checkShelfDuplication,
  checkSourceIndependence,
  checkStructureIndependence,
  collapseSyndication,
  isComposePublishable,
  runComposeGates,
  shelfRecordFrom,
  spearman,
} from './compose/gates'
export type {
  ComposeDraft,
  ComposeGateInput,
  FactCard,
  GateResult,
  GateVerdict,
  SourceRecord,
} from './compose/gates'
export {
  BODY_RETENTION,
  EXCLUDED_FACT_SOURCES,
  FACT_SOURCES,
  acpOverlap,
  allTopics,
  feasibleTopics,
  isAlsoAcpSource,
  isCollectRole,
  isCollectable,
  isFeedCollectable,
  roleViolations,
  rolesOf,
  MEASURED_PAIR_INDEPENDENCE,
  measuredIndependence,
  isPublisherHost,
  lineOf,
  planFactSources,
  topicsUnlockedByPlanned,
} from './compose/sources'
export type {
  AccessBasis,
  AccessPolicy,
  FactSourcePlan,
  FactSourceSpec,
  FactSourceTier,
  FactSourceWiring,
  PlanOptions,
} from './compose/sources'
// 접근 규율 — robots·요청 간격·본문 비보관. 상업 뉴스를 읽는 절차의 정본.
export {
  COMPOSE_USER_AGENT,
  CrawlGate,
  DEFAULT_MIN_INTERVAL_MS,
  groupFor,
  isPathAllowed,
  parseRobots,
  readForFacts,
} from './compose/access'
export type { AccessDecision, FactRead, Robots, RobotsGroup, RobotsRule } from './compose/access'
// 상업 뉴스 수집 — 발견(피드) · 사건 묶기 · 읽기(지문만)
export {
  countIndependentLines,
  discoverStories,
  primeRobots,
  readStoryForFacts,
} from './compose/news-feed'
export type {
  ComposeSourceRow,
  DiscoverOptions,
  DiscoverResult,
  FetchDeps,
  FetchResult,
  ReadStoryResult,
  RobotsOutcome,
  StoryCandidate,
} from './compose/news-feed'
export {
  CLUSTER_THRESHOLDS,
  clusterStories,
  diceCoefficient,
  headlineTokens,
  sameEvent,
} from './compose/cluster'
export type { StoryCluster } from './compose/cluster'
// 피드 자동 발견 — 관리자가 주소를 찾아 오지 않게 한다.
export {
  FEED_CONVENTIONS,
  FEED_FAILURE_ACTION,
  FEED_MAX_AGE_DAYS,
  discoverFeeds,
  looksLikeFeed,
  parseFeedAnchors,
  parseFeedLinks,
  verifyFeedUrl,
} from './compose/feed-discovery'
export type {
  DiscoverFeedsOptions,
  DiscoverFeedsResult,
  DiscoveredFeed,
  FeedFailureKind,
  FeedSkip,
} from './compose/feed-discovery'
// 기사 URL -> 본문 추출. 피드가 없거나 어려운 발행사의 우회로.
export {
  MIN_ARTICLE_WORDS,
  extractArticle,
  fromJsonLd,
  splitSentences,
  trimBoilerplate,
} from "./compose/extract"
export type { ExtractVia, ExtractedArticle } from "./compose/extract"
export { collectStories, toBatchRow } from './compose/collect'
export type { CollectOptions, CollectReport, FeedConfig } from './compose/collect'
// 가공 — 지문 1편 → 활동 N개. 기계 변환은 재생성 무료·멱등.
export {
  COMPOSE_ACTIVITIES,
  GAPFILL_DEFAULTS,
  buildGapFill,
  buildSpellingItems,
  mechanicalActivities,
  planActivities,
} from './compose/activities'
export type {
  ActivityAvailability,
  ActivityCost,
  ActivitySpec,
  GapBlank,
  GapFillItem,
  SpellingItem,
} from './compose/activities'
// 어휘 스파인 — 초등부터 대입까지 하나의 난이도 축(V-Level). 학령 밴드는 그 축의 구간이다.
export {
  BAND_CONSTRAINT,
  GRADE_BANDS,
  SPINE_AXIS,
  REGISTER_FLOOR,
  bandForVLevel,
  checkRegisterFloor,
  meanWordChars,
  bandForVRange,
  evaluateBand,
  profileBand,
  tokenizeForBand,
} from './compose/spine'
export type {
  BandConstraint,
  BandConstraintKind,
  BandProfile,
  GradeBand,
  GradeBandKey,
  SpineWord,
} from './compose/spine'
// 학습 유형 — 발주의 1급 축. 소스·처리·결과물을 전부 가른다.
export {
  LEARNING_TYPES,
  buildJobSpec,
  composableTracks,
  renderJobBrief,
  sourcesForType,
  trackCoverage,
  validateLearningTypes,
} from './compose/learning-types'
export type {
  ComposeConstraints,
  ComposeJobSpec,
  LearningTrack,
  LearningTypeSpec,
  LexicalSkill,
  Register,
  TypeSourcePlan,
} from './compose/learning-types'

// Phase 7 에서 활성화
// export { decideCuration } from './curate/auto-decision'
