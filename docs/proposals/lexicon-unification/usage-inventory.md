# Lexicon Unification — 코드 사용처 정찰

Generated: 2026-05-20T13:51:48Z
Branch: db-통합
HEAD: f047d5e

Phase 4 코드 마이그레이션 시 이 파일을 체크리스트로 활용.
각 파일에서 shared_dictionary/word_lexicon/word_frequency_stats 참조를 lexicon(통합 후) 으로 대체.

---

## shared_dictionary 참조 (40 files, 154 occurrences)
```
apps/web/src/app/(main)/text/[id]/word-enrichment.ts:6:// - shared_dictionary 미매칭 단어도 lbv 메타로 표시
apps/web/src/components/admin/vcb/VcbStep4LookupCard.tsx:75:            seed_candidates 를 shared_dictionary 에 매칭해서 vocab_dict_hits + vocab_enrichment_queue 를 생성합니다.
apps/web/src/lib/library/adaptive-extract.ts:11://   - shared_dictionary miss 단어는 skip + 다음 LV 단어 보충
apps/web/src/lib/library/adaptive-extract.ts:53: * shared_dictionary miss 단어는 skip하고 다음 LV 단어로 보충.
apps/web/src/lib/library/adaptive-extract.ts:99:  // 4. shared_dictionary 일괄 lookup (RULE 3: pronunciation 컬럼 부재 — SELECT 절에서 제거)
apps/web/src/lib/library/adaptive-extract.ts:102:    .from('shared_dictionary')
apps/web/src/lib/library/adaptive-extract.ts:107:    throw new Error(`shared_dictionary lookup failed: ${dictError.message}`)
apps/web/src/lib/library/adaptive-extract.ts:125:  // 6. INSERT 대상 선정 — RULE 6: shared_dictionary miss skip + 다음 LV 단어 보충
apps/web/src/lib/library/adaptive-extract.ts:148:    if (!d) continue //                                                          shared_dictionary miss → skip + 다음 후보
apps/web/src/lib/library/adaptive-extract.ts:171:      pronunciation: null, //                                                    shared_dictionary 에 컬럼 부재
apps/web/src/lib/library/chapter-words-queries.ts:4:// library_book_vocabularies + shared_dictionary LEFT JOIN
apps/web/src/lib/library/chapter-words-queries.ts:49:    .from('shared_dictionary')
apps/web/src/lib/library/reader-queries.ts:134:  // shared_dictionary lookup (CEFR level)
apps/web/src/lib/library/reader-queries.ts:139:    .from('shared_dictionary')
apps/web/src/lib/vcb/pipeline-steps.ts:169:      'shared_dictionary 마스터 캐시 접근 가능 (캐시 hit 단어는 미스만 통과)',
apps/web/src/lib/vcb/pipeline-steps.ts:186:      'shared_dictionary 캐시 hit 단어 제외됨 (vocab_dict_hits 적재)',
apps/web/src/lib/vcb/pipeline-steps.ts:423:    title: 'Publish → shared_dictionary',
apps/web/src/lib/vcb/pipeline-steps.ts:424:    oneLine: '승인된 enriched payload 를 마스터 캐시(shared_dictionary)에 UPSERT',
apps/web/src/lib/vcb/pipeline-steps.ts:444:      'shared_dictionary 에 새 row 또는 UPDATE 적용',
apps/web/src/lib/wordblitz/word-pool.ts:7:// - shared_dictionary lookup으로 한국어 뜻 채움
apps/web/src/lib/wordblitz/word-pool.ts:88:  // shared_dictionary lookup (한국어 뜻)
apps/web/src/lib/wordblitz/word-pool.ts:90:    .from('shared_dictionary')
packages/library-pipeline/src/analyze/analyze-book.ts:33: *  3) shared_dictionary lookup + LLM enrichment
packages/library-pipeline/src/analyze/learning-value.ts:12://   shared_dictionary 부재 단어 → 0.3 (자동 stopword 처리)
packages/library-pipeline/src/analyze/learning-value.ts:20://   - alice/little/way/come (shared_dictionary 부재) → LV ~0.03 자동 stopword
packages/library-pipeline/src/analyze/lookup-enrich.ts:2:// LCP v2.0 — shared_dictionary lookup + Claude API enrichment
packages/library-pipeline/src/analyze/lookup-enrich.ts:44: *  1) shared_dictionary bulk lookup (chunk 분할)
packages/library-pipeline/src/analyze/lookup-enrich.ts:46: *  3) enriched 결과를 shared_dictionary 에 INSERT (다음 책에서 hit)
packages/library-pipeline/src/analyze/lookup-enrich.ts:62:      .from('shared_dictionary')
packages/library-pipeline/src/analyze/lookup-enrich.ts:66:      throw new Error(`shared_dictionary lookup failed: ${error.message}`)
packages/library-pipeline/src/analyze/lookup-enrich.ts:90:      // shared_dictionary 에 누적 INSERT
packages/library-pipeline/src/analyze/lookup-enrich.ts:93:          'enrich_shared_dictionary',
packages/library-pipeline/src/analyze/lookup-enrich.ts:98:            `[lookup-enrich] enrich_shared_dictionary failed: ${rpcError.message}`,
packages/types/src/database.ts:292:            referencedRelation: "shared_dictionary"
packages/types/src/database.ts:504:      shared_dictionary: {
packages/vcb-core/src/pos-map.ts:76: * VCB Pos → shared_dictionary.pos 매핑.
packages/vcb-core/src/types.ts:138:export type DictSourceTable = 'shared_dictionary' | 'word_lexicon' | null
packages/vcb-core/src/types.ts:213:// 실제 shared_dictionary 스키마(2026-05-13 검증)는 04-dict-lookup.ts 의
packages/vcb-curate-core/src/dict-lookup.ts:7://   2. shared_dictionary — active
packages/vcb-curate-core/src/dict-lookup.ts:36:  sourceTable: 'shared_dictionary' | 'word_lexicon' | null
packages/vcb-curate-core/src/dict-lookup.ts:67:    .from('shared_dictionary')
packages/vcb-curate-core/src/dict-lookup.ts:75:      `shared_dictionary lookup failed: ${error.message} (lemma=${lemma}, pos=${pos})`,
packages/vcb-curate-core/src/dict-lookup.ts:108:    sourceTable: 'shared_dictionary',
packages/vcb-curate-core/src/qa.ts:144:      .from('shared_dictionary')
packages/vcb-curate-core/src/queries.ts:227:    .from('shared_dictionary')
scripts/dict-fill/01-export-job.ts:67:    let query = sb.from('shared_dictionary')
scripts/dict-fill/03-import-enriched.ts:2:// Dict-fill output JSONL → shared_dictionary UPDATE.
scripts/dict-fill/03-import-enriched.ts:90:      const { data: existing, error: selErr } = await sb.from('shared_dictionary')
scripts/dict-fill/03-import-enriched.ts:120:        const { error: updErr } = await sb.from('shared_dictionary')
scripts/dict-fill/p4-extract-targets.ts:2:// Extract new (post-corpus-import) shared_dictionary stubs in lemma_band 1k-9k
scripts/dict-fill/p4-extract-targets.ts:37:    const { data, error } = await sb.from('shared_dictionary')
scripts/dict-fill/p4-import-to-db.ts:2:// Phase 4: import enriched P4 outputs into shared_dictionary.
scripts/dict-fill/p4-import-to-db.ts:79:      const { data: existing, error: selErr } = await sb.from('shared_dictionary')
scripts/dict-fill/p4-import-to-db.ts:84:      const { error: updErr } = await sb.from('shared_dictionary')
scripts/dict-fill/p5-extract-targets.ts:36:    const { data, error } = await sb.from('shared_dictionary')
scripts/dict-fill/p5-import-to-db.ts:2:// Phase 4: import enriched P4 outputs into shared_dictionary.
scripts/dict-fill/p5-import-to-db.ts:79:      const { data: existing, error: selErr } = await sb.from('shared_dictionary')
scripts/dict-fill/p5-import-to-db.ts:84:      const { error: updErr } = await sb.from('shared_dictionary')
scripts/freq-corpus/02-match-analysis.ts:2:// Match corpus lemmas/inflections against shared_dictionary (read-only).
scripts/freq-corpus/02-match-analysis.ts:43:    const { data, error } = await sb.from('shared_dictionary')
scripts/freq-corpus/02-match-analysis.ts:51:  console.log(`shared_dictionary words: ${allWords.size}`)
scripts/freq-corpus/03-import-to-db.ts:2:// Import frequency corpus into shared_dictionary.
scripts/freq-corpus/03-import-to-db.ts:53:    const { data, error } = await sb.from('shared_dictionary')
scripts/freq-corpus/03-import-to-db.ts:63:  console.log(`Existing shared_dictionary words: ${existing.size}`)
scripts/freq-corpus/03-import-to-db.ts:119:    const { error } = await sb.from('shared_dictionary').insert(chunk)
scripts/freq-corpus/03-import-to-db.ts:131:    const { error } = await sb.from('shared_dictionary')
scripts/lcp/enrich-unmatched-words.ts:9://   4. INSERT into shared_dictionary (source='ai-generated', verified=false)
scripts/lcp/enrich-unmatched-words.ts:207:    .from('shared_dictionary')
scripts/lcp/import-ngsl-frequency.ts:3:// Phase 14.1 — NGSL frequency_rank import to shared_dictionary
scripts/lcp/import-ngsl-frequency.ts:196:      .from('shared_dictionary')
scripts/lcp/import-ngsl-frequency.ts:212:        .from('shared_dictionary')
scripts/lcp/import-ngsl-frequency.ts:275:    .from('shared_dictionary')
scripts/lcp/import-ngsl-frequency.ts:278:  console.log(`\n📈 shared_dictionary.frequency_rank now filled: ${count} rows`)
scripts/lcp/import-ngsl-list.ts:5:// 한 list의 lemma family CSV (또는 NGSL-GR rank CSV) 를 읽어 shared_dictionary.list_tags
scripts/lcp/import-ngsl-list.ts:178:      .from('shared_dictionary')
scripts/lcp/import-ngsl-list.ts:205:        .from('shared_dictionary')
scripts/lcp/import-ngsl-list.ts:251:    .from('shared_dictionary')
scripts/lcp/import-ngsl-list.ts:254:  console.log(`\n📈 shared_dictionary tagged with "${listId}": ${count} rows`)
scripts/vcb/05e-promote-to-dictionary.mjs:2:// VCB Step 5e — Promote enriched_payload from vocab_enrichment_queue to shared_dictionary.
scripts/vcb/05e-promote-to-dictionary.mjs:46:// 2. For each (lemma, posMapped), check if shared_dictionary has it and what columns are filled
scripts/vcb/05e-promote-to-dictionary.mjs:52:  const { data: existing, error } = await sb.from('shared_dictionary')
scripts/vcb/05e-promote-to-dictionary.mjs:83:console.log('  matched in shared_dictionary :', stats.matched)
scripts/vcb/05e-promote-to-dictionary.mjs:105:  const { error } = await sb.from('shared_dictionary')
scripts/vcb/99-cefr-relabel.mjs:2:// CEFR re-labeling for shared_dictionary based on NGSL frequency_rank.
scripts/vcb/99-cefr-relabel.mjs:48:  const { data, error } = await sb.from('shared_dictionary')
scripts/vcb/99-cefr-relabel.mjs:118:  const { error } = await sb.from('shared_dictionary')
supabase/migrations/20260504144011_add_shared_dictionary.sql:2:-- Migration: 20260504144011_add_shared_dictionary.sql
supabase/migrations/20260504144011_add_shared_dictionary.sql:10:--   shared_dictionary  : 시스템 캐시 (사용자 노출 X) — 본 테이블
supabase/migrations/20260504144011_add_shared_dictionary.sql:15:--   사용자 텍스트 입력 → 단어 토큰화 → shared_dictionary 조회
supabase/migrations/20260504144011_add_shared_dictionary.sql:17:--   → 미스(10%): Claude API 호출 → shared_dictionary INSERT (캐시)
supabase/migrations/20260504144011_add_shared_dictionary.sql:33:CREATE TABLE shared_dictionary (
supabase/migrations/20260504144011_add_shared_dictionary.sql:65:CREATE INDEX idx_dict_cefr ON shared_dictionary(cefr_level);
supabase/migrations/20260504144011_add_shared_dictionary.sql:66:CREATE INDEX idx_dict_freq ON shared_dictionary(frequency_rank)
supabase/migrations/20260504144011_add_shared_dictionary.sql:68:CREATE INDEX idx_dict_source ON shared_dictionary(source);
supabase/migrations/20260504144011_add_shared_dictionary.sql:71:CREATE TRIGGER trg_shared_dictionary_updated
supabase/migrations/20260504144011_add_shared_dictionary.sql:72:  BEFORE UPDATE ON shared_dictionary
supabase/migrations/20260504144011_add_shared_dictionary.sql:76:ALTER TABLE shared_dictionary ENABLE ROW LEVEL SECURITY;
supabase/migrations/20260504144011_add_shared_dictionary.sql:80:  ON shared_dictionary
supabase/migrations/20260504144011_add_shared_dictionary.sql:88:  ON shared_dictionary
supabase/migrations/20260504154153_add_dictionary_categories.sql:7:-- shared_dictionary 단어를 토픽으로 분류하는 트리 + M:N 매핑.
supabase/migrations/20260504154153_add_dictionary_categories.sql:25:--   - shared_dictionary (20260504144011_add_shared_dictionary.sql) — FK
supabase/migrations/20260504154153_add_dictionary_categories.sql:69:  word TEXT NOT NULL REFERENCES shared_dictionary(word) ON DELETE CASCADE,
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:7:-- 변경 1: shared_dictionary.meaning_ko NOT NULL 제거
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:21:--   - 20260504144011_add_shared_dictionary.sql (테이블 + 기존 CHECK 정의)
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:31:ALTER TABLE shared_dictionary
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:35:ALTER TABLE shared_dictionary
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:36:  DROP CONSTRAINT IF EXISTS shared_dictionary_source_check;
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:38:ALTER TABLE shared_dictionary
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:39:  ADD CONSTRAINT shared_dictionary_source_check
supabase/migrations/20260508120000_lcp_v2.sql:12:--   2) shared_dictionary.pronunciation 컬럼 부재 → hot_dictionary view에서 제거
supabase/migrations/20260508120000_lcp_v2.sql:216:  word                  TEXT NOT NULL,                 -- shared_dictionary.word matching key
supabase/migrations/20260508120000_lcp_v2.sql:311:--    pronunciation 컬럼은 shared_dictionary에 부재 → 제외
supabase/migrations/20260508120000_lcp_v2.sql:317:FROM shared_dictionary
supabase/migrations/20260508120200_lcp_v2_analyze.sql:8:-- 4) enrich_shared_dictionary: LLM 결과 누적
supabase/migrations/20260508120200_lcp_v2_analyze.sql:32:FROM shared_dictionary
supabase/migrations/20260508120200_lcp_v2_analyze.sql:111:-- ④ enrich_shared_dictionary — LLM 결과 누적
supabase/migrations/20260508120200_lcp_v2_analyze.sql:113:CREATE OR REPLACE FUNCTION enrich_shared_dictionary(p_words JSONB)
supabase/migrations/20260508120200_lcp_v2_analyze.sql:125:    INSERT INTO shared_dictionary (
supabase/migrations/20260508120200_lcp_v2_analyze.sql:146:REVOKE ALL ON FUNCTION enrich_shared_dictionary(JSONB) FROM PUBLIC;
supabase/migrations/20260508120200_lcp_v2_analyze.sql:147:GRANT EXECUTE ON FUNCTION enrich_shared_dictionary(JSONB) TO service_role;
supabase/migrations/20260516210000_shared_dictionary_extension.sql:1:-- VCB §19 — shared_dictionary 확장 (P1 of dict-opt sprint)
supabase/migrations/20260516210000_shared_dictionary_extension.sql:2:-- 의존: shared_dictionary 기본 컬럼 존재 (word, pos, cefr_level, meaning_ko, ...)
supabase/migrations/20260516210000_shared_dictionary_extension.sql:15:ALTER TABLE public.shared_dictionary
supabase/migrations/20260516210000_shared_dictionary_extension.sql:25:    WHERE conrelid = 'public.shared_dictionary'::regclass
supabase/migrations/20260516210000_shared_dictionary_extension.sql:26:      AND conname = 'shared_dictionary_register_check'
supabase/migrations/20260516210000_shared_dictionary_extension.sql:28:    ALTER TABLE public.shared_dictionary
supabase/migrations/20260516210000_shared_dictionary_extension.sql:29:      ADD CONSTRAINT shared_dictionary_register_check
supabase/migrations/20260516210000_shared_dictionary_extension.sql:35:CREATE INDEX IF NOT EXISTS idx_shared_dictionary_register
supabase/migrations/20260516210000_shared_dictionary_extension.sql:36:  ON public.shared_dictionary(register);
supabase/migrations/20260516210000_shared_dictionary_extension.sql:37:CREATE INDEX IF NOT EXISTS idx_shared_dictionary_collocations_gin
supabase/migrations/20260516210000_shared_dictionary_extension.sql:38:  ON public.shared_dictionary USING GIN(collocations);
supabase/migrations/20260517235907_freq_corpus_columns.sql:1:-- Frequency corpus integration — add multi-source frequency metadata to shared_dictionary.
supabase/migrations/20260517235907_freq_corpus_columns.sql:9:ALTER TABLE public.shared_dictionary
supabase/migrations/20260517235907_freq_corpus_columns.sql:15:ALTER TABLE public.shared_dictionary
supabase/migrations/20260517235907_freq_corpus_columns.sql:16:  ADD CONSTRAINT shared_dictionary_frequency_band_check
supabase/migrations/20260517235907_freq_corpus_columns.sql:22:ALTER TABLE public.shared_dictionary
supabase/migrations/20260517235907_freq_corpus_columns.sql:23:  ADD CONSTRAINT shared_dictionary_lemma_band_check
supabase/migrations/20260517235907_freq_corpus_columns.sql:26:CREATE INDEX IF NOT EXISTS idx_sd_frequency_band       ON public.shared_dictionary (frequency_band);
supabase/migrations/20260517235907_freq_corpus_columns.sql:27:CREATE INDEX IF NOT EXISTS idx_sd_lemma_band           ON public.shared_dictionary (lemma_band);
supabase/migrations/20260517235907_freq_corpus_columns.sql:28:CREATE INDEX IF NOT EXISTS idx_sd_frequency_sources_gin ON public.shared_dictionary USING gin (frequency_sources);
supabase/migrations/20260517235907_freq_corpus_columns.sql:29:CREATE INDEX IF NOT EXISTS idx_sd_inflections_gin       ON public.shared_dictionary USING gin (inflections);
supabase/migrations/20260517235907_freq_corpus_columns.sql:32:UPDATE public.shared_dictionary
```

## word_lexicon 참조
```
apps/web/src/lib/lexicon/queries.ts:64:    .from('word_lexicon')
apps/web/src/lib/lexicon/queries.ts:88:    .from('word_lexicon')
apps/web/src/lib/lexicon/queries.ts:125:    .from('word_lexicon')
apps/web/src/lib/lexicon/queries.ts:184:      word_lexicon!inner ( ${LEXICON_COLS} )
apps/web/src/lib/lexicon/queries.ts:195:    query = query.in('word_lexicon.cefr_level', cefrs);
apps/web/src/lib/lexicon/queries.ts:207:  type Row = WordFrequencyStatsRow & { word_lexicon: WordLexiconRow };
apps/web/src/lib/lexicon/queries.ts:209:    lexicon: rowToLexicon(row.word_lexicon),
apps/web/src/lib/lexicon/queries.ts:234:      word_lexicon!inner ( ${LEXICON_COLS} )
apps/web/src/lib/lexicon/queries.ts:249:  type Row = LexiconSourceTagRow & { word_lexicon: WordLexiconRow };
apps/web/src/lib/lexicon/queries.ts:250:  return (data as unknown as Row[]).map((row) => rowToLexicon(row.word_lexicon));
apps/web/src/lib/lexicon/queries.ts:270:    .from('word_lexicon')
apps/web/src/lib/lexicon/queries.ts:321:    .from('word_lexicon')
apps/web/src/lib/lexicon/types.ts:5://   (frequency_data_sources · word_lexicon · lexicon_source_tags · word_frequency_stats)
packages/vcb-core/src/types.ts:138:export type DictSourceTable = 'shared_dictionary' | 'word_lexicon' | null
packages/vcb-curate-core/src/dict-lookup.ts:6://   1. word_lexicon (lexicon-v2.1) — currently disabled
packages/vcb-curate-core/src/dict-lookup.ts:36:  sourceTable: 'shared_dictionary' | 'word_lexicon' | null
```

## word_frequency_stats 참조
```
apps/web/src/lib/lexicon/queries.ts:68:      word_frequency_stats ( ${FREQ_STAT_COLS} )
apps/web/src/lib/lexicon/queries.ts:79:    word_frequency_stats: WordFrequencyStatsRow[];
apps/web/src/lib/lexicon/queries.ts:92:      word_frequency_stats ( ${FREQ_STAT_COLS} )
apps/web/src/lib/lexicon/queries.ts:102:    word_frequency_stats: WordFrequencyStatsRow[];
apps/web/src/lib/lexicon/queries.ts:181:    .from('word_frequency_stats')
apps/web/src/lib/lexicon/queries.ts:326:    .from('word_frequency_stats')
apps/web/src/lib/lexicon/queries.ts:361:    word_frequency_stats: WordFrequencyStatsRow[];
apps/web/src/lib/lexicon/queries.ts:367:    frequencyStats: (row.word_frequency_stats ?? []).map(rowToFrequencyStat),
apps/web/src/lib/lexicon/types.ts:5://   (frequency_data_sources · word_lexicon · lexicon_source_tags · word_frequency_stats)
apps/web/src/lib/lexicon/types.ts:30:/** word_frequency_stats.source / frequency_data_sources.source_key */
```

## dictionary_word_categories 참조
```
apps/web/src/lib/vcb/pipeline-steps.ts:445:      'dictionary_word_categories 매핑 동시 적재',
packages/types/src/database.ts:252:      dictionary_word_categories: {
packages/types/src/database.ts:282:            foreignKeyName: "dictionary_word_categories_category_id_fkey"
packages/types/src/database.ts:289:            foreignKeyName: "dictionary_word_categories_word_fkey"
supabase/migrations/20260504154153_add_dictionary_categories.sql:15:--   dictionary_word_categories: 29,339개 (word ↔ category)
supabase/migrations/20260504154153_add_dictionary_categories.sql:66:-- 2) dictionary_word_categories — M:N 매핑
supabase/migrations/20260504154153_add_dictionary_categories.sql:68:CREATE TABLE dictionary_word_categories (
supabase/migrations/20260504154153_add_dictionary_categories.sql:88:CREATE INDEX idx_word_cat_category ON dictionary_word_categories(category_id, rank_in_category);
supabase/migrations/20260504154153_add_dictionary_categories.sql:89:CREATE INDEX idx_word_cat_word ON dictionary_word_categories(word);
supabase/migrations/20260504154153_add_dictionary_categories.sql:90:CREATE INDEX idx_word_cat_cefr ON dictionary_word_categories(cefr_in_context, category_id)
supabase/migrations/20260504154153_add_dictionary_categories.sql:97:ALTER TABLE dictionary_word_categories ENABLE ROW LEVEL SECURITY;
supabase/migrations/20260504154153_add_dictionary_categories.sql:107:  ON dictionary_word_categories
supabase/migrations/20260504154153_add_dictionary_categories.sql:121:  ON dictionary_word_categories
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:16:-- 변경 3: dictionary_word_categories.source 정정
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:22:--   - 20260504154153_add_dictionary_categories.sql (dictionary_word_categories)
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:50:-- ── 변경 3: dictionary_word_categories.source 정정 ──
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:53:ALTER TABLE dictionary_word_categories
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:57:ALTER TABLE dictionary_word_categories
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:58:  DROP CONSTRAINT IF EXISTS dictionary_word_categories_source_check;
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:60:ALTER TABLE dictionary_word_categories
supabase/migrations/20260504160708_prepare_dictionary_for_seed_import.sql:61:  ADD CONSTRAINT dictionary_word_categories_source_check
supabase/migrations/20260518130000_shared_word_sets_category_bridge.sql:7:--   - dictionary_word_categories: 28,124 매핑 · FK 정합 100% (orphan 0)
```
