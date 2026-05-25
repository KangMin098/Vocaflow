// apps/web/src/lib/admin/dict/word-search.ts
//
// /admin/vocabulary — shared_dictionary 검색 + 상세 조회 (Server-side only).
//
// 두 진입점:
//   searchDictWords(client, filters)  — 페이지 1쪽 (50개) + total count
//   fetchDictWordDetail(client, word) — 단일 단어 전체 필드

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// 검색 필터 타입
// ─────────────────────────────────────────────────────────────

export interface DictSearchFilters {
  /** word / meaning_ko / lemma_band ILIKE '%q%' (q.length>=2) */
  q?: string
  /** v_level (0-11) 또는 'null' (미분류) */
  vLevel?: number | 'null' | null
  /** CEFR (A1-C2) */
  cefr?: string | null
  /** primary_pos */
  primaryPos?: string | null
  /** source enum */
  source?: string | null
  /** verified true/false */
  verified?: boolean | null
  /** 1-based page index */
  page?: number
  /** page size (default 50) */
  limit?: number
}

// ─────────────────────────────────────────────────────────────
// 결과 row (table 표시용 — 핵심 컬럼만)
// ─────────────────────────────────────────────────────────────

export interface DictSearchRow {
  word: string
  primary_pos: string | null
  pos: string
  cefr_level: string | null
  cefr_confidence: number | null
  meaning_ko: string | null
  v_level: number | null
  v_level_rule_v1: number | null
  frequency_rank: number | null
  frequency_band: string | null
  verified: boolean | null
  source: string
  list_tags: string[] | null
  classified_by: string | null
}

export interface DictSearchResult {
  rows: DictSearchRow[]
  total: number
  page: number
  limit: number
  hasNext: boolean
}

// ─────────────────────────────────────────────────────────────
// 상세 row (모든 컬럼)
// ─────────────────────────────────────────────────────────────

export interface DictWordDetail extends DictSearchRow {
  meanings_ko: unknown | null
  senses: unknown | null
  example_en: string | null
  ipa: string | null
  ipa_uk: string | null
  ipa_us: string | null
  ngsl_sfi: number | null
  lemma_band: string | null
  pos_set: string[] | null
  synonyms: string[] | null
  antonyms: string[] | null
  collocations: string[] | null
  register: string | null
  korean_learner_note: string | null
  frequency_sources: unknown | null
  inflections: unknown | null
  /** VRL multi-dim */
  track_levels: unknown | null
  domain_levels: unknown | null
  skill_level: number | null
  skill_type: string | null
  track_levels_rule_v1: unknown | null
  domain_levels_rule_v1: unknown | null
  skill_level_rule_v1: number | null
  /** Classification provenance */
  claude_reasoning: string | null
  claude_classified_at: string | null
  vrl_calculated_at: string | null
  /** Schema Tier 1 */
  audio_url: string | null
  audio_url_uk: string | null
  audio_url_us: string | null
  image_url: string | null
  mnemonic_ko: string | null
  last_quality_audit_at: string | null
  /** timestamps */
  created_at: string | null
  updated_at: string | null
}

// ─────────────────────────────────────────────────────────────
// SELECT 컬럼 (성능 — table 용 슬림)
// ─────────────────────────────────────────────────────────────

const TABLE_COLS = [
  'word',
  'primary_pos',
  'pos',
  'cefr_level',
  'cefr_confidence',
  'meaning_ko',
  'v_level',
  'v_level_rule_v1',
  'frequency_rank',
  'frequency_band',
  'verified',
  'source',
  'list_tags',
  'classified_by',
].join(', ')

const DETAIL_COLS = '*'

// ─────────────────────────────────────────────────────────────
// searchDictWords
// ─────────────────────────────────────────────────────────────

export async function searchDictWords(
  client: SupabaseClient,
  filters: DictSearchFilters,
): Promise<DictSearchResult> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(200, Math.max(10, filters.limit ?? 50))
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client
    .from('shared_dictionary')
    .select(TABLE_COLS, { count: 'exact' })

  // 텍스트 검색 (q.length >= 2)
  if (filters.q && filters.q.trim().length >= 2) {
    const term = filters.q.trim().replace(/[%_]/g, '\\$&')
    q = q.or(
      `word.ilike.%${term}%,meaning_ko.ilike.%${term}%,lemma_band.ilike.%${term}%`,
    )
  }

  // V-Level
  if (filters.vLevel === 'null') {
    q = q.is('v_level', null)
  } else if (typeof filters.vLevel === 'number') {
    q = q.eq('v_level', filters.vLevel)
  }

  // CEFR
  if (filters.cefr) q = q.eq('cefr_level', filters.cefr)

  // primary_pos
  if (filters.primaryPos) q = q.eq('primary_pos', filters.primaryPos)

  // source
  if (filters.source) q = q.eq('source', filters.source)

  // verified
  if (filters.verified === true) q = q.eq('verified', true)
  else if (filters.verified === false) q = q.or('verified.is.null,verified.eq.false')

  // 정렬: frequency_rank ASC NULLS LAST (자주 쓰는 단어 우선)
  q = q.order('frequency_rank', { ascending: true, nullsFirst: false }).order('word')

  q = q.range(offset, offset + limit - 1)

  const { data, error, count } = await q

  if (error) {
    console.error('[searchDictWords] failed:', error.message)
    return { rows: [], total: 0, page, limit, hasNext: false }
  }

  const rows = (data ?? []) as DictSearchRow[]
  const total = count ?? rows.length
  const hasNext = offset + rows.length < total

  return { rows, total, page, limit, hasNext }
}

// ─────────────────────────────────────────────────────────────
// fetchDictWordDetail
// ─────────────────────────────────────────────────────────────

export async function fetchDictWordDetail(
  client: SupabaseClient,
  word: string,
): Promise<DictWordDetail | null> {
  const { data, error } = await client
    .from('shared_dictionary')
    .select(DETAIL_COLS)
    .eq('word', word)
    .maybeSingle()

  if (error) {
    console.error('[fetchDictWordDetail] failed:', error.message)
    return null
  }
  return (data as DictWordDetail | null) ?? null
}

// ─────────────────────────────────────────────────────────────
// fetchDictSearchFacets — drop-down 후보 값
// ─────────────────────────────────────────────────────────────

export interface DictSearchFacets {
  primaryPosList: string[]
  sourceList: string[]
  cefrLevels: string[]
}

export async function fetchDictSearchFacets(
  client: SupabaseClient,
): Promise<DictSearchFacets> {
  const { data } = await client.rpc('dict_categorical_distributions')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (data ?? {}) as any

  return {
    primaryPosList: Object.keys(d.by_primary_pos ?? {}).sort(),
    sourceList: Object.keys(d.by_source ?? {}).sort(),
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  }
}
