// packages/vcb-core/src/types.ts
// CLAUDE.md §19.3 ENUM/CHECK 미러링

export type LicenseTier = 'T1' | 'T2' | 'T3'

export type RunStatus =
  | 'created'
  | 'ingesting'
  | 'normalized'
  | 'extracted'
  | 'looked_up'
  | 'enriching'
  | 'qa'
  | 'curating'
  | 'publishing'
  | 'published'
  | 'failed'

export type QueueStatus =
  | 'pending'
  | 'exported'
  | 'enriched'
  | 'enriched_flagged'
  | 'failed'
  | 'skipped'

export type SourceKind =
  | 'frequency_list'
  | 'corpus'
  | 'dictionary'
  | 'curated_list'
  | 'ai_generated'

export type SeedOrigin = 'extracted' | 'ai_generated' | 'manual'

export type Pos = 'NOUN' | 'VERB' | 'ADJ' | 'ADV' | 'PREP' | 'CONJ' | 'PRON' | 'DET' | 'INTJ'

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type FrequencyTier = 'core' | 'common' | 'moderate' | 'rare'

export type Segment =
  | 'middle_school'
  | 'high_school'
  | 'toeic'
  | 'business'
  | 'academic'
  | 'civil_service'
  | 'general'

// ─── DB Row Shapes ─────────────────────────────────

export interface VocabSourceRow {
  id: number
  slug: string
  title: string
  kind: SourceKind
  license_tier: LicenseTier
  citation: string
  url: string | null
  language: string
  notes: string | null
  created_at: string
}

export interface VocabRunRow {
  id: number
  collection_slug: string
  collection_title: string
  status: RunStatus
  config: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VocabSeedCandidateRow {
  id: number
  run_id: number
  lemma: string
  pos: Pos
  raw_count: number
  normalized_freq: number | null
  rank_in_run: number | null
  context_samples: string[]
  seed_origin: SeedOrigin
  created_at: string
}

// ─── Seed Spec (Method B 입력) ─────────────────────

export interface SeedSpec {
  spec_id: number
  collection_slug: string
  collection_title: string
  target_count: number
  target_cefr_range: Cefr[]
  target_segment: Segment
  domain_hints: string[]
  must_include_keywords: string[]
  must_exclude_keywords: string[]
  reference_seeds: string
  license_constraint: string
  output_format: 'jsonl'
}

// ─── Seed List Item (Method B 출력) ────────────────

export interface SeedListItem {
  lemma: string
  pos: Pos
  cefr_estimate: Cefr
  frequency_tier: FrequencyTier
  rationale_short: string
  confidence: number
}

// ─── Validation Result ─────────────────────────────

export interface ValidationReport {
  spec_id?: number
  total_input: number
  total_passed: number
  total_failed: number
  errors: Array<{
    line: number
    code: string
    message: string
  }>
  cefr_distribution?: Record<Cefr, number>
  confidence_avg?: number
}

// ─── Dictionary Lookup (Step 4) ────────────────────

export type DictHitLevel = 'full' | 'partial' | 'miss'

export type DictSourceTable = 'shared_dictionary' | 'word_lexicon' | null

export interface DictHitRow {
  id: number
  seed_id: number
  hit_level: DictHitLevel
  source_table: DictSourceTable
  existing_payload: Record<string, unknown> | null
  missing_fields: string[]
  checked_at: string
}

// ─── Enrichment Queue (Step 5) ─────────────────────

export interface EnrichmentQueueRow {
  id: number
  seed_id: number
  status: QueueStatus
  hit_level: DictHitLevel | null
  missing_fields: string[] | null
  exported_job_file: string | null
  enriched_job_file: string | null
  exported_at: string | null
  enriched_at: string | null
  enriched_payload: Record<string, unknown> | null
  qa_flags: string[]
  retry_count: number
  last_error: string | null
  created_at: string
  updated_at: string
}

// JSONL 입력 (export 시 작성, /vcb-enrich 가 읽음)
export interface EnrichmentJobLine {
  queue_id: number
  lemma: string
  pos: Pos
  missing_fields: string[] | null
  existing_payload: Record<string, unknown> | null
  context_hint: string | null
}

// JSONL 출력 (/vcb-enrich 가 작성, 05d-import 가 읽음)
export interface EnrichedItem {
  queue_id: number
  lemma: string
  pos: Pos
  ipa: string | null
  cefr: Cefr | null
  definitions_ko: Array<{ sense: string; register: 'formal' | 'neutral' | 'informal' }>
  definitions_en: Array<{ sense: string }>
  examples: Array<{ en: string; ko: string }>
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  korean_learner_note: string | null
  confidence: number
}

// /vcb-enrich 가 unknown/error 시 출력하는 형태
export interface EnrichedSkipItem {
  queue_id: number
  lemma: string
  pos: Pos
  error: string
  skip: true
}

export type EnrichedLine = EnrichedItem | EnrichedSkipItem

export function isEnrichedSkip(item: EnrichedLine): item is EnrichedSkipItem {
  return 'skip' in item && item.skip === true
}

// ─── Shared Dictionary 정의는 의도적으로 미정 ───────
// 실제 shared_dictionary 스키마(2026-05-13 검증)는 04-dict-lookup.ts 의
// local SharedDictRawRow 가 보유. enrichment payload 의 풍부한 구조와
// 별개의 데이터 모델이므로 공통 export 하지 않음.
// 옵션 C (vcb_dictionary_cache, §19 미정 항목 #1) 도입 시 여기 정식 타입 추가.

// ─── QA Gate (Step 6) ──────────────────────────────

export type QaSeverity = 'reject' | 'flag' | 'auto_fix'

export interface QaFlag {
  code: string
  severity: QaSeverity
  message: string
  field?: string
}

export interface QaResult {
  passed: boolean
  flags: QaFlag[]
  fixed_item?: Record<string, unknown>
}

/** QA 결과 → queue.status 전환 매핑. */
export function qaResultToQueueStatus(
  result: QaResult
): 'enriched' | 'enriched_flagged' | 'failed' {
  if (!result.passed) return 'failed'
  if (result.flags.length > 0) return 'enriched_flagged'
  return 'enriched'
}

// ─── Curation (Step 7) ─────────────────────────────

export type CurationDecision = 'approve' | 'reject' | 'edit' | 'reenrich'

export interface CurationDecisionRow {
  id: number
  queue_id: number
  decision: CurationDecision
  edited_payload: Record<string, unknown> | null
  note: string | null
  decided_by: string | null
  decided_at: string
}
