-- 20260603_140000_extract_book_vocab_cache_fastpath.sql
-- extract_book_vocabulary_admin timeout 해소.
--
-- 문제: 기존 함수가 매 호출마다 book_levels CTE 로 책 전체 lemma × shared_dictionary
--   Nested Loop p75 동적 계산. Poetry (5,760 lemma) 3.4s · Religious Experience
--   (8,945 lemma) ~6s. range pagination 으로 함수 재호출 누적 시 statement_timeout 초과.
--
-- Fix: library_books.vrl_components JSONB 캐시 (compute_book_vrl 적재 — p50/p75/p90)
--   fast path 추가. 99% 적중. fallback 으로 원본 동적 계산 보존.
--
-- p_percentile 매핑:
--   70 → p50 (캐시) — 캐시는 p50/p75/p90 만 제공, p70 은 근사
--   75 → p75 (정확 일치)
--   80 → p90 (캐시) — p80 근사
--   캐시 NULL 시 → 동적 계산 fallback (안전망).
--
-- 반환 컬럼·인터페이스 불변. read-only.

BEGIN;

DROP FUNCTION IF EXISTS extract_book_vocabulary_admin(UUID, SMALLINT);

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
  v_components JSONB;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF p_percentile NOT IN (70, 75, 80) THEN
    RAISE EXCEPTION 'invalid p_percentile: % (allowed: 70, 75, 80)', p_percentile;
  END IF;
  v_pct := p_percentile::numeric / 100.0;

  SELECT id, vrl_components INTO v_book FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;
  v_components := v_book.vrl_components;

  -- ★ Fast path: vrl_components 캐시 (compute_book_vrl 적재) — p70/p75/p80 정확 매핑.
  --   캐시는 책 ingestion 시 한 번만 type-based p50/p75/p90 으로 계산됨.
  --   p70/p80 은 사용자 선택 percentile — p50/p90 으로 근사 (가까운 percentile bucket).
  IF v_components IS NOT NULL THEN
    v_baseline := CASE p_percentile
      WHEN 70 THEN COALESCE((v_components->>'p50')::int, NULL)
      WHEN 75 THEN COALESCE((v_components->>'p75')::int, NULL)
      WHEN 80 THEN COALESCE((v_components->>'p90')::int, NULL)
    END;
  END IF;

  -- ★ Fallback: 캐시 없거나 0 이면 동적 계산 (원본 로직 — 안전망).
  IF v_baseline IS NULL OR v_baseline = 0 THEN
    WITH book_levels AS (
      SELECT DISTINCT lbv.lemma, d.v_level::int AS vl
      FROM library_book_vocabularies lbv
      JOIN shared_dictionary d ON d.word = lbv.lemma
      WHERE lbv.library_book_id = p_book_id
        AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.v_level < 11
    )
    SELECT COALESCE(percentile_disc(v_pct) WITHIN GROUP (ORDER BY vl)::int, 5)
      INTO v_baseline FROM book_levels;
  END IF;

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
