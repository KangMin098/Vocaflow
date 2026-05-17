-- supabase/migrations/20260508120200_lcp_v2_analyze.sql
-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 — Phase 6: ANALYZE helpers
-- ═══════════════════════════════════════════════════════════
-- 1) vocabularies.origin CHECK에 'library' 추가
-- 2) hot_dictionary view 재정의 (frequency_rank 100% NULL 환경 대응)
-- 3) insert_book_analysis: chapter + vocab 일괄 INSERT
-- 4) enrich_shared_dictionary: LLM 결과 누적
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────
-- ① vocabularies.origin CHECK 확장
-- ─────────────────────────────────────────────
ALTER TABLE vocabularies DROP CONSTRAINT IF EXISTS vocabularies_origin_check;
ALTER TABLE vocabularies ADD CONSTRAINT vocabularies_origin_check
  CHECK (origin IN ('ai','shared_set','imported','manual','library'));

-- ─────────────────────────────────────────────
-- ② hot_dictionary 재정의 (A1~B2 기반)
--    실 DB에서 frequency_rank가 100% NULL이라
--    cefr_level만 의미 있는 시그널이므로 A1~B2 범위로 확장.
--    cron 'refresh-hot-dictionary'는 기존 그대로 매주 KST 일 03:00 동작.
-- ─────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS hot_dictionary CASCADE;

CREATE MATERIALIZED VIEW hot_dictionary AS
SELECT
  word, meaning_ko, meanings_ko, pos, pos_all,
  cefr_level, frequency_rank, example_en, verified
FROM shared_dictionary
WHERE
  meaning_ko IS NOT NULL
  AND cefr_level IN ('A1','A2','B1','B2');

CREATE UNIQUE INDEX idx_hot_dict_word ON hot_dictionary(word);
CREATE INDEX idx_hot_dict_cefr ON hot_dictionary(cefr_level);

COMMENT ON MATERIALIZED VIEW hot_dictionary IS
  'LCP v2.0 Phase 6 — A1~B2 hot words. frequency_rank 부재 환경 대응.';

-- ─────────────────────────────────────────────
-- ③ insert_book_analysis
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_book_analysis(
  p_book_id UUID,
  p_chapters JSONB,
  p_words JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_chapter JSONB;
  v_word JSONB;
BEGIN
  -- 재분석 케이스: 기존 chapter / vocab 삭제
  -- (content_chunks ref_count는 trg_lcm_chunk_refs 트리거가 자동 감소)
  DELETE FROM library_chapters_master WHERE library_book_id = p_book_id;
  DELETE FROM library_book_vocabularies WHERE library_book_id = p_book_id;

  -- chapters INSERT
  FOR v_chapter IN SELECT * FROM jsonb_array_elements(p_chapters)
  LOOP
    INSERT INTO library_chapters_master (
      library_book_id, chapter_idx, chapter_title,
      content_hash, word_count, cefr_level,
      paragraph_offsets, sentence_offsets
    ) VALUES (
      p_book_id,
      (v_chapter->>'chapter_idx')::INT,
      NULLIF(v_chapter->>'chapter_title', ''),
      v_chapter->>'content_hash',
      (v_chapter->>'word_count')::INT,
      v_chapter->>'cefr_level',
      ARRAY(SELECT jsonb_array_elements_text(v_chapter->'paragraph_offsets'))::INT[],
      ARRAY(SELECT jsonb_array_elements_text(v_chapter->'sentence_offsets'))::INT[]
    );
  END LOOP;

  -- vocabularies INSERT
  FOR v_word IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    INSERT INTO library_book_vocabularies (
      library_book_id, chapter_idx, word,
      frequency_in_book, frequency_in_chapter,
      first_sentence, base_learning_value
    ) VALUES (
      p_book_id,
      (v_word->>'chapter_idx')::INT,
      v_word->>'word',
      (v_word->>'frequency_in_book')::INT,
      (v_word->>'frequency_in_chapter')::INT,
      v_word->>'first_sentence',
      (v_word->>'base_learning_value')::FLOAT
    )
    ON CONFLICT (library_book_id, word) DO UPDATE
      SET frequency_in_book    = EXCLUDED.frequency_in_book,
          frequency_in_chapter = EXCLUDED.frequency_in_chapter,
          base_learning_value  = EXCLUDED.base_learning_value,
          first_sentence       = EXCLUDED.first_sentence;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION insert_book_analysis(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_book_analysis(UUID, JSONB, JSONB) TO service_role;

-- ─────────────────────────────────────────────
-- ④ enrich_shared_dictionary — LLM 결과 누적
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enrich_shared_dictionary(p_words JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_word JSONB;
  v_inserted INT := 0;
BEGIN
  FOR v_word IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    INSERT INTO shared_dictionary (
      word, meaning_ko, cefr_level, pos, example_en, source, verified
    ) VALUES (
      lower(v_word->>'word'),
      v_word->>'meaning_ko',
      NULLIF(v_word->>'cefr_level', ''),
      NULLIF(v_word->>'pos', ''),
      NULLIF(v_word->>'example_en', ''),
      'lcp_llm',
      false
    )
    ON CONFLICT (word) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END $$;

REVOKE ALL ON FUNCTION enrich_shared_dictionary(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enrich_shared_dictionary(JSONB) TO service_role;

COMMIT;
