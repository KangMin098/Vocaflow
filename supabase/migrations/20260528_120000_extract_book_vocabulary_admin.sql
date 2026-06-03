-- 20260528_120000_extract_book_vocabulary_admin.sql
-- 큐레이션 — 도서 단어 재추출 admin RPC.
--
-- /text/new 의 extract_vocabulary_for_user_v2 composite 를 책 컨텍스트로 이식.
--   - baseline = 책 자체 V-Level (library_book_vocabularies × shared_dictionary
--     의 v_level 분포에서 p_percentile 위치, V11 outlier 제외 — book_v_level
--     계산과 동일 정책)
--   - threshold = baseline (= "이 책의 baseline 단어는 안다" 가정 → 그보다
--     높은 V-Level 단어만 추출, Krashen i+1)
--   - composite = 0.70·freq_boost + 0.30·track_boost(=0, 책 컨텍스트라 트랙 없음)
--                 + skill_penalty
--   - 후보 풀: 해당 책의 library_book_vocabularies 만 (다른 책 vocab 미포함)
--
-- read-only — UPDATE/INSERT 없음. preview 전용.
-- 영구 저장(=발행 시 사용할 selection) 은 후속 RPC 에서.

BEGIN;

CREATE OR REPLACE FUNCTION extract_book_vocabulary_admin(
  p_book_id UUID,
  p_percentile SMALLINT DEFAULT 75
)
RETURNS TABLE(
  book_v_level SMALLINT,
  v_threshold SMALLINT,
  percentile_used SMALLINT,
  total_candidates INT,
  word TEXT,
  meaning_ko TEXT,
  v_level SMALLINT,
  cefr_level TEXT,
  pos TEXT,
  example_en TEXT,
  frequency_rank INT,
  skill_level SMALLINT,
  composite_score NUMERIC,
  score_breakdown JSONB,
  rank INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book RECORD;
  v_baseline INT;
  v_thresh INT;
  v_pct NUMERIC;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF p_percentile NOT IN (70, 75, 80) THEN
    RAISE EXCEPTION 'invalid p_percentile: % (allowed: 70, 75, 80)', p_percentile;
  END IF;
  v_pct := p_percentile::numeric / 100.0;

  SELECT id INTO v_book FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  -- 1. 책 V-Level baseline 계산 (V11 outlier 제외, p_percentile 위치)
  WITH book_levels AS (
    SELECT d.v_level::int AS vl
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary d ON d.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id
      AND d.v_level IS NOT NULL
      AND d.v_level < 11
      AND d.classified_by IS NOT NULL
  )
  SELECT COALESCE(
    percentile_disc(v_pct) WITHIN GROUP (ORDER BY vl)::int,
    5
  ) INTO v_baseline
  FROM book_levels;

  v_thresh := GREATEST(1, LEAST(v_baseline, 11));

  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT ON (d.word)
      d.word AS c_word,
      d.meaning_ko AS c_meaning,
      d.v_level AS c_vl,
      d.cefr_level AS c_cefr,
      d.pos AS c_pos,
      d.example_en AS c_ex,
      d.frequency_rank AS c_freq,
      d.skill_level AS c_skill
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary d ON d.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id
      AND d.v_level IS NOT NULL
      AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.v_level >= v_thresh
  ),
  scored AS (
    SELECT c.*,
      1.0 / LOG(10, COALESCE(c.c_freq, 50000)::numeric + 10) AS c_freqb,
      CASE WHEN c.c_skill = 4 AND v_baseline < 6 THEN -0.10 ELSE 0 END AS c_skillp
    FROM candidates c
  ),
  composite AS (
    SELECT s.*,
      ROUND(0.70 * s.c_freqb + s.c_skillp, 4) AS c_score,
      ROW_NUMBER() OVER (
        ORDER BY (0.70 * s.c_freqb + s.c_skillp) DESC,
                 s.c_vl ASC,
                 s.c_freq ASC NULLS LAST
      ) AS c_rn,
      COUNT(*) OVER () AS c_total
    FROM scored s
  )
  SELECT
    v_baseline::smallint,
    v_thresh::smallint,
    p_percentile,
    c.c_total::int,
    c.c_word,
    c.c_meaning,
    c.c_vl::smallint,
    c.c_cefr,
    c.c_pos,
    c.c_ex,
    c.c_freq,
    c.c_skill::smallint,
    c.c_score,
    jsonb_build_object(
      'book_v_level_at_p', v_baseline,
      'v_threshold', v_thresh,
      'frequency_boost', ROUND(c.c_freqb, 4),
      'skill_penalty', c.c_skillp,
      'weights', jsonb_build_object('frequency_boost', 0.70, 'track_boost', 0.0),
      'reasoning',
        'V' || c.c_vl || ' ≥ threshold V' || v_thresh
        || ' (P' || p_percentile || ' of book)'
    ),
    c.c_rn::int
  FROM composite c
  ORDER BY c.c_rn;
END $$;

REVOKE ALL ON FUNCTION extract_book_vocabulary_admin(UUID, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extract_book_vocabulary_admin(UUID, SMALLINT) TO authenticated;

COMMIT;
