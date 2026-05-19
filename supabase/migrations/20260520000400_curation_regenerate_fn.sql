-- =====================================================================
-- KICE 13y sprint #18 — 자동 큐레이션 재생성 함수
--
-- shared_word_sets.curation_query JSONB 의 filters 를 해석해
-- shared_words 를 일괄 재생성 (DELETE + INSERT) 한다.
--
-- 지원 필터:
--   - raw_count_min       : 최소 raw_count (출현 연도 수)        ★ KICE 분포 맞게 추가
--   - frequency_tier_min  : 최소 frequency_tier (Tier 4 = 4-9y)
--   - appears_every_year  : 전 연도 출제 여부 (KICE 13y 에는 X)
--   - min_years           : metadata.years_appeared 길이 최소
--   - question_nos        : 특정 문항 번호 출현 (JSONB 배열)
-- =====================================================================

CREATE OR REPLACE FUNCTION regenerate_auto_curated_set(p_set_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query JSONB;
  v_filters JSONB;
  v_inserted INT;
BEGIN
  SELECT curation_query INTO v_query
  FROM shared_word_sets
  WHERE id = p_set_id AND auto_curated = true;

  IF v_query IS NULL THEN
    RAISE EXCEPTION 'Auto-curated set not found: %', p_set_id;
  END IF;

  v_filters := v_query->'filters';

  DELETE FROM shared_words WHERE set_id = p_set_id;

  WITH candidates AS (
    SELECT
      wl.id AS lexicon_id,
      wl.lemma, wl.meaning_ko, wl.part_of_speech, wl.cefr_level,
      wfs.raw_count, wfs.frequency_tier, wfs.appears_every_year,
      lst.metadata
    FROM word_lexicon wl
    JOIN lexicon_source_tags lst ON lst.lexicon_id = wl.id AND lst.source = 'kice_csat'
    LEFT JOIN word_frequency_stats wfs ON wfs.lexicon_id = wl.id AND wfs.source = 'kice_csat'
    WHERE
      (v_filters->>'raw_count_min' IS NULL
        OR wfs.raw_count >= (v_filters->>'raw_count_min')::INT)
      AND (v_filters->>'appears_every_year' IS NULL
        OR wfs.appears_every_year = (v_filters->>'appears_every_year')::BOOLEAN)
      AND (v_filters->>'frequency_tier_min' IS NULL
        OR wfs.frequency_tier >= (v_filters->>'frequency_tier_min')::INT)
      AND (v_filters->>'min_years' IS NULL
        OR jsonb_array_length(lst.metadata->'years_appeared') >= (v_filters->>'min_years')::INT)
      AND (v_filters->'question_nos' IS NULL
        OR EXISTS (
          SELECT 1 FROM jsonb_each(lst.metadata->'question_history') qh
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(qh.value) q
            WHERE q::INT = ANY(
              ARRAY(SELECT jsonb_array_elements_text(v_filters->'question_nos'))::INT[]
            )
          )
        ))
  )
  INSERT INTO shared_words (
    set_id, lexicon_id, word, meaning_ko, part_of_speech, cefr_level, sort_order
  )
  SELECT
    p_set_id, c.lexicon_id, c.lemma, c.meaning_ko, c.part_of_speech, c.cefr_level,
    ROW_NUMBER() OVER (ORDER BY c.frequency_tier DESC NULLS LAST, c.raw_count DESC, c.lemma)
  FROM candidates c;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE shared_word_sets
  SET word_count = v_inserted, regenerated_at = now()
  WHERE id = p_set_id;

  RETURN v_inserted;
END;
$$;
