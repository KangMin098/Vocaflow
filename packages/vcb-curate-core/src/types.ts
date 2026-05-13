// packages/vcb-curate-core/src/types.ts
// VCB 큐레이션 + 발행 공유 타입.
// Server Action (apps/web) 과 CLI (scripts/vcb/) 양쪽 호출자가 동일 타입 사용.

import type {
  RunStatus,
  QueueStatus,
  SeedOrigin,
  Pos,
  Cefr,
  Segment,
  EnrichedItem,
} from '@vocaflow/vcb-core'

export type {
  RunStatus,
  QueueStatus,
  SeedOrigin,
  Pos,
  Cefr,
  Segment,
  EnrichedItem,
}

// ── Run summary / detail ──────────────────────────

export interface RunSummary {
  id: number
  collection_slug: string
  collection_title: string
  status: RunStatus
  target_segment: Segment | null
  target_count: number | null
  seed_count: number
  pending_count: number
  enriched_count: number
  flagged_count: number
  failed_count: number
  approved_count: number
  created_at: string
  updated_at: string
}

export interface RunConfig {
  target_cefr_range?: string[]
  target_segment?: Segment
  seed_method?: 'upload' | 'ai_generated' | 'hybrid'
  seed_spec_file?: string | null
  seed_list_file?: string | null
  description?: string
  cover_emoji?: string
  sources?: number[]
}

export interface RunDetail extends RunSummary {
  config: RunConfig
  source_count: number
}

// ── Queue list / detail ───────────────────────────

export type CurationDecisionKind = 'approve' | 'reject' | 'edit' | 'reenrich'

export interface QueueListItem {
  queue_id: number
  lemma: string
  pos: Pos
  status: QueueStatus
  qa_flags: string[]
  rank_in_run: number | null
  seed_origin: SeedOrigin
  cefr: Cefr | null
  confidence: number | null
  latest_decision: CurationDecisionKind | null
  ngsl_rank: number | null
}

export interface DefinitionKo {
  sense: string
  register: 'formal' | 'neutral' | 'informal'
}

export interface DefinitionEn {
  sense: string
}

export interface ExamplePair {
  en: string
  ko: string
}

export interface QueuePayload {
  ipa: string | null
  cefr: Cefr | null
  definitions_ko: DefinitionKo[]
  definitions_en: DefinitionEn[]
  examples: ExamplePair[]
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  korean_learner_note: string | null
  confidence: number
}

export interface DecisionHistoryEntry {
  decision: CurationDecisionKind
  note: string | null
  decided_at: string
}

export interface QueueDetail {
  queue_id: number
  lemma: string
  pos: Pos
  status: QueueStatus
  qa_flags: string[]
  seed_origin: SeedOrigin
  payload: QueuePayload
  ngsl_rank: number | null
  latest_decision: CurationDecisionKind | null
  decision_history: DecisionHistoryEntry[]
}

// ── Curation actions ──────────────────────────────

export interface CurationContext {
  decided_by: string | null
}

export interface CurationActionResult {
  ok: boolean
  decision_id?: number
  error?: string
  slash_command?: string
}

export interface BulkActionResult {
  ok: boolean
  affected: number
  failed: number
  errors: string[]
}

// ── Precheck ──────────────────────────────────────

export interface PrecheckStats {
  queue_total: number
  queue_pending: number
  queue_enriched: number
  queue_enriched_flagged: number
  queue_failed: number
  flagged_without_decision: number
  rejected_by_curator: number
  publishable_count: number
  target_segment: string | null
  target_segment_valid: boolean
  existing_max_version: number
}

export interface PrecheckResult {
  ok: boolean
  run_id: number
  blockers: string[]
  warnings: string[]
  stats: PrecheckStats
}

// ── Publish ───────────────────────────────────────

export interface PublishContext {
  published_by: string | null
}

export interface PublishResult {
  ok: boolean
  shared_word_set_id?: string
  collection_id?: number
  version?: number
  published_count?: number
  error?: string
}

// ── Filter / sort (큐레이션 리스트) ──────────────

export type CurationFilter =
  | 'all'
  | 'flagged'
  | 'rejected'
  | 'unreviewed'
  | 'ai_seed'

export type CurationSort =
  | 'ngsl_rank_asc'
  | 'cefr_asc'
  | 'confidence_desc'
  | 'origin'

export interface QueueListQuery {
  run_id: number
  filter?: CurationFilter
  sort?: CurationSort
  limit?: number
  offset?: number
}
