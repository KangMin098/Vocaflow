// apps/web/src/lib/lexicon/queries.ts
//
// Lexicon v2.1 Supabase 조회 헬퍼.
//
// - DI: SupabaseClient 를 인자로 받음 (server.ts / client.ts 양쪽 호환)
// - 호출 단위 = 1 round-trip (nested select 활용)
// - row → 도메인 변환은 types.ts 의 rowTo* 재사용
// - RLS: lexicon 4 테이블 모두 read all 정책

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rowToFrequencyDataSource,
  rowToFrequencyStat,
  rowToLexicon,
  rowToSourceTag,
} from './types';
import type {
  CefrLevel,
  FrequencyDataSource,
  FrequencyDataSourceRow,
  FrequencySourceKey,
  FrequencyStat,
  FrequencyTier,
  LexiconEntry,
  LexiconSource,
  LexiconSourceTagRow,
  PartOfSpeech,
  WordFrequencyStatsRow,
  WordLexicon,
  WordLexiconRow,
} from './types';

// ────────────────────────────────────────────────
// 공통 select 표현식 (snake_case)
// ────────────────────────────────────────────────

const LEXICON_COLS = `
  id, lemma, part_of_speech, meaning_ko, meaning_ko_alt,
  ipa, pronunciation_us, cefr_level, primary_sentence_id,
  created_at, updated_at
`;

const FREQ_STAT_COLS = `
  id, lexicon_id, data_source_id, source,
  year_from, year_to, raw_count, normalized_freq, rank_in_source,
  frequency_tier, appears_every_year, metadata, computed_at
`;

const TAG_COLS = 'lexicon_id, source, metadata, added_at';

const SOURCE_COLS = 'id, source_key, citation, license, url, created_at';


// ────────────────────────────────────────────────
// 1. 단건 조회
// ────────────────────────────────────────────────

export async function getLexiconEntry(
  supabase: SupabaseClient,
  lemma: string,
  partOfSpeech: PartOfSpeech,
): Promise<LexiconEntry | null> {
  const { data, error } = await supabase
    .from('word_lexicon')
    .select(`
      ${LEXICON_COLS},
      lexicon_source_tags ( ${TAG_COLS} ),
      word_frequency_stats ( ${FREQ_STAT_COLS} )
    `)
    .eq('lemma', lemma.toLowerCase().trim())
    .eq('part_of_speech', partOfSpeech)
    .maybeSingle();

  if (error) throw new Error(`getLexiconEntry failed: ${error.message}`);
  if (!data) return null;

  return composeEntry(data as WordLexiconRow & {
    lexicon_source_tags: LexiconSourceTagRow[];
    word_frequency_stats: WordFrequencyStatsRow[];
  });
}

export async function getLexiconEntryById(
  supabase: SupabaseClient,
  lexiconId: string,
): Promise<LexiconEntry | null> {
  const { data, error } = await supabase
    .from('word_lexicon')
    .select(`
      ${LEXICON_COLS},
      lexicon_source_tags ( ${TAG_COLS} ),
      word_frequency_stats ( ${FREQ_STAT_COLS} )
    `)
    .eq('id', lexiconId)
    .maybeSingle();

  if (error) throw new Error(`getLexiconEntryById failed: ${error.message}`);
  if (!data) return null;

  return composeEntry(data as WordLexiconRow & {
    lexicon_source_tags: LexiconSourceTagRow[];
    word_frequency_stats: WordFrequencyStatsRow[];
  });
}


// ────────────────────────────────────────────────
// 2. 검색 (자동완성 / browse)
// ────────────────────────────────────────────────

export interface SearchLexiconOptions {
  q?: string;
  cefr?: CefrLevel | CefrLevel[];
  pos?: PartOfSpeech | PartOfSpeech[];
  sortBy?: 'lemma' | 'tier_desc' | 'rank_asc';
  limit?: number;
  offset?: number;
}

export async function searchLexicon(
  supabase: SupabaseClient,
  opts: SearchLexiconOptions = {},
): Promise<{ entries: WordLexicon[]; total: number }> {
  let query = supabase
    .from('word_lexicon')
    .select(LEXICON_COLS, { count: 'exact' });

  if (opts.q) {
    // trigram 인덱스 (idx_lexicon_lemma_trgm) 활용
    query = query.ilike('lemma', `${opts.q.toLowerCase().trim()}%`);
  }

  if (opts.cefr) {
    const cefrs = Array.isArray(opts.cefr) ? opts.cefr : [opts.cefr];
    query = query.in('cefr_level', cefrs);
  }

  if (opts.pos) {
    const poses = Array.isArray(opts.pos) ? opts.pos : [opts.pos];
    query = query.in('part_of_speech', poses);
  }

  if (!opts.sortBy || opts.sortBy === 'lemma') {
    query = query.order('lemma', { ascending: true });
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`searchLexicon failed: ${error.message}`);

  return {
    entries: (data as WordLexiconRow[]).map(rowToLexicon),
    total: count ?? 0,
  };
}


// ────────────────────────────────────────────────
// 3. Tier 필터 (★★★★★ 단어장)
// ────────────────────────────────────────────────

export interface FilterByTierOptions {
  source: FrequencySourceKey;
  tier: FrequencyTier | FrequencyTier[];
  cefr?: CefrLevel | CefrLevel[];
  everyYearOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function filterByTier(
  supabase: SupabaseClient,
  opts: FilterByTierOptions,
): Promise<Array<{ lexicon: WordLexicon; stat: FrequencyStat }>> {
  const tiers = Array.isArray(opts.tier) ? opts.tier : [opts.tier];

  let query = supabase
    .from('word_frequency_stats')
    .select(`
      ${FREQ_STAT_COLS},
      word_lexicon!inner ( ${LEXICON_COLS} )
    `)
    .eq('source', opts.source)
    .in('frequency_tier', tiers);

  if (opts.everyYearOnly) {
    query = query.eq('appears_every_year', true);
  }

  if (opts.cefr) {
    const cefrs = Array.isArray(opts.cefr) ? opts.cefr : [opts.cefr];
    query = query.in('word_lexicon.cefr_level', cefrs);
  }

  query = query.order('raw_count', { ascending: false });

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(`filterByTier failed: ${error.message}`);

  type Row = WordFrequencyStatsRow & { word_lexicon: WordLexiconRow };
  return (data as unknown as Row[]).map((row) => ({
    lexicon: rowToLexicon(row.word_lexicon),
    stat:    rowToFrequencyStat(row),
  }));
}


// ────────────────────────────────────────────────
// 4. 출처별 list (Library /library/vocab 카테고리)
// ────────────────────────────────────────────────

export interface ListBySourceOptions {
  source: LexiconSource;
  grade?: 'elementary' | 'middle' | 'high_common' | 'high_extended';
  limit?: number;
  offset?: number;
}

export async function listBySource(
  supabase: SupabaseClient,
  opts: ListBySourceOptions,
): Promise<WordLexicon[]> {
  let query = supabase
    .from('lexicon_source_tags')
    .select(`
      lexicon_id, source, metadata,
      word_lexicon!inner ( ${LEXICON_COLS} )
    `)
    .eq('source', opts.source);

  if (opts.grade) {
    query = query.eq('metadata->>grade', opts.grade);
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(`listBySource failed: ${error.message}`);

  type Row = LexiconSourceTagRow & { word_lexicon: WordLexiconRow };
  return (data as unknown as Row[]).map((row) => rowToLexicon(row.word_lexicon));
}


// ────────────────────────────────────────────────
// 5. Bulk lookup (Workspace 단어 추출 시 한꺼번에)
// ────────────────────────────────────────────────

/**
 * 여러 lemma 를 한 번에 조회. pos 가 불명이면 모든 pos row 반환.
 */
export async function bulkLookup(
  supabase: SupabaseClient,
  lemmas: string[],
): Promise<Map<string, WordLexicon[]>> {
  if (lemmas.length === 0) return new Map();

  const normalized = lemmas.map((l) => l.toLowerCase().trim());

  const { data, error } = await supabase
    .from('word_lexicon')
    .select(LEXICON_COLS)
    .in('lemma', normalized);

  if (error) throw new Error(`bulkLookup failed: ${error.message}`);

  const result = new Map<string, WordLexicon[]>();
  for (const row of (data as WordLexiconRow[])) {
    const lex = rowToLexicon(row);
    const arr = result.get(lex.lemma) ?? [];
    arr.push(lex);
    result.set(lex.lemma, arr);
  }

  return result;
}


// ────────────────────────────────────────────────
// 6. frequency_data_sources 목록 (UI 출처 필터 + attribution 표시)
// ────────────────────────────────────────────────

export async function listFrequencyDataSources(
  supabase: SupabaseClient,
): Promise<FrequencyDataSource[]> {
  const { data, error } = await supabase
    .from('frequency_data_sources')
    .select(SOURCE_COLS)
    .order('id', { ascending: true });

  if (error) throw new Error(`listFrequencyDataSources failed: ${error.message}`);

  return (data as FrequencyDataSourceRow[]).map(rowToFrequencyDataSource);
}


// ────────────────────────────────────────────────
// 7. 통계 (Hub/Dashboard 헤더)
// ────────────────────────────────────────────────

export interface LexiconStats {
  totalLemmas: number;
  byTier: Partial<Record<FrequencyTier, number>>;
  bySource: Partial<Record<LexiconSource, number>>;
}

/**
 * Lexicon 전체 통계. 3 round-trip — server 컴포넌트 + revalidate 권장.
 */
export async function getLexiconStats(supabase: SupabaseClient): Promise<LexiconStats> {
  const { count: totalLemmas, error: e1 } = await supabase
    .from('word_lexicon')
    .select('*', { count: 'exact', head: true });
  if (e1) throw new Error(`getLexiconStats(total) failed: ${e1.message}`);

  const { data: tierData, error: e2 } = await supabase
    .from('word_frequency_stats')
    .select('frequency_tier')
    .eq('source', 'kice_csat_recent');
  if (e2) throw new Error(`getLexiconStats(tier) failed: ${e2.message}`);

  const byTier: Partial<Record<FrequencyTier, number>> = {};
  for (const r of (tierData as Array<{ frequency_tier: FrequencyTier }>)) {
    byTier[r.frequency_tier] = (byTier[r.frequency_tier] ?? 0) + 1;
  }

  const { data: srcData, error: e3 } = await supabase
    .from('lexicon_source_tags')
    .select('source');
  if (e3) throw new Error(`getLexiconStats(source) failed: ${e3.message}`);

  const bySource: Partial<Record<LexiconSource, number>> = {};
  for (const r of (srcData as Array<{ source: LexiconSource }>)) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }

  return {
    totalLemmas: totalLemmas ?? 0,
    byTier,
    bySource,
  };
}


// ────────────────────────────────────────────────
// internal
// ────────────────────────────────────────────────

function composeEntry(
  row: WordLexiconRow & {
    lexicon_source_tags: LexiconSourceTagRow[];
    word_frequency_stats: WordFrequencyStatsRow[];
  },
): LexiconEntry {
  return {
    ...rowToLexicon(row),
    sourceTags:     (row.lexicon_source_tags ?? []).map(rowToSourceTag),
    frequencyStats: (row.word_frequency_stats ?? []).map(rowToFrequencyStat),
  };
}
