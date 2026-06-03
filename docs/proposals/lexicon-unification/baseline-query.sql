-- Phase 1 적용 전 KPI 베이스라인 측정
-- Supabase Dashboard SQL Editor 에서 실행 → 결과 JSON 을 baseline.json 로 저장

SELECT json_build_object(
  'measured_at', now(),
  'phase', 'pre-phase-1',
  'tables', json_build_object(
    'shared_dictionary',
      (SELECT COUNT(*) FROM shared_dictionary),
    'shared_dictionary_meaning_filled',
      (SELECT COUNT(*) FROM shared_dictionary WHERE meaning_ko IS NOT NULL AND meaning_ko <> ''),
    'shared_dictionary_inflections_filled',
      (SELECT COUNT(*) FROM shared_dictionary WHERE inflections IS NOT NULL),
    'dictionary_categories',
      (SELECT COUNT(*) FROM dictionary_categories),
    'dictionary_word_categories',
      (SELECT COUNT(*) FROM dictionary_word_categories),
    'shared_word_sets',
      (SELECT COUNT(*) FROM shared_word_sets),
    'shared_words',
      (SELECT COUNT(*) FROM shared_words),
    'vocabularies',
      (SELECT COUNT(*) FROM vocabularies),
    'frequency_data_sources',
      (SELECT COUNT(*) FROM frequency_data_sources)
  ),
  'cefr_distribution', (
    SELECT json_object_agg(COALESCE(cefr_level, 'NULL'), cnt)
    FROM (SELECT cefr_level, COUNT(*) AS cnt FROM shared_dictionary GROUP BY cefr_level) sub
  ),
  'pos_distribution', (
    SELECT json_object_agg(COALESCE(pos, 'NULL'), cnt)
    FROM (SELECT pos, COUNT(*) AS cnt FROM shared_dictionary GROUP BY pos) sub
  )
) AS baseline;

-- 적용 후 비교 쿼리:
-- SELECT json_build_object(
--   'measured_at', now(),
--   'phase', 'post-phase-1',
--   'shared_dictionary', (SELECT COUNT(*) FROM shared_dictionary),
--   'lexicon_frequencies', (SELECT COUNT(*) FROM lexicon_frequencies),
--   'vocabularies_with_lemma', (SELECT COUNT(*) FROM vocabularies WHERE lemma IS NOT NULL),
--   'shared_words_with_lemma', (SELECT COUNT(*) FROM shared_words WHERE lemma IS NOT NULL),
--   'frequency_sources_count', (SELECT COUNT(*) FROM frequency_data_sources),
--   'senses_filled', (SELECT COUNT(*) FROM shared_dictionary WHERE jsonb_array_length(senses) > 0),
--   'primary_pos_filled', (SELECT COUNT(*) FROM shared_dictionary WHERE primary_pos IS NOT NULL),
--   'frequency_score_filled', (SELECT COUNT(*) FROM shared_dictionary WHERE frequency_score IS NOT NULL)
-- ) AS post_phase1;
